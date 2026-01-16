const axios = require("axios");
module.exports = {
    name: "spotify",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Blood, what song do you want from Spotify?" });
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: "🎵 *Fetching Master Quality Audio...*" });
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(q)}`);
            await sock.sendMessage(msg.key.remoteJid, { 
                audio: { url: res.data.audio }, 
                mimetype: 'audio/mp4', 
                ptt: false 
            });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Song not found or API busy." }); }
    }
};
