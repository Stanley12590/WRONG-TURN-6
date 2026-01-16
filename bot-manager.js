const { default: makeWASocket, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");
const pino = require("pino");
const config = require('./config');
const { Session, User } = require('./database');

// Store active bot sessions
const botSessions = new Map();

// Create bot session
const createBotSession = async (sessionData) => {
    try {
        console.log(`🤖 Creating bot for: ${sessionData.phoneNumber}`);
        
        // Initialize credentials
        const creds = sessionData.creds || initAuthCreds();
        
        // Create WhatsApp socket
        const sock = makeWASocket({
            auth: {
                creds,
                keys: makeCacheableSignalKeyStore(creds, pino({ level: "fatal" }))
            },
            logger: pino({ level: "fatal" }),
            printQRInTerminal: false,
            browser: ["WRONG TURN 6", "Chrome", "3.0"],
            syncFullHistory: false
        });
        
        // Store credentials when updated
        sock.ev.on("creds.update", async (updatedCreds) => {
            try {
                await Session.findOneAndUpdate(
                    { phoneNumber: sessionData.phoneNumber },
                    { creds: updatedCreds }
                );
            } catch (error) {
                console.error('Error saving credentials:', error);
            }
        });
        
        // Handle connection
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "open") {
                console.log(`✅ Bot connected: ${sessionData.phoneNumber}`);
                
                // Update session
                await Session.findOneAndUpdate(
                    { phoneNumber: sessionData.phoneNumber },
                    {
                        status: 'active',
                        connectedAt: new Date(),
                        lastSeen: new Date()
                    }
                );
                
                // Update user
                await User.findOneAndUpdate(
                    { phoneNumber: sessionData.phoneNumber },
                    { lastActive: new Date() }
                );
                
                // Send welcome message
                await sendWelcomeMessage(sock, sessionData);
            }
            
            if (connection === "close") {
                console.log(`❌ Bot disconnected: ${sessionData.phoneNumber}`);
                
                // Update session
                await Session.findOneAndUpdate(
                    { phoneNumber: sessionData.phoneNumber },
                    { 
                        status: 'inactive',
                        lastSeen: new Date()
                    }
                );
                
                // Remove from active sessions
                botSessions.delete(sessionData.phoneNumber);
                
                // Try to reconnect
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log(`🔄 Reconnecting ${sessionData.phoneNumber} in 10s...`);
                    setTimeout(async () => {
                        try {
                            const session = await Session.findOne({ 
                                phoneNumber: sessionData.phoneNumber,
                                status: 'active'
                            });
                            if (session) {
                                await createBotSession(session);
                            }
                        } catch (error) {
                            console.error('Reconnect failed:', error);
                        }
                    }, 10000);
                }
            }
        });
        
        // Handle incoming messages
        sock.ev.on("messages.upsert", async ({ messages }) => {
            if (!messages || messages.length === 0) return;
            
            const message = messages[0];
            if (message.key.fromMe) return;
            
            // Update last seen
            await Session.findOneAndUpdate(
                { phoneNumber: sessionData.phoneNumber },
                { lastSeen: new Date() }
            );
            
            // Handle message
            await handleMessage(sock, message, sessionData);
        });
        
        // Store bot session
        botSessions.set(sessionData.phoneNumber, {
            socket: sock,
            phoneNumber: sessionData.phoneNumber,
            connectedAt: new Date()
        });
        
        return true;
        
    } catch (error) {
        console.error(`Error creating bot for ${sessionData.phoneNumber}:`, error);
        return false;
    }
};

// Send welcome message
const sendWelcomeMessage = async (sock, sessionData) => {
    try {
        const welcomeMsg = `🚀 *${config.botName} IS NOW ACTIVE* 🚀\n\n` +
            `Welcome to *${config.botName}*\n` +
            `Developer: *${config.developer}*\n\n` +
            `📱 Your Number: ${sessionData.phoneNumber}\n` +
            `⚡ Prefix: ${config.prefix}\n\n` +
            `✅ *Verification Successful!*\n` +
            `You can now use all bot commands.\n\n` +
            `Type *${config.prefix}menu* to see available commands.\n\n` +
            `📢 Stay connected:\n` +
            `• Group: ${config.groupLink}\n` +
            `• Channel: ${config.channelLink}`;
        
        await sock.sendMessage(sock.user.id, { text: welcomeMsg });
        
    } catch (error) {
        console.error('Error sending welcome:', error);
    }
};

