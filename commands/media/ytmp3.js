const axios = require("axios");
module.exports = {
    name: "ytmp3",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "YouTube link needed!" });
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: "📥 *Processing High-Quality Audio...*" });
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { audio: { url: res.data.audio }, mimetype: 'audio/mp4', caption: "Done by WT6" });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Audio API Error. Try again." }); }
    }
};
