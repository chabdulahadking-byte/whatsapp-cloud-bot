const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const http = require('http');
const QRCode = require('qrcode');

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const BOARD_ID = Number(process.env.MONDAY_BOARD_ID || '5031564967');

const PORT = Number(process.env.PORT || 3000);
const AUTH_DIR = process.env.AUTH_DIR || '/app/auth_session';

const STATUS_COLUMN_ID = 'color_mm7jrf6c';
const PHONE_COLUMN_ID = 'phone_mm7jrexr';
const PITCH_COLUMN_ID = 'long_text_mm7je4ar';

let sock = null;
let currentQR = null;
let connected = false;

let syncRunning = false;
let reconnectTimer = null;
let syncTimer = null;

const processingItems = new Set();

if (!MONDAY_API_TOKEN) {
    console.error('ERROR: MONDAY_API_TOKEN is missing.');
    process.exit(1);
}

async function startWhatsApp() {
    try {
        console.log('Starting WhatsApp...');

        const { state, saveCreds } =
            await useMultiFileAuthState(AUTH_DIR);

        sock = makeWASocket({
            auth: state,
            browser: Browsers.macOS('Chrome'),
            printQRInTerminal: false,
            markOnlineOnConnect: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const {
                connection,
                qr,
                lastDisconnect
            } = update;

            if (qr) {
                currentQR = qr;
                connected = false;

                console.log('NEW WHATSAPP QR GENERATED');
                console.log('Open /qr in browser to scan.');
            }

            if (connection === 'open') {
                connected = true;
                currentQR = null;

                console.log('WHATSAPP CONNECTED');

                startSyncLoop();
            }

            if (connection === 'close') {
                connected = false;

                const statusCode =
                    new Boom(lastDisconnect?.error)?.output?.statusCode;

                console.log(
                    'WhatsApp connection closed. Status:',
                    statusCode
                );

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(
                        'WhatsApp logged out. QR scan required again.'
                    );

                    currentQR = null;
                    return;
                }

                scheduleReconnect();
            }
        });

    } catch (error) {
        console.error(
            'WhatsApp initialization error:',
            error
        );

        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startWhatsApp();
    }, 5000);
}

function startSyncLoop() {
    if (syncTimer) return;

    console.log('Monday.com sync loop started.');

    syncTimer = setInterval(() => {
        syncAndSendMessages();
    }, 10000);

    syncAndSendMessages();
}

async function syncAndSendMessages() {
    if (!connected || !sock) return;
    if (syncRunning) return;

    syncRunning = true;

    try {
        const query = `
            query {
                boards(ids: [${BOARD_ID}]) {
                    items_page(limit: 50) {
                        items {
                            id
                            name
                            column_values {
                                id
                                text
                                value
                            }
                        }
                    }
                }
            }
        `;

        const response = await fetch(
            'https://api.monday.com/v2',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': MONDAY_API_TOKEN
                },
                body: JSON.stringify({ query })
            }
        );

        if (!response.ok) {
            throw new Error(
                `Monday HTTP ${response.status}`
            );
        }

        const result = await response.json();

        if (result.errors) {
            throw new Error(
                JSON.stringify(result.errors)
            );
        }

        const items =
            result.data?.boards?.[0]?.items_page?.items || [];

        console.log(`Monday scan: ${items.length} items`);

        for (const item of items) {
            let status = '';
            let phone = '';
            let pitch = '';

            for (const col of item.column_values) {
                if (col.id === STATUS_COLUMN_ID) {
                    status = col.text || '';
                }

                if (col.id === PHONE_COLUMN_ID) {
                    phone = extractColumnText(col);
                }

                if (col.id === PITCH_COLUMN_ID) {
                    pitch = extractColumnText(col);
                }
            }

            if (
                status !== 'Draft Ready' ||
                !phone ||
                !pitch
            ) {
                continue;
            }

            if (processingItems.has(item.id)) {
                continue;
            }

            processingItems.add(item.id);

            try {
                await sendWhatsAppMessage(
                    item.id,
                    item.name,
                    phone,
                    pitch
                );
            } catch (error) {
                console.error(
                    `Failed for ${item.name}:`,
                    error.message
                );
            } finally {
                processingItems.delete(item.id);
            }
        }

    } catch (error) {
        console.error(
            'Monday sync error:',
            error.message
        );
    } finally {
        syncRunning = false;
    }
}

