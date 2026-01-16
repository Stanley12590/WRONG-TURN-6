module.exports = {
    name: "stress",
    async execute(sock, msg, args) {
        const tips = [
            "🧘 *Breathing Technique:* Inhale for 4s, Hold for 4s, Exhale for 8s.",
            "🎧 *Sound Therapy:* Listen to 'Lo-fi beats' or 'Rain sounds'.",
            "🚶 *Physical:* Take a 5-minute walk without your phone.",
            "✍️ *Journaling:* Write down 3 things you are grateful for right now."
        ];
        const random = tips[Math.floor(Math.random() * tips.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: `🌿 *STRESS RELIEF SYSTEM* 🌿\n\n${random}\n\n_Everything will be fine, Master._` });
    }
};
