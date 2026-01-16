module.exports = {
    name: "romance",
    async execute(sock, msg, args) {
        const advice = [
            "❤️ Small gestures like a 'Good Morning' text keep the spark alive.",
            "❤️ Never go to bed angry; resolve conflicts with calm words.",
            "❤️ Honesty is the foundation of long-term romance.",
            "❤️ Spend quality time without phones to build a deeper connection."
        ];
        const random = advice[Math.floor(Math.random() * advice.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: `🌹 *ROMANCE & RELATIONSHIP* 🌹\n\n"${random}"` });
    }
};
