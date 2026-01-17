const { default: makeWASocket, delay, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { Session, User, Group } = require("./firebase");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let sock = null;
let isConnected = false;
global.commands = new Map();
global.config = config;

// Load Commands
function loadCommands() {
    const commandsDir = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsDir)) {
        console.log("📁 Creating commands directory...");
        fs.mkdirSync(commandsDir, { recursive: true });
        return;
    }
    
    const commandFiles = fs.readdirSync(commandsDir)
        .filter(file => file.endsWith('.js'));
    
    commandFiles.forEach(file => {
        try {
            const command = require(path.join(commandsDir, file));
            if (command.name) {
                global.commands.set(command.name.toLowerCase(), command);
                console.log(`✅ Loaded: ${command.name}`);
            }
        } catch (error) {
            console.log(`❌ Error loading ${file}:`, error.message);
        }
    });
    
    console.log(`📦 Total commands: ${global.commands.size}`);
}

// Connect to WhatsApp
async function connectToWhatsApp() {
    try {
        console.log("🔄 Connecting to WhatsApp...");
        
        // Use Firebase for session storage
        let savedSession = await Session.get(config.sessionName);
        
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        
        if (savedSession?.creds) {
            state.creds = savedSession.creds;
        }
        
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "silent" }),
            printQRInTerminal: true,
            browser: ["WRONG TURN 6", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
        });
        
        // Save credentials when updated
        sock.ev.on("creds.update", saveCreds);
        
        sock.ev.on("creds.update", async (creds) => {
            await Session.save(config.sessionName, { creds });
        });
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log("📱 QR Code Generated - Scan with WhatsApp");
            }
            
            if (connection === "open") {
                isConnected = true;
                console.log("✅ WRONG TURN 6 CONNECTED!");
                console.log(`👤 User ID: ${sock.user.id}`);
                console.log(`📱 Phone: ${sock.user.phone}`);
                
                // Auto typing presence
                setInterval(async () => {
                    if (sock && isConnected) {
                        try {
                            await sock.sendPresenceUpdate('composing');
                        } catch (e) {}
                    }
                }, 30000);
                
                // Save bot info
                await User.save(sock.user.id, {
                    name: sock.user.name || config.botName,
                    isBot: true,
                    isOwner: true,
                    joinedAt: new Date().toISOString()
                });
                
                // Send welcome to owner
                const welcome = `🚀 *WRONG TURN 6 ACTIVATED*\n\n` +
                               `*Status:* Connected ✅\n` +
                               `*Security:* Maximum Level 🔥\n` +
                               `*Database:* Firebase 🔐\n\n` +
                               `_System ready. Use ${config.prefix}menu_`;
                
                await sock.sendMessage(config.ownerJid, { text: welcome });
            }
            
            if (connection === "close") {
                isConnected = false;
                const reason = new Error(lastDisconnect?.error)?.output?.statusCode;
                
                if (reason === DisconnectReason.loggedOut) {
                    console.log("❌ Logged out - Clear session folder");
                    fs.rmSync('./session', { recursive: true, force: true });
                } else {
                    console.log("🔄 Reconnecting in 5 seconds...");
                    setTimeout(connectToWhatsApp, 5000);
                }
            }
        });
        
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (msg) {
                await handleMessage(sock, msg);
            }
        });
        
    } catch (error) {
        console.log("❌ Connection error:", error.message);
        setTimeout(connectToWhatsApp, 10000);
    }
}

