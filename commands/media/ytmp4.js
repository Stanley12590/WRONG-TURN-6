const axios = require("axios");
module.exports = {
    name: "ytmp4",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "YouTube link needed!" });
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: "📥 *Processing HD Video...*" });
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { video: { url: res.data.video.noWatermark }, caption: "Done by WT6" });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Video API Error." }); }
    }
};
