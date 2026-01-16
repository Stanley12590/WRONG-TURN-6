module.exports = {
    name: "slot",
    async execute(sock, msg, args) {
        const items = ["🍎", "🍋", "💎", "🔔", "7️⃣"];
        const r1 = items[Math.floor(Math.random() * items.length)];
        const r2 = items[Math.floor(Math.random() * items.length)];
        const r3 = items[Math.floor(Math.random() * items.length)];
        const win = r1 === r2 && r2 === r3;
        const text = `🎰 *SLOT MACHINE* 🎰\n\n[ ${r1} | ${r2} | ${r3} ]\n\n${win ? "🎉 JACKPOT! YOU WIN! 🎉" : "❌ No match. Try again!"}`;
        await sock.sendMessage(msg.key.remoteJid, { text });
    }
};
