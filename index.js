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
    console.log(`✅ ${global.commands.size} Commands Operational.`);
};

async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_wt6_matrix" });
    const creds = session ? session.creds : initAuthCreds();
    return {
        state: { creds, keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" })) },
        saveCreds: async () => {
            await Session.findOneAndUpdate({ id: "stanytz_wt6_matrix" }, { creds }, { upsert: true });
        }
    };
}

async function startEngine(num = null, res = null) {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(config.mongoUri);
    const { state, saveCreds } = await useMongoDBAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered && num) {
        try {
            await delay(15000); // 15s delay to fix Precondition/FAIL errors
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) res.json({ code });
        } catch (e) {
            if (res && !res.headersSent) res.status(500).json({ error: "System Busy" });
        }
    }

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 CONNECTED");
            await sock.sendPresenceUpdate('available');
            const welcome = `🚀 *WRONG TURN 6 IS LIVE* 🚀\n\n*Developer:* STANYTZ ✔️\n*Status:* Cloud Secured ✅\n\n*SYSTEM READY:*\n1. Type *.menu* to see 500+ Hubs.\n2. Commands for Hackers, Students, and Bettors are active.\n3. Anti-Delete & View-Once are [ENABLED].\n\n_Enjoy the Matrix._`;
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
