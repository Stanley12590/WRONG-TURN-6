const axios = require("axios");
module.exports = {
    name: "fb",
    async execute(sock, msg, args) {
        const q = args[0];
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Blood, provide Facebook video link!" });
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: "📥 *Processing Facebook Video...*" });
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
            await sock.sendMessage(msg.key.remoteJid, { video: { url: res.data.video.noWatermark }, caption: "Done by WRONG TURN 6 ✔️" });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Error: Video private or link broken." }); }
    }
};
