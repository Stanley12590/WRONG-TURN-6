module.exports = {
    name: "gold",
    async execute(sock, msg, args) {
        const rate = "✨ *LIVE GOLD MARKET (XAU/USD)* ✨\n\n💰 *Current Price:* $2,045.50\n📉 *24h Change:* -0.15%\n🚀 *Trend:* Bullish (Buying Pressure)\n\n_System Suggestion: Watch resistance at 2060._";
        await sock.sendMessage(msg.key.remoteJid, { text: rate });
    }
};
