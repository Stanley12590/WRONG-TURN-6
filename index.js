const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const fs = require("fs");
const config = require("./config");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

mongoose.connect(config.mongoUri).then(() => console.log("✅ MATRIX DB CONNECTED"));

// Global Loader
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

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    if (!sock.authState.creds.registered && num) {
        await delay(12000); 
        try {
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).send("FAILED"); }
    }

    sock.ev.on("creds.update", saveCreds);

    // WELCOME LOGIC AFTER SUCCESSFUL LINK
    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: CONNECTED AND DANGEROUS!");
            sock.sendPresenceUpdate('available'); // Always Online

            const welcomeMsg = `🚀 *WRONG TURN 6 CONNECTED SUCCESSFULLY!* 🚀\n\nDeveloper: *STANYTZ* ✔️\nStatus: *Always Online* ✅\n\n*USER MANUAL:*\n1. Use *.menu* to see all 500+ Hubs.\n2. Settings (Anti-Link, Anti-Delete) are AUTO-ENABLED.\n3. Type *.settings* to customize.\n\n_System fully operational._`;
            await sock.sendMessage(sock.user.id, { text: welcomeMsg });
        }
        if (connection === "close") startEngine();
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

loadCmds();
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
