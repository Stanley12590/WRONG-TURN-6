module.exports = {
    name: "ping",
    async execute(sock, msg, args) {
        const start = Date.now();
        await sock.sendMessage(msg.key.remoteJid, { text: "📡 *Checking Latency...*" });
        const end = Date.now();
        await sock.sendMessage(msg.key.remoteJid, { text: `⚡ *WRONG TURN 6 SPEED:* ${end - start}ms` });
    }
};
