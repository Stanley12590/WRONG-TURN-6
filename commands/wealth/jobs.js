module.exports = {
    name: "jobs",
    async execute(sock, msg, args) {
        const text = `💼 *REMOTE GIG FINDER* 💼\n\nTrending Gigs Today:\n\n1. Virtual Assistant (Upwork) - $15/hr\n2. Python Developer (Toptal) - $60/hr\n3. Content Writer (Fiverr) - $50/project\n\n_Type .gpt for tips on how to apply._`;
        await sock.sendMessage(msg.key.remoteJid, { text });
    }
};
