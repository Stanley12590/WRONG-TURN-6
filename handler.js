const config = require("./config");
const axios = require("axios");

const commandHandler = async (sock, msg) => {
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();

    // 1. AUTO STATUS (View & Like)
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.participant] });
        return;
    }

    if (msg.key.fromMe) return;

    // 2. BYPASS VIEW-ONCE
    if (msg.message.viewOnceMessageV2) {
        await sock.sendMessage(sock.user.id, { forward: msg });
        await sock.sendMessage(from, { text: "🔓 *Anti-ViewOnce Detected:* Captured to Master." });
    }

    if (!body.startsWith(config.prefix)) return;

    // 3. FORCE JOIN LOCKDOWN
    try {
        const metadata = await sock.groupMetadata(config.groupId);
        const isMember = metadata.participants.find(p => p.id === sender);
        if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
            return await sock.sendMessage(from, { text: `⚠️ *SYSTEM LOCKED BY STANYTZ*\n\nJoin Group & Channel to use commands.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
        }
    } catch (e) {}

    const arg = body.slice(config.prefix.length).trim().split(/ +/g);
    const cmd = arg.shift().toLowerCase();
    const q = arg.join(" ");

    if (cmd) {
        await sock.sendPresenceUpdate('composing', from);

        switch (cmd) {
            case 'menu':
                // Verified Identity VCard
                const vcard = 'BEGIN:VCARD\nVERSION:3.0\n' + `FN:WRONG TURN 6 ✔️\n` + `ORG:DEVELOPER STANYTZ;\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
                await sock.sendMessage(from, { contacts: { displayName: 'WRONG TURN 6 ✔️', contacts: [{ vcard }] } });

                const menu = `┏━━━━『 *WRONG TURN 6* 』━━━━┓
┃ 👤 *Developer:* STANYTZ ✔️
┃ 🚀 *Status:* Overlord Active
┃ 💻 *OS:* Ubuntu Quantum
┗━━━━━━━━━━━━━━━━━━━━━━┛

🌸 *💰 WEALTH HUB (100+)* 🌸
┃ ➥ .livescore
┃ ➥ .odds
┃ ➥ .crypto
┃ ➥ .forex
┃ ➥ .faucet

🌸 *🎬 DOWNLOAD HUB (100+)* 🌸
┃ ➥ .tt (TikTok HD)
┃ ➥ .ig (Insta Master)
┃ ➥ .yt (YouTube Master)
┃ ➥ .spotify (HQ Music)

🌸 *🧠 INTELLECT HUB (100+)* 🌸
┃ ➥ .gpt (Advanced AI)
┃ ➥ .solve (Math/Code)
┃ ➥ .wiki (Encyclopedia)
┃ ➥ .translate (100+ Lang)

🌸 *🛡️ ADMIN HUB (100+)* 🌸
┃ ➥ .tagall (Broadcast)
┃ ➥ .hidetag (Ghost Tag)
┃ ➥ .kick / .add
┃ ➥ .antilink (ON/OFF)

🌸 *🛐 FAITH & LIFE (100+)* 🌸
┃ ➥ .bible / .quran
┃ ➥ .motivate (Hamasa)
┃ ➥ .health (Tips)

┗━━━━━━━━━━━━━━━━━━━━━━┛
🌸 *Follow:* ${config.channelLink}`;
                await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menu });
                break;

            case 'tt': // TikTok HD Scraper
                const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
                await sock.sendMessage(from, { video: { url: res.data.video.noWatermark }, caption: "Done." });
                break;

            case 'motivate':
                const mot = await axios.get("https://api.quotable.io/random?tags=motivation");
                await sock.sendMessage(from, { text: `🚀 *STANYTZ MOTIVATION:* \n\n"${mot.data.content}"` });
                break;
        }
    }
};

module.exports = { commandHandler };
