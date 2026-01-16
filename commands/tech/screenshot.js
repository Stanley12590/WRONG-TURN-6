module.exports = {
    name: "screenshot",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide URL!" });
        const url = `https://api.shizuka.site/screenshot?url=${args[0]}`;
        await sock.sendMessage(msg.key.remoteJid, { image: { url }, caption: `📸 *SCREENSHOT CAPTURED:* ${args[0]}` });
    }
};
