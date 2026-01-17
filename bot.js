const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, BufferJSON } = require("@whiskeysockets/baileys");
const admin = require("firebase-admin");
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const pino = require("pino");

// 1. Firebase Initialization
const serviceAccount = { /* Paste your JSON here */ };
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://stanybots.firebaseio.com"
});
const db = admin.firestore();

// 2. Command Loader
const commands = [];
const loadCommands = () => {
    const folders = fs.readdirSync('./commands');
    for (const folder of folders) {
        const files = fs.readdirSync(`./commands/${folder}`).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const cmd = require(`./commands/${folder}/${file}`);
            cmd.category = folder;
            commands.push(cmd);
        }
    }
};
loadCommands();

// 3. Express Server
const app = express();
app.use(express.static('public'));

async function startBot() {
    const { useFirebaseAuthState } = require("./lib/firestoreAuth");
    const { state, saveCreds } = await useFirebaseAuthState(db.collection("sessions").doc("WRONG_TURN_6"));

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Pairing Code Request
    app.get('/code', async (req, res) => {
        let num = req.query.number;
        if (!num) return res.status(400).json({ error: "Number required" });
        let code = await sock.requestPairingCode(num);
        res.json({ code });
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m.message) return;
        const msgText = m.message.conversation || m.message.extendedTextMessage?.text || "";

        // SECURITY: Anti-Link
        if (msgText.includes("chat.whatsapp.com")) {
            await sock.sendMessage(m.key.remoteJid, { delete: m.key });
            return;
        }

        // COMMAND HANDLER
        const prefix = ".";
        if (msgText.startsWith(prefix)) {
            const args = msgText.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = commands.find(c => c.name === commandName);
            if (command) await command.execute(m, sock, commands, args);
        }
    });

    // SECURITY: Anti-Call
    sock.ev.on('call', async (call) => {
        if (call[0].status === 'offer') {
            await sock.rejectCall(call[0].id, call[0].from);
            await sock.sendMessage(call[0].from, { text: "⚠️ *WRONG TURN 6 SECURITY:* Calls are blocked by STANYTZ." });
        }
    });

    // Always Online
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log("WRONG TURN 6 IS ONLINE");
            sock.sendPresenceUpdate('available');
        }
    });
}

app.listen(3000, () => {
    console.log("Server running on Port 3000");
    startBot();
});
