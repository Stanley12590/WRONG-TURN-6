module.exports = {
    name: 'ping',
    description: 'Check bot status',
    
    async execute(sock, msg) {
        const start = Date.now();
        await sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
        const latency = Date.now() - start;
        
        await sock.sendMessage(msg.key.remoteJid, {
            text: `📶 Latency: *${latency}ms*\n🕐 Time: *${new Date().toLocaleTimeString()}*`
        });
    }
};
