const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const http = require('http');

// Monday.com API Configuration
const MONDAY_API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjcwNzk0NTIyNSwiYWFpIjoxMSwidWlkIjoxMTc2MzE1MDcsImlhZCI6IjIwMjYtMDktMjZUMDQ6NTM6NDQuMDAwWiIsInBlciI6Im1lOndyaXRlIiwiYWN0aWQiOjM3MDc4NTQ2LCJyZ24iOiJhcHNlMiJ9.uaeIIp-pvQIyIik1UFQLQCr6g2UqZY9yt_A4uFoHpus';
const BOARD_ID = 5031564967; // AI WhatsApp Outreach Board

let sock;

async function startWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_session');
        sock = makeWASocket({ 
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true 
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                console.log('--- QR CODE START ---');
                qrcode.generate(qr, { small: true });
                console.log('--- QR CODE END ---');
                console.log('Scan this QR code from WhatsApp > Linked Devices');
            }
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed. Reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    setTimeout(startWhatsApp, 3000);
                }
            } else if (connection === 'open') {
                console.log('WhatsApp Connected on Cloud 24/7 & Monday.com Sync Engine Running!');} catch(e) {
                        phone = col.text;
                    }
                }
                if (col.id.includes('long_text_mm7je4ar')) {
                    try {
                        const parsed = JSON.parse(col.value || '{}');
                        pitch = parsed.text || col.text;
                    } catch(e) {
                        pitch = col.text;
                    }
                }
            }

            if (status === 'Draft Ready' && phone && pitch) {
                const cleanNumber = phone.replace(/[^0-9]/g, '');
                const recipient = cleanNumber + '@s.whatsapp.net';

                console.log('Sending WhatsApp to ' + item.name + ' (' + cleanNumber + ')...');
                await sock.sendMessage(recipient, { text: pitch });
                console.log('Sent successfully to ' + item.name);

                await updateMondayStatus(item.id);
            }
        }
    } catch (err) {
        console.error('Sync error:', err.message);
    }
}

async function updateMondayStatus(itemId) {
    const mutation = `mutation {
        change_simple_column_value(
            board_id: ${BOARD_ID},
            item_id: ${itemId},
            column_id: "color_mm7jrf6c",
            value: "Sent"
        ) {
            id
        }
    }`;

    await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': MONDAY_API_TOKEN
        },
        body: JSON.stringify({ query: mutation })
    });
}setInterval(syncAndSendMessages, 10000);
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (err) {
        console.error('WhatsApp init error:', err);
        setTimeout(startWhatsApp, 5000);
    }
}

async function syncAndSendMessages() {
    try {
        const query = `query {
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
        }`;

        const response = await fetch('https://api.monday.com/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': MONDAY_API_TOKEN
            },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        const items = result.data?.boards?.items_page?.items || [];

        for (const item of items) {
            let status = '';
            let phone = '';
            let pitch = '';

            for (const col of item.column_values) {
                if (col.id.includes('color_mm7jrf6c')) status = col.text;
                if (col.id.includes('phone_mm7jrexr')) {
                    try {
                        const parsed = JSON.parse(col.value || '{}');
                        phone = parsed.phone || col.text;const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Cloud Bot Alive 24/7');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Cloud Server listening on port ${PORT}`);
    startWhatsApp();
});
