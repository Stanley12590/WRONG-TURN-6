const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const fs = require("fs");
const config = require("./config");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

mongoose.connect(config.mongoUri).then(() => console.log("✅ DATABASE CONNECTED"));

// Global Map for Commands
global.commands = new Map();
const loadCmds = () => {
    const folders = fs.readdirSync('./commands');
    for (const folder of folders) {
        const files = fs.readdirSync(`./commands/${folder}`).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const cmd = require(`./commands/${folder}/${file}`);
            global.commands.set(cmd.name, cmd);
        }
    }
};

let sock;

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    if (!sock.authState.creds.registered && num) {
        await delay(15000); 
        try {
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).send("Matrix Error"); }
    }

    sock.ev.on("creds.update", saveCreds);

    // 1. CONNECTION & WELCOME MESSAGE
    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 IS LIVE");
            sock.sendPresenceUpdate('available');

            // Send Professional Welcome & Manual to User
            const welcome = `🚀 *WRONG TURN 6 CONNECTED* 🚀\n\nWelcome to your Universal OS.\n\n*Developer:* STANYTZ ✔️\n*Status:* Always Online\n\n*QUICK START:*\n1. Type *.menu* to see all 500+ Hubs.\n2. Settings are AUTO-SET to Maximum Protection.\n3. Join our Channel for updates.\n\n_System fully functional._`;
            await sock.sendMessage(sock.user.id, { text: welcome });
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startEngine();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

loadCmds();
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
