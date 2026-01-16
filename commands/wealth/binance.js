const axios = require("axios");
module.exports = {
    name: "binance",
    async execute(sock, msg, args) {
        try {
            const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
            const top = res.data.sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 5);
            let text = `📈 *BINANCE TOP GAINERS* 📈\n\n`;
            top.forEach((c, i) => {
                text += `${i+1}. *${c.symbol}* \n🚀 Change: +${c.priceChangePercent}%\n💰 Price: $${c.lastPrice}\n\n`;
            });
            await sock.sendMessage(msg.key.remoteJid, { text });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Binance API busy." }); }
    }
};