// Handle incoming messages
async function handleMessage(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        const pushName = msg.pushName || "User";
        
        // Extract message text
        let body = "";
        if (msg.message.conversation) body = msg.message.conversation;
        else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text;
        else if (msg.message.imageMessage?.caption) body = msg.message.imageMessage.caption;
        else if (msg.message.videoMessage?.caption) body = msg.message.videoMessage.caption;
        
        body = body.trim();
        
        // Save user
        await User.save(sender, {
            name: pushName,
            jid: sender,
            pushName: pushName,
            lastSeen: new Date().toISOString()
        });
        
        // FORCE JOIN SYSTEM - MUST JOIN GROUP & CHANNEL
        if (body.startsWith(config.prefix) && sender !== config.ownerJid) {
            const user = await User.get(sender);
            
            // Check if user has joined group and channel
            if (!user?.hasJoinedGroup || !user?.hasJoinedChannel) {
                const joinMessage = `🔐 *ACCESS DENIED* 🔐\n\n` +
                                   `You must join our Group & Channel to use commands:\n\n` +
                                   `📢 *GROUP:* ${config.groupLink}\n` +
                                   `📡 *CHANNEL:* ${config.channelLink}\n\n` +
                                   `⚠️ _After joining, send ${config.prefix}verify in the group_`;
                
                await sock.sendMessage(from, { text: joinMessage });
                return;
            }
        }
        
        // AUTO STATUS VIEW & REACT
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(from, {
                react: { text: "❤️", key: msg.key }
            });
            
            // Auto reply to status
            if (body) {
                await sock.sendMessage(sender, {
                    text: `👀 Saw your status update! "${body.substring(0, 50)}${body.length > 50 ? '...' : ''}"`
                });
            }
            return;
        }
        
        // VIEW-ONCE AUTO CAPTURE
        if (msg.message.viewOnceMessage || msg.message.viewOnceMessageV2) {
            const mediaType = msg.message.viewOnceMessage ? 
                Object.keys(msg.message.viewOnceMessage.message)[0] :
                Object.keys(msg.message.viewOnceMessageV2.message)[0];
            
            // Forward to owner with details
            await sock.sendMessage(config.ownerJid, {
                forward: msg,
                caption: `🔓 VIEW-ONCE CAPTURED\n\n` +
                        `From: ${pushName}\n` +
                        `Chat: ${isGroup ? 'Group' : 'Private'}\n` +
                        `Type: ${mediaType}\n` +
                        `Time: ${new Date().toLocaleString()}`
            });
            
            await sock.sendMessage(from, {
                text: `⚠️ View-once media captured by security system`
            });
            return;
        }
        
        // ANTI-LINK PROTECTION (ALL LINKS)
        if (config.antiLink && body) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = body.match(urlRegex);
            
            if (links && links.length > 0) {
                await sock.sendMessage(from, { delete: msg.key });
                
                await sock.sendMessage(from, {
                    text: `🚫 *LINK REMOVED*\n\nLinks are not allowed.\n\n` +
                          `User: @${sender.split('@')[0]}\n` +
                          `Action: Message deleted`
                });
                
                await sock.sendMessage(config.ownerJid, {
                    text: `🚫 Link deleted from ${pushName}\n` +
                          `Chat: ${from}\n` +
                          `Link: ${links[0]}`
                });
                return;
            }
        }
        
        // ANTI-SWEAR FILTER (Kiswahili)
        if (config.swearFilter && body) {
            const swearWords = [
                'mavi', 'kuma', 'mate', 'chuma', 'mnyiri', 'mtama',
                'wazimu', 'pumbavu', 'fala', 'jinga', 'shupavu',
                'mchepu', 'mshenzi', 'mbwa', 'punda'
            ];
            
            const hasSwear = swearWords.some(word => 
                body.toLowerCase().includes(word.toLowerCase())
            );
            
            if (hasSwear) {
                await sock.sendMessage(from, { delete: msg.key });
                
                await sock.sendMessage(from, {
                    text: `⚠️ *LANGUAGE VIOLATION*\n\n` +
                          `Swear words are not allowed.\n\n` +
                          `User: @${sender.split('@')[0]}\n` +
                          `Action: Message deleted`
                });
                return;
            }
        }
        
        // AUTO TYPING
        if (config.autoTyping && Math.random() > 0.7) {
            await sock.sendPresenceUpdate('composing', from);
            setTimeout(async () => {
                await sock.sendPresenceUpdate('paused', from);
            }, 2000);
        }
        
        // AUTO REPLY TO VOICE
        if (msg.message.audioMessage) {
            await sock.sendMessage(from, {
                text: `🎤 Voice note received (${msg.message.audioMessage.seconds || 0}s)`
            });
        }
        
        // COMMAND HANDLER
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            const command = global.commands.get(cmd);
            
            if (command) {
                console.log(`⚡ Command: ${cmd} from ${pushName}`);
                
                await sock.sendPresenceUpdate('composing', from);
                await command.execute(sock, msg, args);
            }
        }
        
    } catch (error) {
        console.log("Handler error:", error.message);
    }
}

