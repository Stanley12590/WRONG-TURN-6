module.exports = {
    name: "menu",
    alias: ["help", "cmd"],
    async execute(sock, msg, args) {
        await sock.sendMessage(msg.key.remoteJid, {
            text: `🤖 *WRONG TURN 6 BOT*\n\n` +
                  `Owner: STANYTZ\n` +
                  `Prefix: .\n\n` +
                  `🔒 Security Features:\n` +
                  `✅ Anti-Link Protection\n` +
                  `✅ View-Once Capture\n` +
                  `✅ Auto Status View\n\n` +
                  `🔗 Links Required:\n` +
                  `📢 Group: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y\n` +
                  `📡 Channel: https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p\n\n` +
                  `⚠️ Join both to use commands!`
        });
    }
};
