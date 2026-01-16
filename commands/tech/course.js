module.exports = {
    name: "course",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "What do you want to learn today?" });
        const results = `🎓 *FREE LEARNING HUB* 🎓\n\nQuery: *${q}*\n\n1. Search: 'FreeCourseSite.com'\n2. Search: 'CourseDrive.net'\n3. YouTube: 'FreeCodeCamp' or 'Edureka'\n\n_Knowledge is the ultimate weapon._`;
        await sock.sendMessage(msg.key.remoteJid, { text: results });
    }
};
