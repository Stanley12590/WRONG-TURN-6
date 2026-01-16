const { 
    default: makeWASocket, useMultiFileAuthState, delay, 
    makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds 
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { commandHandler } = require("./handler");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static('public'));

let sock;
global.commands = new Map();

// 1. DYNAMIC COMMAND LOADER
const loadCommands = () => {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return;
    const folders = fs.readdirSync(commandsPath);
    for (const folder of folders) {
        const folderPath = path.join(commandsPath, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
            for (const file of files) {
                const cmd = require(path.join(folderPath, file));
                global.commands.set(cmd.name, cmd);
            }
        }
    }
    console.log(`✅ MATRIX: ${global.commands.size} Commands Loaded.`);
};

// 2. MAIN BOT FUNCTION
async function startBot(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        // HII NDIO SIRI: Browser Identity ya Mac OS haigomi ku-link
        browser: ["Mac OS", "Chrome", "10.15.7"],
        syncFullHistory: true
    });

    // PAIRING CODE LOGIC (Neural Optimized)
    if (!sock.authState.creds.registered && num) {
        try {
            await delay(10000); // Wait for Render to wake up
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) {
                return res.json({ code: code });
            }
        } catch (e) {
            console.error("Pairing Error:", e);
            if (res && !res.headersSent) return res.status(500).json({ error: "System Busy. Retry." });
        }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: CONNECTED SUCCESSFULLY!");
            await sock.sendPresenceUpdate('available'); 
            // Welcome Message to Owner
            const manual = `🚀 *WRONG TURN 6 CONNECTED* 🚀\n\nWelcome Master *STANYTZ*.\n\n*SYSTEM STATUS:* ONLINE ✅\n*MODE:* Overlord\n\n_Type .menu to start the Matrix._`;
            await sock.sendMessage(sock.user.id, { text: manual });
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

// 3. API ENDPOINTS
app.get("/get-code", async (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).send("No Number");
    // Futa session ya zamani kama haikukamilika ili kuzuia error
    if (fs.existsSync('./session_wt6')) {
        console.log("Cleaning old session artifacts...");
    }
    await startBot(num, res);
});

loadCommands();
const PORT = process.env.PORT || 3000;
mongoose.connect(config.mongoUri).then(() => {
    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);
        startBot();
    });
});
