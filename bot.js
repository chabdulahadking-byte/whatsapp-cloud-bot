const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const http = require('http');

// Monday.com API Configuration
const MONDAY_API_TOKEN = 'PASTE_YOUR_MONDAY_API_TOKEN_HERE';
const BOARD_ID = 5031564967;

let sock;
let currentQR = '';

async function startWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_session');
        sock = makeWASocket({ 
            auth: state,
            printQRInTerminal: false
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, qr } = update;
            if (qr) {
                currentQR = qr;
                console.log('New QR generated! Open URL /qr in browser to scan.');
            }
            if (connection === 'close') {
                console.log('Connection closed. Reconnecting in 5s...');
                setTimeout(startWhatsApp, 5000);
            } else if (connection === 'open') {
                currentQR = 'CONNECTED';
                console.log('🚀 WhatsApp Connected on Cloud 24/7 & Monday.com Sync Running!');setInterval(syncAndSendMessages, 10000);
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (e) {
        console.error('Init error:', e.message);
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
                        phone = parsed.phone || col.text;} catch(e) {
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
}// HTTP Server to view QR Code easily in browser
const server = http.createServer((req, res) => {
    if (req.url === '/qr') {
        if (currentQR === 'CONNECTED') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end('WhatsApp Already Connected 24/7!');
        }
        if (!currentQR) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end('Generating QR code, please refresh in 5 seconds...');
        }
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`Scan with WhatsApp > Linked DevicesRefresh page if QR expires`);
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Cloud Bot is Running 24/7! Go to /qr to scan.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    startWhatsApp();
});


