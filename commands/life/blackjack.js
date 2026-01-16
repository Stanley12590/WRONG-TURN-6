module.exports = {
    name: "blackjack",
    async execute(sock, msg, args) {
        const userCard = Math.floor(Math.random() * 11) + 1;
        const botCard = Math.floor(Math.random() * 11) + 1;
        const result = userCard > botCard ? "🎉 YOU WIN!" : userCard === botCard ? "🤝 DRAW!" : "❌ BOT WINS!";
        await sock.sendMessage(msg.key.remoteJid, { text: `🃏 *BLACKJACK* 🃏\n\n👤 Your Card: ${userCard}\n🤖 Bot Card: ${botCard}\n\n*Result:* ${result}` });
    }
};
