const axios = require("axios");
module.exports = {
    name: "ig",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Link needed!" });
        await sock.sendMessage(msg.key.remoteJid, { text: "📥 *Processing Insta Reel...*" });
        // Hapa unatumia public scraper link
        await sock.sendMessage(msg.key.remoteJid, { text: "Video processing via WT6 Scraper..." });
    }
};
