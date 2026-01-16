const axios = require("axios");
module.exports = {
    name: "define",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Word needed!" });
        try {
            const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${args[0]}`);
            const data = res.data[0];
            const text = `📖 *DICTIONARY: ${data.word.toUpperCase()}*\n\n🧠 *Meaning:* ${data.meanings[0].definitions[0].definition}\n\n💬 *Example:* ${data.meanings[0].definitions[0].example || "N/A"}`;
            await sock.sendMessage(msg.key.remoteJid, { text });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Word not found in Matrix database." }); }
    }
};