function extractColumnText(col) {
    if (col.text) {
        return col.text.trim();
    }

    if (!col.value) {
        return '';
    }

    try {
        const parsed = JSON.parse(col.value);

        if (parsed.text) {
            return String(parsed.text).trim();
        }

        if (parsed.phone) {
            return String(parsed.phone).trim();
        }

    } catch (error) {
        return String(col.value).trim();
    }

    return '';
}

async function sendWhatsAppMessage(
    itemId,
    itemName,
    phone,
    pitch
) {
    const cleanNumber = String(phone)
        .replace(/\D/g, '');

    if (!cleanNumber) {
        throw new Error('Invalid phone number');
    }

    const recipient =
        `${cleanNumber}@s.whatsapp.net`;

    console.log(
        `Sending WhatsApp to ${itemName} (${cleanNumber})`
    );

    await sock.sendMessage(
        recipient,
        {
            text: pitch
        }
    );

    console.log(
        `WhatsApp sent successfully to ${itemName}`
    );

    await updateMondayStatus(itemId);
}

async function updateMondayStatus(itemId) {
    const mutation = `
        mutation {
            change_simple_column_value(
                board_id: ${BOARD_ID},
                item_id: ${itemId},
                column_id: "${STATUS_COLUMN_ID}",
                value: "Sent"
            ) {
                id
            }
        }
    `;

    const response = await fetch(
        'https://api.monday.com/v2',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': MONDAY_API_TOKEN
            },
            body: JSON.stringify({
                query: mutation
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Monday status update HTTP ${response.status}`
        );
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(
            JSON.stringify(result.errors)
        );
    }

    console.log(
        `Monday item ${itemId} marked as Sent.`
    );
}

const server = http.createServer(
    async (req, res) => {

        if (req.url === '/') {
            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });

            return res.end(
                connected
                    ? 'WhatsApp Cloud Bot: CONNECTED'
                    : 'WhatsApp Cloud Bot: RUNNING'
            );
        }

        if (req.url === '/qr') {
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
            });

            if (connected) {
                return res.end(`
                    <html>
                    <body>
                        <h2>WhatsApp Connected</h2>
                        <p>No QR scan is required.</p>
                    </body>
                    </html>
                `);
            }

            if (!currentQR) {
                return res.end(`
                    <html>
                    <head>
                        <meta http-equiv="refresh" content="5">
                    </head>
                    <body>
                        <h2>Generating QR...</h2>
                        <p>Refreshing automatically.</p>
                    </body>
                    </html>
                `);
            }

            try {
                const qrDataURL =
                    await QRCode.toDataURL(
                        currentQR,
                        {
                            width: 350,
                            margin: 2
                        }
                    );

                return res.end(`
                    <html>
                    <body style="
                        font-family: Arial;
                        text-align: center;
                        padding: 30px;
                    ">

                        <h2>Scan WhatsApp QR</h2>

                        <p>
                            WhatsApp → Linked Devices
                            → Link a Device
                        </p>

                        <img
                            src="${qrDataURL}"
                            width="350"
                            height="350"
                        />

                        <p>
                            Refresh if QR expires.
                        </p>

                    </body>
                    </html>
                `);

            } catch (error) {
                return res.end(
                    'QR generation failed.'
                );
            }
        }

        res.writeHead(404);
        res.end('Not Found');
    }
);

server.listen(PORT, () => {
    console.log(
        `HTTP server listening on port ${PORT}`
    );

    startWhatsApp();
});
