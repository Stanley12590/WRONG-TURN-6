const config = require("./config");
const { User } = require("./database");

const commandHandler = async (sock, msg) => {
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
    const isCmd = body.startsWith(config.prefix);

    // AUTO STATUS
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        return;
    }

    if (msg.key.fromMe) return;

    // LOAD SETTINGS
    let user = await User.findOne({ id: sender }) || await User.create({ id: sender, name: msg.pushName });

    // ANTI-LINK PURGE
    if (user.antiLink && body.match(/(chat.whatsapp.com|whatsapp.com\/channel)/gi) && from.endsWith('@g.us')) {
        await sock.sendMessage(from, { delete: msg.key });
        return;
    }

    if (!isCmd) return;

    // FORCE JOIN LOCKDOWN
    try {
        const metadata = await sock.groupMetadata(config.groupId);
        const isMember = metadata.participants.find(p => p.id === sender);
        if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
            return await sock.sendMessage(from, { text: `⚠️ *ACCESS DENIED*\n\nJoin Group to use WRONG TURN 6:\n${config.groupLink}` });
        }
    } catch (e) {}

    const arg = body.slice(config.prefix.length).trim().split(/ +/g);
    const cmdName = arg.shift().toLowerCase();
    const command = global.commands.get(cmdName);

    if (command) {
        // AUTO PRESENCE
        await sock.sendPresenceUpdate('available', from);
        await sock.sendPresenceUpdate('composing', from); // Auto Typing
        await command.execute(sock, msg, arg);
    }
};

module.exports = { commandHandler };
