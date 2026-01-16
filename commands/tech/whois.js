const axios = require("axios");
module.exports = {
    name: "whois",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide domain (e.g google.com)" });
        try {
            const res = await axios.get(`https://api.shizuka.site/whois?domain=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { text: `🛡️ *WHOIS DATA: ${args[0]}*\n\n${res.data.result}` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Failed to fetch domain data." }); }
    }
};