// Generate REAL 8-digit pairing code
async function generatePairingCode(phoneNumber) {
    try {
        console.log(`🔐 Generating pairing code for: ${phoneNumber}`);
        
        if (!sock || !isConnected) {
            return { error: "Bot not connected. Start bot first." };
        }
        
        // Remove any non-digits
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        
        // Must be international format
        const formattedNumber = cleanNumber.startsWith('255') ? cleanNumber : `255${cleanNumber}`;
        
        // Request OFFICIAL pairing code
        const code = await sock.requestPairingCode(formattedNumber);
        
        console.log(`✅ Generated code: ${code}`);
        
        return {
            success: true,
            code: code,
            number: formattedNumber,
            expiresIn: "60 seconds",
            instructions: [
                "1. Open WhatsApp on your phone",
                "2. Go to Settings > Linked Devices",
                "3. Tap 'Link a Device'",
                `4. Enter this 8-digit code: ${code}`
            ]
        };
        
    } catch (error) {
        console.log("❌ Pairing error:", error.message);
        return {
            error: error.message,
            solution: "Make sure bot is connected and number is valid"
        };
    }
}

// Web Interface Routes
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WRONG TURN 6</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .status { padding: 10px; border-radius: 5px; }
                .online { background: #28a745; color: white; }
                .offline { background: #dc3545; color: white; }
            </style>
        </head>
        <body>
            <h1>🤖 WRONG TURN 6 BOT</h1>
            <div class="status ${isConnected ? 'online' : 'offline'}">
                Status: ${isConnected ? '🟢 ONLINE' : '🔴 OFFLINE'}
            </div>
            <p>Owner: ${config.ownerName}</p>
            
            <h3>🔐 Get Pairing Code:</h3>
            <form action="/pair" method="GET">
                <input type="text" name="number" placeholder="255618558502" required>
                <button type="submit">Generate Code</button>
            </form>
            
            <h3>📱 Quick Actions:</h3>
            <a href="/restart">🔄 Restart Bot</a> |
            <a href="/status">📊 Status</a>
        </body>
        </html>
    `);
});

app.get("/pair", async (req, res) => {
    const number = req.query.number;
    
    if (!number) {
        return res.send("❌ Phone number required");
    }
    
    const result = await generatePairingCode(number);
    
    if (result.success) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pairing Code</title>
                <style>
                    body { font-family: monospace; }
                    .code { font-size: 32px; font-weight: bold; color: #28a745; }
                </style>
            </head>
            <body>
                <h1>🔐 WHATSAPP PAIRING CODE</h1>
                <p>For: ${result.number}</p>
                <div class="code">${result.code}</div>
                <p>⏰ Expires in 60 seconds</p>
                
                <h3>📱 Instructions:</h3>
                <ol>
                    ${result.instructions.map(i => `<li>${i}</li>`).join('')}
                </ol>
                
                <p><a href="/">← Back</a></p>
            </body>
            </html>
        `);
    } else {
        res.send(`❌ Error: ${result.error || result.solution}`);
    }
});

app.get("/restart", async (req, res) => {
    try {
        if (sock) {
            sock.ws.close();
        }
        setTimeout(async () => {
            await connectToWhatsApp();
            res.redirect("/");
        }, 3000);
    } catch (error) {
        res.send(`Error: ${error.message}`);
    }
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    loadCommands();
    connectToWhatsApp();
});

module.exports = { sock, isConnected };
