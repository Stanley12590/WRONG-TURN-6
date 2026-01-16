const { 
    default: makeWASocket, useMultiFileAuthState, Browsers, delay, 
    makeCacheableSignalKeyStore, DisconnectReason 
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");
const { User } = require("./database");

const app = express();
const port = process.env.PORT || 3000;
app.use(express.static('public'));

// 1. CONNECT DATABASE
mongoose.connect(config.mongoUri).then(() => console.log("✅ DATABASE CONNECTED"));

async function startEngine(num = null, res = null) {
    // Session is stored in 'session_wt6' folder
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
    });

    // PAIRING LOGIC
    if (!sock.authState.creds.registered && num) {
        await delay(10000); 
        try {
            let code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) res.json({ code });
        } catch (e) { 
            if (res && !res.headersSent) res.status(500).json({error: "Server busy"}); 
        }
    }

    sock.ev.on("creds.update", saveCreds);

    // 2. CONNECTION MONITOR (The "Always Online" Fix)
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 IS TOTALLY ALIVE!");
            await sock.sendPresenceUpdate('available');
        }
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startEngine();
        }
    });

    // 3. THE COMMAND HANDLER (THE FIX)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const pushName = msg.pushName || "User";

        // AUTO STATUS VIEW
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            return;
        }

        // PREVENT SELF-LOOP
        if (msg.key.fromMe) return;

        // COMMAND LOGIC
        if (body.startsWith(config.prefix)) {
            const arg = body.slice(config.prefix.length).trim().split(/ +/g);
            const cmd = arg.shift().toLowerCase();
            const q = arg.join(" ");

            console.log(`Command Received: ${cmd}`); // For Debugging

            await sock.sendPresenceUpdate('composing', from);

            switch (cmd) {
                case 'menu':
                case 'help':
                    const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + `FN:WRONG TURN 6 ✔️\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
                    await sock.sendMessage(from, { contacts: { displayName: 'WRONG TURN 6 ✔️', contacts: [{ vcard }] } });

                    const menu = `┏━━━━ 『 *WRONG TURN 6* 』 ━━━━┓
┃ 👤 *Developer:* STANYTZ ✔️
┃ ⚡ *Mode:* Super-System
┗━━━━━━━━━━━━━━━━━━━━━━┛

  『 *💰 WEALTH HUB* 』
┃ ➥ .livescore (Live Football)
┃ ➥ .arbitrage (Crypto Gaps)
┃ ➥ .forex (Live Signals)
┃ ➥ .crypto (Binance Price)
┃ ➥ .odds (Sure 2+ Tips)

  『 *🎬 DOWNLOAD HUB* 』
┃ ➥ .tt (TikTok HD)
┃ ➥ .ig (Insta Reels)
┃ ➥ .yt (YouTube Master)
┃ ➥ .spotify (HQ Music)
┃ ➥ .fb (Facebook DL)

  『 *🛡️ ADMIN HUB* 』
┃ ➥ .tagall (Broadcast)
┃ ➥ .hidetag (Ghost Tag)
┃ ➥ .kick / .add / .promote
┃ ➥ .antilink (ON/OFF)
┃ ➥ .settings (Config)

━━━━━━━━━━━━━━━━━━━━━━
🌸 *Follow:* ${config.channelLink}`;
                    await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menu });
                    break;

                case 'tt':
                    const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
                    await sock.sendMessage(from, { video: { url: res.data.video.noWatermark }, caption: "Done." });
                    break;
                
                case 'ping':
                    await sock.sendMessage(from, { text: "Pong! Speed: 0.001ms" });
                    break;
            }
        }
    });
}

// 4. WEB PAIRING ENDPOINT
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(port, () => {
    console.log(`StanyTz Server running on port ${port}`);
    startEngine(); 
});