// Handle incoming messages
const handleMessage = async (sock, message, sessionData) => {
    try {
        const from = message.key.remoteJid;
        const body = extractMessageText(message);
        
        if (!body || !from) return;
        
        // Check if message is a command
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            
            // Check if user has joined group and channel
            const user = await User.findOne({ phoneNumber: sessionData.phoneNumber });
            
            if (!user?.joinedGroup || !user?.joinedChannel) {
                const lockMessage = `⚠️ *LOCKED BY ${config.developer}*\n\n` +
                    `You must join our Group AND Channel to use commands.\n\n` +
                    `🔗 *Group:* ${config.groupLink}\n` +
                    `🔗 *Channel:* ${config.channelLink}\n\n` +
                    `After joining, please reconnect the bot.`;
                
                await sock.sendMessage(from, { text: lockMessage });
                return;
            }
            
            // Handle commands
            if (command === 'menu') {
                await showMenu(sock, from, sessionData);
            } else if (command === 'ping') {
                const start = Date.now();
                await sock.sendMessage(from, { text: '🏓 Pong!' });
                const latency = Date.now() - start;
                await sock.sendMessage(from, {
                    text: `📶 Latency: *${latency}ms*\n🕐 Time: *${new Date().toLocaleTimeString()}*`
                });
            } else if (command === 'owner') {
                await sock.sendMessage(from, {
                    text: `👑 *BOT OWNER*\n\n` +
                          `Name: *${config.developer}*\n` +
                          `Contact: *${config.ownerNumber}*\n\n` +
                          `For support, contact the owner.`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ Unknown command: *${command}*\n\n` +
                          `Type *${config.prefix}menu* for available commands.`
                });
            }
            
            // Update command usage
            await User.findOneAndUpdate(
                { phoneNumber: sessionData.phoneNumber },
                { $inc: { warnings: 1 } }
            );
        }
        
    } catch (error) {
        console.error('Message handler error:', error);
    }
};

// Extract message text
const extractMessageText = (message) => {
    const msg = message.message;
    if (!msg) return '';
    
    return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        ''
    ).trim();
};

// Show menu command
const showMenu = async (sock, from, sessionData) => {
    try {
        const menu = `
╔═══════════════════════════
║  *${config.botName.toUpperCase()}*
║  ────────────────────────
║  👑 Developer: ${config.developer}
║  📱 User: ${sessionData.phoneNumber}
║  ⚡ Prefix: ${config.prefix}
║  ────────────────────────
║  📁 *OWNER COMMANDS*
║  • ${config.prefix}menu - Show this menu
║  • ${config.prefix}ping - Check bot status
║  • ${config.prefix}owner - Contact owner
║  ────────────────────────
║  📁 *GROUP COMMANDS*
║  • ${config.prefix}antilink [on/off]
║  • ${config.prefix}welcome [on/off]
║  • ${config.prefix}kick @user
║  ────────────────────────
║  📁 *MEDIA TOOLS*
║  • ${config.prefix}sticker
║  • ${config.prefix}toimg
║  ────────────────────────
║  📢 *COMMUNITY*
║  • Group: ${config.groupLink}
║  • Channel: ${config.channelLink}
╚═══════════════════════════
        `;
        
        await sock.sendMessage(from, {
            image: { url: config.menuImage },
            caption: menu.trim()
        });
        
    } catch (error) {
        // Fallback to text
        await sock.sendMessage(from, {
            text: `*${config.botName} MENU*\n\nType ${config.prefix}help for more commands.`
        });
    }
};

module.exports = {
    createBotSession,
    botSessions
};
