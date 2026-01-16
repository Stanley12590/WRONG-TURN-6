const config = require("../../config");
module.exports = {
    name: "menu",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const vcard = 'BEGIN:VCARD\nVERSION:3.0\n' + `FN:${config.botName} ✔️\n` + `ORG:DEVELOPER STANYTZ;\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
        await sock.sendMessage(from, { contacts: { displayName: `${config.botName} ✔️`, contacts: [{ vcard }] } });

        const text = `┏━━━━『 *${config.botName}* 』━━━━┓
┃ 👤 *Developer:* STANYTZ ✔️
┃ 🚀 *Status:* Overlord Active
┗━━━━━━━━━━━━━━━━━━━━━━┛

🌸 *💰 WEALTH HUB*
┃ ➥ .livescore
┃ ➥ .aviator (AI Predict)
┃ ➥ .odds (Sure 2+)
┃ ➥ .crypto
┃ ➥ .forex

🌸 *🎬 MEDIA HUB*
┃ ➥ .tt (TikTok HD)
┃ ➥ .ig (Instagram)
┃ ➥ .yt (YouTube)
┃ ➥ .spotify (Music)

🌸 *🧠 INTELLECT HUB*
┃ ➥ .gpt (AI Brain)
┃ ➥ .solve (Math)
┃ ➥ .wiki (Research)
┃ ➥ .translate

🌸 *🛡️ ADMIN HUB*
┃ ➥ .hidetag
┃ ➥ .kick / .add
┃ ➥ .settings
┃ ➥ .antilink

🌸 *🛐 LIFE & FAITH*
┃ ➥ .bible
┃ ➥ .quran
┃ ➥ .motivate

┗━━━━━━━━━━━━━━━━━━━━━━┛`;
        await sock.sendMessage(from, { image: { url: config.menuImage }, caption: text });
    }
};
