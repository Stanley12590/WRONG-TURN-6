const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, jidDecode } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");
const { User } = require("./database");

const app = express();
app.use(express.static('public'));

mongoose.connect(config.mongoUri).then(() => console.log("✅ Neural Memory Active"));

// Global Message Store for Anti-Delete
const messageStore = {};

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    if (!sock.authState.creds.registered && num) {
        await delay(3000);
        const code = await sock.requestPairingCode(num.trim());
        if (res) res.json({ code });
    }

    sock.ev.on("creds.update", saveCreds);

    // IDENTITY: Send Verified VCard on first contact
    sock.ev.on("contacts.upsert", async (contacts) => {
        // Identity logic
    });

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "open") sock.sendPresenceUpdate('available'); 
        if (u.connection === "close") startEngine();
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // Store for Anti-Delete
        messageStore[msg.key.id] = msg;

        // 1. FORCE JOIN CHECK
        if (body.startsWith(config.prefix)) {
            try {
                const groupMetadata = await sock.groupMetadata(config.groupId);
                const isMember = groupMetadata.participants.find(p => p.id === sender);
                if (!isMember) {
                    return await sock.sendMessage(from, { text: `⚠️ *LOCKED*\n\nYou must join our Group and Channel to use WRONG TURN 6.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
                }
            } catch (e) {}
        }

        // 2. ANTI-LINK
        if (body.includes("chat.whatsapp.com") && !msg.key.fromMe) {
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, { text: "🚫 *Anti-Link:* Unauthorized links are not allowed." });
        }

        // 3. AUTO-PRESENCE
        await sock.sendPresenceUpdate('composing', from);

        const cmd = body.startsWith(config.prefix) ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const q = body.slice(config.prefix.length + cmd.length).trim();

        if (cmd) {
            switch (cmd) {
                case 'menu':
                    // Send Verified VCard first to show bot identity
                    const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 
                                  `FN:${config.botName} ✔️\n` + 
                                  `ORG:DEVELOPER STANYTZ;\n` + 
                                  `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 
                                  'END:VCARD';
                    await sock.sendMessage(from, { contacts: { displayName: `${config.botName} ✔️`, contacts: [{ vcard }] } });

                    const menuText = `┏━━━『 *WRONG TURN 6* 』━━━┓
┃ 👤 *Developer:* STANYTZ
┃ 🚀 *Status:* Online [Verified ✔️]
┗━━━━━━━━━━━━━━━━━━━━┛

  『 *📥 DOWNLOAD CENTER* 』
┃ ➥ .tt (TikTok HD)
┃ ➥ .ig (Instagram Reels)
┃ ➥ .ytmp3 (YouTube Audio)
┃ ➥ .ytmp4 (YouTube Video)
┃ ➥ .fb (Facebook Video)
┃ ➥ .spotify (Music HQ)
┃ ➥ .pindl (Pinterest DL)

  『 *💰 WEALTH & SIGNALS* 』
┃ ➥ .livescore (Real-Time)
┃ ➥ .forex (Live Signals)
┃ ➥ .crypto (Binance Prices)
┃ ➥ .arbitrage (Price Gaps)
┃ ➥ .odds (Sure 2+ Tips)

  『 *🛡️ GROUP & ADMIN* 』
┃ ➥ .tagall (Mention All)
┃ ➥ .hidetag (Ghost Tag)
┃ ➥ .kick / .add / .promote
┃ ➥ .settings (User Config)

  『 *🧠 INTELLECT & LIFE* 』
┃ ➥ .gpt (Advanced AI)
┃ ➥ .solve (Math/Code)
┃ ➥ .movie (Search Info)
┃ ➥ .bible / .quran (Faith)
┃ ➥ .motivate (Speech)

┗━━━━━━━━━━━━━━━━━━━━┛`;
                    await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menuText });
                    break;

                case 'tagall':
                    const metadata = await sock.groupMetadata(from);
                    const participants = metadata.participants.map(v => v.id);
                    await sock.sendMessage(from, { text: `📢 *ATTENTION:*\n\n${q || "Everyone is mentioned!"}`, mentions: participants });
                    break;

                case 'tt': // TikTok Download
                    const tt = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
                    await sock.sendMessage(from, { video: { url: tt.data.video.noWatermark }, caption: "Done." });
                    break;

                case 'settings':
                    await sock.sendMessage(from, { text: "⚙️ *USER SETTINGS*\n\n1. Anti-Delete: [ON]\n2. Auto-Read: [OFF]\n3. Bot Presence: [Always Online]" });
                    break;

                case 'restart':
                    if (from.includes(config.ownerNumber)) process.exit();
                    break;
            }
        }
    });

    // 4. ANTI-DELETE LOGIC
    sock.ev.on("messages.update", async (updates) => {
        for (const update of updates) {
            if (update.update.protocolMessage && update.update.protocolMessage.type === 3) {
                const key = update.update.protocolMessage.key;
                const originalMsg = messageStore[key.id];
                if (originalMsg) {
                    await sock.sendMessage(sock.user.id, { text: `🛡️ *Anti-Delete Detected:*\n\nUser: @${key.remoteJid.split('@')[0]}\nMessage: ${originalMsg.message.conversation || "Media File"}`, mentions: [key.remoteJid] });
                    await sock.sendMessage(sock.user.id, { forward: originalMsg });
                }
            }
        }
    });
}

app.get("/get-pair", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
