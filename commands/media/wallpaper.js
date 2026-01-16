module.exports = {
    name: "wallpaper",
    async execute(sock, msg, args) {
        const q = args.join(" ") || "Nature";
        const url = `https://api.shizuka.site/wallpaper?search=${encodeURIComponent(q)}`;
        await sock.sendMessage(msg.key.remoteJid, { image: { url }, caption: `🖼️ *WALLPAPER:* ${q}\n\n_Captured by WRONG TURN 6_` });
    }
};
