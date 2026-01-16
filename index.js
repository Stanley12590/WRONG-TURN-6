const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { Session, User } = require("./database");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

let sock;

// --- CLOUD AUTH STORAGE (No Local Files) ---
async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_wt6_session" });
    const creds = session ? session.creds : require("@whiskeysockets/baileys").AuthUtils.initAuthCreds();

    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
        },
        saveCreds: async () => {
            await Session.findOneAndUpdate(
                { id: "stanytz_wt6_session" },
                { creds },
                { upsert: true }
            );
        }
    };
}

async function startEngine(num = null, res = null) {
    // Connect to DB first to avoid MongooseError
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(config.mongoUri);
    }

    const { state, saveCreds } = await useMongoDBAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Safe for iPhone
        syncFullHistory: true
    });

    // PAIRING LOGIC (Fixed for Fail/Precondition)
    if (!sock.authState.creds.registered && num) {
        try {
            await delay(15000); // 15s delay for system stability
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) res.json({ code });
        } catch (e) {
            if (res && !res.headersSent) res.status(500).json({ error: "System Busy. Retry in 1 min." });
        }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: ONLINE");
            // Welcome Manual to User
            const manual = `🚀 *WRONG TURN 6 CONNECTED* 🚀\n\nWelcome Master *STANYTZ*.\n\n*MANUAL:*\n1. .menu - View Hubs.\n2. .settings - Bot Config.\n3. Anti-Delete & View-Once: [ACTIVE] ✔️\n\n*Status:* Always Online (Cloud Sync)`;
            await sock.sendMessage(sock.user.id, { text: manual });
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

app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
