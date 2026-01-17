// CRYPTO POLYFILL MUST BE FIRST
require('./crypto-polyfill');

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

console.log("🚀 Starting WRONG TURN 6 Bot...");
console.log("🔐 Crypto check:", typeof crypto !== 'undefined' ? '✅ Available' : '❌ Missing');
console.log("🌍 Environment:", process.env.NODE_ENV || 'production');

// LOAD COMMANDS
function loadCommands() {
    console.log("📂 Loading commands...");
    const commandsDir = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsDir)) {
        console.log("⚠️ Creating commands directory...");
        fs.mkdirSync(commandsDir, { recursive: true });
        
        // Create essential commands
        const essentialCommands = {
            'menu.js': `module.exports = {
                name: "menu",
                alias: ["help", "cmd"],
                async execute(sock, msg, args) {
                    const menu = "⚡ *WRONG TURN 6 BOT* ⚡\\n\\n" +
                                "*Owner:* STANYTZ\\n" +
                                "*Prefix:* .\\n\\n" +
                                "*Features:*\\n" +
                                "✅ Anti-Link Protection\\n" +
                                "✅ Auto Status View\\n" +
                                "✅ View-Once Capture\\n" +
                                "✅ Real Pairing Codes\\n\\n" +
                                "_Use .pair <number> to link device_";
                    await sock.sendMessage(msg.key.remoteJid, { text: menu });
                }
            };`,
            
            'pair.js': `module.exports = {
                name: "pair",
                alias: ["link", "code"],
                async execute(sock, msg, args) {
                    const from = msg.key.remoteJid;
                    const sender = msg.key.participant || from;
                    
                    if (sender !== global.config.ownerJid) {
                        return sock.sendMessage(from, {
                            text: "❌ Only owner can generate pairing codes"
                        });
                    }
                    
                    const number = args[0];
                    if (!number) {
                        return sock.sendMessage(from, {
                            text: "Usage: .pair 255618558502"
                        });
                    }
                    
                    try {
                        const code = await sock.requestPairingCode(number.replace(/\\D/g, ''));
                        await sock.sendMessage(from, {
                            text: \`🔐 *WHATSAPP PAIRING CODE*\\n\\n*For:* \${number}\\n*Code:* \`\${code}\`\\n\\nExpires in 60 seconds\`
                        });
                    } catch (error) {
                        await sock.sendMessage(from, {
                            text: \`❌ Error: \${error.message}\`
                        });
                    }
                }
            };`,
            
            'ping.js': `module.exports = {
                name: "ping",
                async execute(sock, msg, args) {
                    const start = Date.now();
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: "🏓 *PONG!*\\nBot is active and secure"
                    });
                }
            };`
        };
        
        Object.entries(essentialCommands).forEach(([filename, content]) => {
            fs.writeFileSync(path.join(commandsDir, filename), content);
            console.log(`✅ Created ${filename}`);
        });
    }
    
    // Load all .js files from commands directory
    let commandCount = 0;
    
    function loadFromDir(dir) {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                loadFromDir(fullPath);
            } else if (item.endsWith('.js')) {
                try {
                    const command = require(fullPath);
                    
                    if (command && command.name && typeof command.execute === 'function') {
                        global.commands.set(command.name.toLowerCase(), command);
                        
                        // Register aliases
                        if (command.alias && Array.isArray(command.alias)) {
                            command.alias.forEach(alias => {
                                global.commands.set(alias.toLowerCase(), command);
                            });
                        }
                        
                        commandCount++;
                        console.log(`✅ Loaded: ${command.name}`);
                    }
                } catch (error) {
                    console.log(`❌ Error loading ${item}:`, error.message);
                }
            }
        });
    }
    
    loadFromDir(commandsDir);
    console.log(`📦 Total commands loaded: ${commandCount}`);
}

