const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { Session } = require("./database");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.json());

let sock;
global.commands = new Map();

// Load Modular Commands
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) {
        console.log("❌ Commands folder haipo!");
        return;
    }
    
    fs.readdirSync(cmdPath).forEach(dir => {
        const folder = path.join(cmdPath, dir);
        if (fs.statSync(folder).isDirectory()) {
            fs.readdirSync(folder).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(folder, file));
                    global.commands.set(cmd.name, cmd);
                    console.log(`✅ Command loaded: ${cmd.name}`);
                } catch (e) {
                    console.log(`❌ Error loading ${file}:`, e.message);
                }
            });
        }
    });
};

async function startEngine(num = null, res = null) {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(config.mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log("✅ Connected to MongoDB");
        }
        
        // CLOUD AUTH LOGIC
        let cloud = await Session.findOne({ id: "wt6_master_session" });
        const creds = cloud ? cloud.creds : initAuthCreds();

        sock = makeWASocket({
            auth: { 
                creds, 
                keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" })) 
            },
            logger: pino({ level: "silent" }),
            printQRInTerminal: true,
            browser: ["WRONG TURN 6", "Chrome", "20.0.04"]
        });

        sock.ev.on("creds.update", async () => {
            try {
                await Session.findOneAndUpdate(
                    { id: "wt6_master_session" }, 
                    { creds: sock.authState.creds }, 
                    { upsert: true, new: true }
                );
                console.log("✅ Credentials updated");
            } catch (e) {
                console.log("❌ Error updating creds:", e.message);
            }
        });

        if (!sock.authState.creds.registered && num) {
            try {
                await delay(3000); 
                const code = await sock.requestPairingCode(num.trim());
                if (res) res.json({ code, success: true });
            } catch (e) { 
                console.log("❌ Pairing error:", e);
                if (res) res.status(500).json({ error: "Pairing failed", details: e.message });
            }
        }

        sock.ev.on("connection.update", async (u) => {
            const { connection, lastDisconnect, qr } = u;
            
            if (qr) {
                console.log("📱 Scan QR code with WhatsApp");
            }
            
            if (connection === "open") {
                console.log("✅ WRONG TURN 6 CONNECTED");
                await sock.sendPresenceUpdate('available');
                const welcome = `🚀 *WRONG TURN 6 IS LIVE* 🚀\n\nWelcome Master *STANYTZ*.\n\n*STATUS:* Cloud Secured ✅\n*IDENTITY:* Verified ✔️\n\n_System is active. Use .menu to explore._`;
                await sock.sendMessage(sock.user.id, { text: welcome });
            }
            
            if (connection === "close") {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`❌ Connection closed. Reconnect: ${shouldReconnect}`);
                if (shouldReconnect) {
                    setTimeout(() => startEngine(), 5000);
                }
            }
        });

        sock.ev.on("messages.upsert", async ({ messages }) => {
            if (messages && messages[0]) {
                await commandHandler(sock, messages[0]);
            }
        });

    } catch (error) {
        console.log("❌ FATAL ERROR:", error);
        if (res) res.status(500).json({ error: "System error" });
    }
}

loadCommands();

// Routes
app.get("/", (req, res) => {
    res.send(`
        <h1>WRONG TURN 6 BOT</h1>
        <p>Status: ${sock?.user ? "Connected ✅" : "Disconnected ❌"}</p>
        <a href="/get-code?num=${config.ownerNumber}">Get Pairing Code</a>
    `);
});

app.get("/get-code", async (req, res) => {
    const { num } = req.query;
    if (!num) return res.status(400).json({ error: "Number required" });
    await startEngine(num, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startEngine(); // Start without pairing
});
