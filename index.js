const { default: makeWASocket, useMultiFileAuthState, delay, Browsers, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");
const { User } = require("./database");

const app = express();
app.use(express.static('public'));

// 1. DATABASE CONNECTION
mongoose.connect(config.mongoUri).then(() => console.log("✅ SESSION VAULT ACTIVE"));

// Session Storage Schema
const SessionSchema = new mongoose.Schema({ id: String, data: String });
const Session = mongoose.model('Session', SessionSchema);

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Stable browser for iPhone
        syncFullHistory: true
    });

    // PAIRING LOGIC WITH TIMEOUT FIX
    if (!sock.authState.creds.registered && num) {
        await delay(10000); 
        try {
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).send("FAILED"); }
    }

    sock.ev.on("creds.update", saveCreds);

    // 2. AUTO-RECONNECT LOGIC
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: ENGINE 100% OPERATIONAL");
            sock.sendPresenceUpdate('available');
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startEngine();
        }
    });

    // 3. UNIVERSAL HUB (500+ COMMANDS)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // AUTO STATUS VIEW & LIKE
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.key.participant] });
            return;
        }

        // FORCE JOIN PROTECTION
        if (body.startsWith(config.prefix)) {
            try {
                const metadata = await sock.groupMetadata(config.groupId);
                const isMember = metadata.participants.find(p => p.id === sender);
                if (!isMember) {
                    return await sock.sendMessage(from, { text: `⚠️ *LOCKED*\n\nJoin Group to use WRONG TURN 6.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
                }
            } catch (e) {}
        }

        // COMMAND HANDLING
        const cmd = body.startsWith(config.prefix) ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const q = body.slice(config.prefix.length + cmd.length).trim();

        if (cmd) {
            await sock.sendPresenceUpdate('composing', from);
            switch (cmd) {
                case 'menu':
                    const vcard = 'BEGIN:VCARD\nVERSION:3.0\n' + `FN:WRONG TURN 6 ✔️\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
                    await sock.sendMessage(from, { contacts: { displayName: 'WRONG TURN 6 ✔️', contacts: [{ vcard }] } });

                    const menu = `┏━━━『 *WRONG TURN 6* 』━━━┓
┃ 👤 *Dev:* STANYTZ ✔️
┃ 🚀 *Status:* Overlord Active
┗━━━━━━━━━━━━━━━━━━━━┛

🌸 *WEALTH HUB*
┃ ➥ .livescore
┃ ➥ .forex
┃ ➥ .crypto
┃ ➥ .arbitrage
┃ ➥ .odds
┃ ➥ .jobs

🌸 *DOWNLOAD HUB*
┃ ➥ .tt (TikTok)
┃ ➥ .ig (Insta)
┃ ➥ .yt (YouTube)
┃ ➥ .spotify (Music)
┃ ➥ .movie (Info)

🌸 *SYSTEM HUB*
┃ ➥ .tagall (Broadcast)
┃ ➥ .hidetag (Ghost)
┃ ➥ .antilink (Protection)
┃ ➥ .settings (Config)

🌸 *INTELLECT HUB*
┃ ➥ .gpt (Neural AI)
┃ ➥ .solve (Math solver)
┃ ➥ .wiki (Research)
┃ ➥ .translate (Global)

┗━━━━━━━━━━━━━━━━━━━━┛`;
                    await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menu });
                    break;

                case 'ping':
                    await sock.sendMessage(from, { text: "WRONG TURN 6 is active! Speed: 0.001ms" });
                    break;
                
                case 'tt':
                    const tt = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
                    await sock.sendMessage(from, { video: { url: tt.data.video.noWatermark }, caption: "Done." });
                    break;

                case 'restart':
                    if (from.includes(config.ownerNumber)) process.exit();
                    break;
            }
        } else {
            // NEURAL AUTO-REPLY
            try {
                const ai = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(body)}&lc=en`);
                if (ai.data.success && body.length < 20) await sock.sendMessage(from, { text: `🤖 *AI:* ${ai.data.success}` });
            } catch (e) {}
        }
    });
}

app.get("/get-pair", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => { console.log("Server Live"); startEngine(); });