// CONNECT TO WHATSAPP
async function connectToWhatsApp() {
    try {
        console.log("🔄 Connecting to WhatsApp...");
        
        // Create session directory
        const sessionDir = './session';
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Load or create session
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Try to load from Firebase
        try {
            const savedSession = await Session.get(config.sessionName);
            if (savedSession?.creds) {
                console.log("📡 Restoring session from Firebase...");
                state.creds = savedSession.creds;
            }
        } catch (error) {
            console.log("⚠️ Could not load from Firebase:", error.message);
        }
        
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "error" }),
            printQRInTerminal: true,
            browser: ["WRONG TURN 6", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 10000,
        });
        
        // Save credentials
        sock.ev.on("creds.update", async (creds) => {
            try {
                await saveCreds();
                await Session.save(config.sessionName, { creds });
                console.log("💾 Session saved");
            } catch (error) {
                console.log("⚠️ Failed to save session:", error.message);
            }
        });
        
        // Connection updates
        sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log("📱 QR Code ready for scanning");
            }
            
            if (connection === "open") {
                isConnected = true;
                console.log("✅ WHATSAPP CONNECTED!");
                console.log(`👤 Bot ID: ${sock.user.id}`);
                
                // Start presence updates
                setInterval(async () => {
                    if (sock && isConnected) {
                        try {
                            await sock.sendPresenceUpdate('available');
                        } catch (e) {
                            // Silent fail
                        }
                    }
                }, 60000);
                
                // Save bot info
                try {
                    await User.save(sock.user.id, {
                        name: sock.user.name || config.botName,
                        phone: sock.user.phone,
                        isBot: true,
                        connectedAt: new Date().toISOString()
                    });
                } catch (error) {
                    console.log("⚠️ Could not save bot info:", error.message);
                }
                
                // Send welcome to owner
                try {
                    const welcome = `🚀 *WRONG TURN 6 ACTIVATED*\n\n` +
                                   `*Status:* Connected ✅\n` +
                                   `*User:* ${sock.user.name || config.botName}\n` +
                                   `*Commands:* ${global.commands.size} loaded\n\n` +
                                   `_System ready. Use ${config.prefix}menu_`;
                    
                    await sock.sendMessage(config.ownerJid, { text: welcome });
                } catch (error) {
                    console.log("⚠️ Could not send welcome message");
                }
            }
            
            if (connection === "close") {
                isConnected = false;
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log("🔌 Connection closed:", reason || "Unknown");
                
                // Don't auto-reconnect - wait for manual restart
                console.log("⏸️ Connection closed. Restart required.");
            }
        });
        
        // Handle incoming messages
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (msg) {
                await handleMessage(msg);
            }
        });
        
        // Handle status updates
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (msg?.key?.remoteJid === 'status@broadcast') {
                try {
                    await sock.readMessages([msg.key]);
                    await sock.sendMessage(msg.key.remoteJid, {
                        react: { text: "❤️", key: msg.key }
                    });
                    console.log("👁️ Viewed and reacted to status");
                } catch (error) {
                    // Silent fail
                }
            }
        });
        
        console.log("✅ WhatsApp connection initialized");
        
    } catch (error) {
        console.log("❌ Connection error:", error.message);
        console.log("🔄 Retrying in 10 seconds...");
        setTimeout(connectToWhatsApp, 10000);
    }
}

// Handle messages
async function handleMessage(msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const pushName = msg.pushName || "User";
        const isGroup = from.endsWith('@g.us');
        
        // Extract message text
        let body = "";
        if (msg.message.conversation) body = msg.message.conversation;
        else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text;
        else if (msg.message.imageMessage?.caption) body = msg.message.imageMessage.caption;
        
        body = body.trim();
        
        // Save user to Firebase
        try {
            await User.save(sender, {
                name: pushName,
                jid: sender,
                pushName: pushName,
                lastSeen: new Date().toISOString()
            });
        } catch (error) {
            // Silent fail
        }
        
        // View-once capture
        if (msg.message.viewOnceMessage || msg.message.viewOnceMessageV2) {
            try {
                await sock.sendMessage(config.ownerJid, {
                    forward: msg,
                    caption: `🔓 View-once from ${pushName}`
                });
                await sock.sendMessage(from, {
                    text: "⚠️ View-once media captured by security"
                });
            } catch (error) {
                // Silent fail
            }
            return;
        }
        
        // Anti-link protection
        if (config.antiLink && body && /(https?:\/\/[^\s]+)/g.test(body)) {
            try {
                await sock.sendMessage(from, { delete: msg.key });
                await sock.sendMessage(from, {
                    text: `🚫 *LINK REMOVED*\nNo links allowed here.`
                });
            } catch (error) {
                // Silent fail
            }
            return;
        }
        
        // Commands
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            const command = global.commands.get(cmd);
            
            if (command) {
                console.log(`⚡ Command: ${cmd} from ${pushName}`);
                
                try {
                    await sock.sendPresenceUpdate('composing', from);
                    await command.execute(sock, msg, args);
                } catch (error) {
                    await sock.sendMessage(from, {
                        text: `❌ Error executing command: ${error.message}`
                    });
                }
            }
        }
        
    } catch (error) {
        console.log("Message handler error:", error.message);
    }
}

