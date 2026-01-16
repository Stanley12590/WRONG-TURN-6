module.exports = {
    name: "sexed",
    async execute(sock, msg, args) {
        const tips = [
            "🛡️ *Safety:* Always use protection to prevent STIs and unplanned pregnancies.",
            "🤝 *Consent:* Communication is key. Always ensure mutual consent in any intimacy.",
            "🧬 *Health:* Regular check-ups are important for your reproductive health.",
            "🧠 *Mental:* A healthy relationship is built on respect, not just physical attraction."
        ];
        const random = tips[Math.floor(Math.random() * tips.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: `🔞 *SEXUAL EDUCATION HUB* 🔞\n\n${random}\n\n_Stay Safe, Stay Educated by STANYTZ._` });
    }
};
