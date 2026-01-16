module.exports = {
    name: "kick",
    async execute(sock, msg, args) {
        if (!msg.key.remoteJid.endsWith('@g.us')) return;
        const user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || (args[0] ? args[0].replace('@', '') + '@s.whatsapp.net' : null);
        if (!user) return sock.sendMessage(msg.key.remoteJid, { text: "Tag someone to kick, blood!" });
        await sock.groupParticipantsUpdate(msg.key.remoteJid, [user], "remove");
    }
};