// Generate pairing code
async function generatePairingCode(phoneNumber) {
    try {
        if (!sock || !isConnected) {
            return { error: "Bot not connected. Please scan QR code first." };
        }
        
        // Clean and format number
        let cleanNumber = phoneNumber.replace(/\D/g, '');
        
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '255' + cleanNumber.substring(1);
        } else if (!cleanNumber.startsWith('255')) {
            cleanNumber = '255' + cleanNumber;
        }
        
        console.log(`🔐 Requesting pairing code for: ${cleanNumber}`);
        
        // Request REAL WhatsApp pairing code
        const code = await sock.requestPairingCode(cleanNumber);
        
        console.log(`✅ Generated code: ${code}`);
        
        return {
            success: true,
            code: code,
            number: cleanNumber,
            instructions: [
                "1. Open WhatsApp on your phone",
                "2. Go to Settings → Linked Devices",
                "3. Tap 'Link a Device'",
                "4. Select 'Pair with code instead'",
                `5. Enter code: ${code}`,
                "6. Wait for confirmation"
            ]
        };
        
    } catch (error) {
        console.log("❌ Pairing error:", error.message);
        return {
            error: error.message,
            solution: "Make sure the number is correct and includes country code (255 for Tanzania)"
        };
    }
}

// Web Interface
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WRONG TURN 6</title>
            <style>
                body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
                .status { padding: 15px; border-radius: 8px; margin: 20px 0; }
                .online { background: #28a745; color: white; }
                .offline { background: #dc3545; color: white; }
                .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
                input, button { padding: 10px; margin: 5px 0; width: 100%; }
                button { background: #007bff; color: white; border: none; cursor: pointer; }
                button:hover { background: #0056b3; }
                .code { font-size: 32px; font-weight: bold; color: #28a745; text-align: center; padding: 20px; }
            </style>
        </head>
        <body>
            <h1>🤖 WRONG TURN 6 BOT</h1>
            <div class="status ${isConnected ? 'online' : 'offline'}">
                <h2>Status: ${isConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}</h2>
                <p>Owner: ${config.ownerName}</p>
                <p>Commands: ${global.commands.size} loaded</p>
                ${!isConnected ? '<p>⚠️ Scan QR code in terminal to connect</p>' : ''}
            </div>
            
            <div class="card">
                <h3>🔐 GET WHATSAPP PAIRING CODE</h3>
                <form action="/pair" method="GET">
                    <input type="text" name="number" placeholder="255618558502" required>
                    <button type="submit">Generate 8-digit Code</button>
                </form>
                <p><small>Enter phone number with country code (255 for Tanzania)</small></p>
            </div>
            
            <div class="card">
                <h3>⚡ QUICK ACTIONS</h3>
                <a href="/restart"><button>🔄 Restart Bot</button></a>
                <a href="/status"><button>📊 System Status</button></a>
            </div>
            
            <div class="card">
                <h3>🔒 SECURITY FEATURES</h3>
                <ul>
                    <li>✅ Anti-Link Protection (Blocks ALL links)</li>
                    <li>✅ Real WhatsApp Pairing Codes</li>
                    <li>✅ View-Once Media Capture</li>
                    <li>✅ Auto Status View & React</li>
                    <li>✅ Force Join System</li>
                    <li>✅ Firebase Database</li>
                </ul>
            </div>
            
            <p><strong>⚠️ IMPORTANT:</strong> First time setup requires scanning QR code in terminal. After that, users can link devices with pairing codes.</p>
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
                    body { font-family: monospace; padding: 20px; }
                    .code { font-size: 36px; font-weight: bold; color: #28a745; padding: 20px; border: 2px dashed #28a745; text-align: center; margin: 20px 0; }
                    .instructions { background: #f8f9fa; padding: 15px; border-radius: 8px; }
                </style>
            </head>
            <body>
                <h1>🔐 WHATSAPP PAIRING CODE</h1>
                <p>For: ${result.number}</p>
                <div class="code">${result.code}</div>
                <p>⏰ <strong>Expires in 60 seconds</strong></p>
                
                <div class="instructions">
                    <h3>📱 INSTRUCTIONS:</h3>
                    <ol>
                        ${result.instructions.map(i => `<li>${i}</li>`).join('')}
                    </ol>
                </div>
                
                <p><a href="/">← Back to Dashboard</a></p>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <body>
                <h1>❌ ERROR</h1>
                <p>${result.error}</p>
                ${result.solution ? `<p><strong>Solution:</strong> ${result.solution}</p>` : ''}
                <p><a href="/">← Try Again</a></p>
            </body>
            </html>
        `);
    }
});

app.get("/restart", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <body>
            <h1>🔄 Restarting Bot...</h1>
            <p>Please restart manually from terminal or Render dashboard.</p>
            <p><a href="/">← Back</a></p>
        </body>
        </html>
    `);
});

app.get("/status", (req, res) => {
    res.json({
        status: isConnected ? "connected" : "disconnected",
        botId: sock?.user?.id || "Not connected",
        owner: config.ownerName,
        commands: global.commands.size,
        features: [
            "Anti-Link Protection",
            "Real Pairing Codes",
            "View-Once Capture",
            "Auto Status View",
            "Firebase Database"
        ],
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    
    // Load commands
    loadCommands();
    
    // Connect to WhatsApp
    connectToWhatsApp();
});

// Export for testing
module.exports = app;
