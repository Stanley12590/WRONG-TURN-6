const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { Session, User, Group } = require("./firebase");

const app = express();
app.use(express.json());
app.use(express.static('public'));

let sock = null;
let isConnected = false;
global.commands = new Map();

// Load commands
function loadCommands() {
    const cmdPath = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(cmdPath)) {
        fs.mkdirSync(cmdPath, { recursive: true });
        console.log("📁 Created commands folder");
        
        // Create basic commands
        const basicCmds = {
            'menu.js': `module.exports = {
                name: "menu",
                alias: ["help"],
                async execute(sock, msg, args) {
                    const menu = "🤖 *WRONG TURN 6 BOT*\\n\\n" +
                                "Owner: STANYTZ\\n" +
                                "Prefix: .\\n\\n" +
                                "🔒 Features:\\n" +
                                "✅ Anti-Link\\n" +
                                "✅ Auto Status\\n" +
                                "✅ View-Once Capture\\n\\n" +
                                "_Use .pair <number> to link device_";
                    await sock.sendMessage(msg.key.remoteJid, { text: menu });
                }
            };`,
            
            'ping.js': `module.exports = {
                name: "ping",
                async execute(sock, msg, args) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: "🏓 PONG! Bot is active"
                    });
                }
            };`,
            
            'pair.js': `module.exports = {
                name: "pair",
                alias: ["link"],
                async execute(sock, msg, args) {
                    const from = msg.key.remoteJid;
                    const sender = msg.key.participant || from;
                    
                    if (sender !== "255618558502@s.whatsapp.net") {
                        return sock.sendMessage(from, {
                            text: "❌ Only owner can generate codes"
                        });
                    }
                    
                    const num = args[0];
                    if (!num) {
                        return sock.sendMessage(from, {
                            text: "Usage: .pair 255618558502"
                        });
                    }
                    
                    try {
                        const code = await sock.requestPairingCode(num.replace(/\\D/g, ''));
                        await sock.sendMessage(from, {
                            text: \`🔐 Pairing Code: \${code}\\nFor: \${num}\\nExpires in 60s\`
                        });
                    } catch (e) {
                        await sock.sendMessage(from, {
                            text: \`❌ Error: \${e.message}\`
                        });
                    }
                }
            };`
        };
        
        Object.entries(basicCmds).forEach(([file, content]) => {
            fs.writeFileSync(path.join(cmdPath, file), content);
        });
    }
    
    // Load commands
    const files = fs.readdirSync(cmdPath).filter(f => f.endsWith('.js'));
    
    files.forEach(file => {
        try {
            const cmd = require(path.join(cmdPath, file));
            if (cmd.name) {
                global.commands.set(cmd.name.toLowerCase(), cmd);
                console.log(`✅ Loaded: ${cmd.name}`);
            }
        } catch (e) {
            console.log(`❌ Error loading ${file}:`, e.message);
        }
    });
    
    console.log(`📦 Commands: ${global.commands.size}`);
}

// Connect to WhatsApp
async function connectToWhatsApp() {
    try {
        console.log("🔄 Connecting to WhatsApp...");
        
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            browser: ["WRONG TURN 6", "Chrome", "20.0.04"],
        });
        
        sock.ev.on("creds.update", saveCreds);
        
        sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "open") {
                isConnected = true;
                console.log("✅ CONNECTED!");
                console.log(`👤 Bot ID: ${sock.user.id}`);
                
                // Send welcome
                sock.sendMessage("255618558502@s.whatsapp.net", {
                    text: "🚀 WRONG TURN 6 is now ONLINE!"
                });
            }
            
            if (connection === "close") {
                isConnected = false;
                console.log("🔌 Connection closed");
                
                // Auto reconnect
                setTimeout(connectToWhatsApp, 5000);
            }
        });
        
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || from;
            const pushName = msg.pushName || "User";
            
            // Extract text
            let body = "";
            if (msg.message.conversation) body = msg.message.conversation;
            else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text;
            
            body = body.trim();
            
            // Save user
            await User.save(sender, {
                name: pushName,
                jid: sender,
                lastSeen: new Date().toISOString()
            });
            
            // Anti-link
            if (body && /(https?:\/\/[^\s]+)/g.test(body)) {
                await sock.sendMessage(from, { delete: msg.key });
                await sock.sendMessage(from, {
                    text: "🚫 Links are not allowed"
                });
                return;
            }
            
            // Commands
            if (body.startsWith(".")) {
                const args = body.slice(1).trim().split(/ +/);
                const cmd = args.shift().toLowerCase();
                const command = global.commands.get(cmd);
                
                if (command) {
                    console.log(`⚡ Command: ${cmd} from ${pushName}`);
                    await command.execute(sock, msg, args);
                }
            }
        });
        
    } catch (error) {
        console.log("❌ Connection error:", error.message);
        setTimeout(connectToWhatsApp, 10000);
    }
}

// Web interface for pairing codes
app.get("/", (req, res) => {
    res.send(`
        <html>
        <body>
            <h1>🤖 WRONG TURN 6</h1>
            <p>Status: ${isConnected ? '🟢 ONLINE' : '🔴 OFFLINE'}</p>
            <p>Owner: STANYTZ</p>
            <p>Features: Anti-Link, Auto Status, View-Once</p>
            <p>Bot ID: ${sock?.user?.id || 'Not connected'}</p>
        </body>
        </html>
    `);
});

app.get("/pair", async (req, res) => {
    const num = req.query.number;
    
    if (!num) {
        return res.send("❌ Number required: /pair?number=255618558502");
    }
    
    if (!sock || !isConnected) {
        return res.send("❌ Bot not connected");
    }
    
    try {
        const cleanNum = num.replace(/\D/g, '');
        const formattedNum = cleanNum.startsWith('255') ? cleanNum : `255${cleanNum}`;
        
        const code = await sock.requestPairingCode(formattedNum);
        
        res.send(`
            <html>
            <body>
                <h1>🔐 WHATSAPP PAIRING CODE</h1>
                <p>For: ${formattedNum}</p>
                <h2 style="color: green; font-size: 32px;">${code}</h2>
                <p>⏰ Expires in 60 seconds</p>
                <ol>
                    <li>Open WhatsApp → Settings → Linked Devices</li>
                    <li>Tap "Link a Device"</li>
                    <li>Select "Pair with code instead"</li>
                    <li>Enter code: <strong>${code}</strong></li>
                </ol>
            </body>
            </html>
        `);
    } catch (error) {
        res.send(`❌ Error: ${error.message}`);
    }
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    loadCommands();
    connectToWhatsApp();
});
