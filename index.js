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
app.use(express.static('public'));

let sock;
global.commands = new Map();

// Dynamic Command Loader
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) return;
    fs.readdirSync(cmdPath).forEach(dir => {
        const folder = path.join(cmdPath, dir);
        if (fs.statSync(folder).isDirectory()) {
            fs.readdirSync(folder).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(folder, file));
                global.commands.set(cmd.name, cmd);
            });
        }
    });
};

async function startEngine(num = null, res = null) {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(config.mongoUri);
    
    // MONGODB AUTH LOGIC (No Local Files)
    let cloud = await Session.findOne({ id: "stanytz_matrix_session" });
    const creds = cloud ? cloud.creds : initAuthCreds();

    sock = makeWASocket({
        auth: { creds, keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["WRONG TURN 6", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    sock.ev.on("creds.update", async () => {
        await Session.findOneAndUpdate({ id: "stanytz_matrix_session" }, { creds: sock.authState.creds }, { upsert: true });
    });

    if (!sock.authState.creds.registered && num) {
        await delay(15000); // 15s delay to fix FAIL error
        try {
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).json({ error: "Matrix Choked" }); }
    }

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ WRONG TURN 6 CONNECTED");
            await sock.sendPresenceUpdate('available');
            const welcome = `🚀 *WRONG TURN 6 CONNECTED* 🚀\n\nWelcome Master *STANYTZ*.\n\n*STATUS:* Cloud Secured ✅\n*IDENTITY:* Verified Identity ✔️\n\n_System active. Type .menu to begin._`;
            await sock.sendMessage(sock.user.id, { text: welcome });
        }
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startEngine();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

loadCommands();
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(process.env.PORT || 3000, () => startEngine());
