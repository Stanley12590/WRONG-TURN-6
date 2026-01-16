module.exports = {
    name: "news",
    async execute(sock, msg, args) {
        const headlines = `🌍 *GLOBAL BREAKING NEWS* 🌍\n\n1. Tech: AI regulation talks begin in Geneva.\n2. Finance: Bitcoin hits new resistance level.\n3. Sports: Champions League draws announced.\n\n_Type .gpt [topic] for more details._`;
        await sock.sendMessage(msg.key.remoteJid, { text: headlines });
    }
};
