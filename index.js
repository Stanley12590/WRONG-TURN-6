const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { Session } = require("./database");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

let sock;

// --- CLOUD AUTH STATE (MongoDB) ---
async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_wt6" });
    
    // Kama hakuna session, tengeneza creds mpya
    const creds = session ? session.creds : require("@whiskeysockets/baileys").AuthUtils.initAuthCreds();

    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
        },
        saveCreds: async () => {
            await Session.findOneAndUpdate(
                { id: "stanytz_wt6" },
                { creds },
                { upsert: true }
            );
        }
    };
}

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMongoDBAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    // PAIRING LOGIC (Fixed for Precondition Error)
    if (!sock.authState.creds.registered && num) {
        try {
            await delay(15000); // 15s stabilize
            // Futa session iliyofeli kwanza ili kuzuia 'Precondition Required'
            if (sock.authState.creds.pairingCode) delete sock.authState.creds.pairingCode;
            
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) res.json({ code });
        } catch (e) {
            if (res && !res.headersSent) res.status(500).json({ error: "Cloud busy. Retry in 30s" });
        }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: CLOUD CONNECTED!");
            sock.sendPresenceUpdate('available');
            await sock.sendMessage(sock.user.id, { text: "✅ *WRONG TURN 6 CONNECTED TO CLOUD*\n\nYour session is now safely stored in MongoDB Atlas." });
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
