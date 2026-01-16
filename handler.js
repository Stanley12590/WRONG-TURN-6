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

    // 2. LOAD USER FROM DATABASE
    let user = await User.findOne({ id: sender }) || await User.create({ id: sender, name: msg.pushName });

    // 3. FORCE JOIN CHECK (Strict)
    if (body.startsWith(config.prefix)) {
        try {
            const metadata = await sock.groupMetadata(config.groupId);
            const isMember = metadata.participants.find(p => p.id === sender);
            if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
                return await sock.sendMessage(from, { text: `⚠️ *LOCKED BY STANYTZ*\n\nJoin our official Group and Channel to use commands.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
            }
        } catch (e) {}
    }

    // 4. ANTI-LINK PURGE
    if (user.antiLink && body.match(/(chat.whatsapp.com|whatsapp.com\/channel)/gi) && from.endsWith('@g.us')) {
        await sock.sendMessage(from, { delete: msg.key });
        return;
    }

    // 5. COMMAND EXECUTION
    if (body.startsWith(config.prefix)) {
        const arg = body.slice(config.prefix.length).trim().split(/ +/g);
        const cmdName = arg.shift().toLowerCase();
        
        // Hapa inatafuta kama command ipo kwenye folda za commands
        const command = global.commands.get(cmdName);
        if (command) {
            await sock.sendPresenceUpdate('composing', from); // Auto-Typing
            await command.execute(sock, msg, arg);
        }
    }
};

module.exports = { commandHandler };
