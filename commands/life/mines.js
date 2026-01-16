module.exports = {
    name: "mines",
    async execute(sock, msg, args) {
        const grid = [
            "💣", "💎", "💎", "💣", "💎",
            "💎", "💣", "💎", "💎", "💎",
            "💎", "💎", "💣", "💎", "💣"
        ];
        const shuffled = grid.sort(() => Math.random() - 0.5).slice(0, 9);
        const text = `🎰 *WRONG TURN 6 MINES* 🎰\n\n${shuffled[0]} ${shuffled[1]} ${shuffled[2]}\n${shuffled[3]} ${shuffled[4]} ${shuffled[5]}\n${shuffled[6]} ${shuffled[7]} ${shuffled[8]}\n\n_Did you hit the bomb? Try again!_`;
        await sock.sendMessage(msg.key.remoteJid, { text });
    }
};
