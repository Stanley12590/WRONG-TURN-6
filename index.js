const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    delay, 
    makeCacheableSignalKeyStore, 
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { commandHandler } = require("./handler");

const app = express();
const port = process.env.PORT || 3000;
app.use(express.static('public'));

// 1. DATABASE CONNECTION
mongoose.connect(config.mongoUri)
    .then(() => console.log("✅ WRONG TURN 6: DATABASE MATRIX CONNECTED"))
    .catch(err => console.error("❌ DATABASE ERROR:", err));

// 2. GLOBAL COMMAND LOADER (Inasoma Folders zote)
global.commands = new Map();
const loadCommands = () => {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);

    const categories = fs.readdirSync(commandsPath);
    for (const category of categories) {
        const categoryPath = path.join(commandsPath, category);
        if (fs.statSync(categoryPath).isDirectory()) {
            const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
            for (const file of files) {
                const cmd = require(path.join(categoryPath, file));
                global.commands.set(cmd.name, cmd);
            }
        }
    }
    console.log(`📦 MATRIX RELOADED: ${global.commands.size} Commands Active`);
};

let sock; // Global socket variable

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Safest for iPhone
        syncFullHistory: true
    });

    // --- PAIRING CODE LOGIC (FIXED FOR FAIL ERROR) ---
    if (!sock.authState.creds.registered && num) {
        try {
            console.log(`STANYTZ: Requesting Pairing Code for ${num}...`);
            await delay(15000); // 15 Seconds is CRITICAL for Render to stabilize
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) {
                res.json({ code: code });
            }
        } catch (error) {
            console.error("❌ Pairing Error:", error.message);
            if (res && !res.headersSent) {
                res.status(500).json({ code: "RETRY", error: "System Busy. Wait 30s." });
            }
        }
    }

    sock.ev.on("creds.update", saveCreds);

    // --- CONNECTION STATUS ---
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 IS LIVE AND DANGEROUS!");
            sock.sendPresenceUpdate('available'); // Always Online
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting Neural Engine...");
                startEngine();
            }
        }
    });

    // --- MESSAGE UPSERT (Passes to Handler) ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

// 3. API ENDPOINTS FOR WEB UI
app.get("/get-code", (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).json({ error: "Provide Number!" });
    startEngine(num, res);
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

// 4. BOOT SYSTEM
loadCommands();
app.listen(port, () => {
    console.log(`📡 Matrix Web Server Active on Port ${port}`);
    startEngine(); // Initial master launch
});
