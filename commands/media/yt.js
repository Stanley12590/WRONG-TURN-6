const axios = require("axios");
module.exports = {
    name: "yt",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide YouTube link!" });
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: "📥 *Processing YouTube HD Video...*" });
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { video: { url: res.data.video.noWatermark }, caption: "Done by STANYTZ." });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Failed to download YouTube video." }); }
    }
};
