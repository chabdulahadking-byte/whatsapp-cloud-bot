# WhatsApp AI Agent — Baileys + Railway + Monday.com

This project runs a WhatsApp automation service with Baileys. It can stay online on Railway while your laptop is turned off.

## Current features

- WhatsApp Web session via Baileys
- QR login through the `/qr` web page
- Persistent auth directory support through `AUTH_DIR`
- Automatic reconnect after temporary disconnects
- Monday.com polling
- Sends a Monday.com "pitch" to a WhatsApp number when status is `Draft Ready`
- Marks the Monday.com item as `Sent` after successful delivery
- Railway-friendly HTTP health endpoint

## Environment variables

Set these in Railway Variables:

```text
MONDAY_API_TOKEN=your_monday_api_token
MONDAY_BOARD_ID=5031564967
AUTH_DIR=/app/auth_session
```

Do NOT put real API tokens in GitHub.

## Railway deployment

1. Deploy this repository from GitHub to Railway.
2. Set the environment variables above.
3. Add a Railway Volume and mount it at:
   ```
   /app/auth_session
   ```
4. Deploy/redeploy.
5. Open your Railway service URL followed by:
   ```
   /qr
   ```
6. On your phone: WhatsApp → Linked devices → Link a device.
7. Scan the QR code.
8. Once connected, the authentication files are stored in the Railway volume, so a normal container restart does not require a new QR scan.

## Important

The Baileys approach uses WhatsApp Web rather than the official WhatsApp Business Cloud API. It can carry account/session risk and should be used carefully.

Never commit:
- `auth_session/`
- `.env`
- API tokens
- private credentials

## Local development

```bash
npm install
npm start
```

Then open:

```
http://localhost:3000/qr
```

The project expects Node.js 20.x.
