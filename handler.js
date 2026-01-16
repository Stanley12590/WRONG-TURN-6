const config = require("./config");
const { User } = require("./database");

const commandHandler = async (sock, msg) => {
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();

    // 1. AUTO STATUS VIEW & LIKE
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.participant] });
        return;
    }

    if (msg.key.fromMe) return;

    // 2. FORCE JOIN CHECK
    if (body.startsWith(config.prefix)) {
        try {
            const metadata = await sock.groupMetadata(config.groupId);
            const isMember = metadata.participants.find(p => p.id === sender);
            if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
                return await sock.sendMessage(from, { text: `⚠️ *LOCKED*\n\nJoin Group to unlock WRONG TURN 6:\n${config.groupLink}` });
            }
        } catch (e) {}
    }

    // 3. COMMAND LOADER
    if (body.startsWith(config.prefix)) {
        const arg = body.slice(config.prefix.length).trim().split(/ +/g);
        const cmdName = arg.shift().toLowerCase();
        const command = global.commands.get(cmdName);

        if (command) {
            await sock.sendPresenceUpdate('composing', from); // Auto-Typing
            await command.execute(sock, msg, arg);
        }
    }
};

module.exports = { commandHandler };
