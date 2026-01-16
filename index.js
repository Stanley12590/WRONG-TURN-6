require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Import config and database
const config = require('./config');
const { connectDB, Session, User, Log } = require('./database');
const { createBotSession } = require('./bot-manager');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https://i.ibb.co"],
            connectSrc: ["'self'"],
        }
    }
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Global variables
global.activeBots = new Map();
global.commands = new Map();

// Connect to Database
connectDB();

// Load Commands
const loadCommands = () => {
    const commandsPath = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsPath)) {
        console.log('📁 Creating commands directory...');
        fs.mkdirSync(commandsPath, { recursive: true });
        
        // Create example commands
        const exampleMenu = `
module.exports = {
    name: 'menu',
    description: 'Show bot menu',
    category: 'owner',
    
    async execute(sock, msg, args, sessionData) {
        const from = msg.key.remoteJid;
        await sock.sendMessage(from, {
            text: \`*WRONG TURN 6 BOT*\\n\\n👑 Developer: STANYTZ\\n📱 User: \${sessionData?.phoneNumber || 'Unknown'}\\n⚡ Prefix: .\\n\\nType .help for all commands\`
        });
    }
};
        `;
        
        const examplePing = `
module.exports = {
    name: 'ping',
    description: 'Check bot response time',
    category: 'public',
    
    async execute(sock, msg) {
        const start = Date.now();
        await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
        
        const end = Date.now();
        const latency = end - start;
        
        await sock.sendMessage(msg.key.remoteJid, {
            text: \`🏓 *PONG!*\\n\\n📶 Latency: *\${latency}ms*\\n🕐 Server Time: *\${new Date().toLocaleTimeString()}*\`
        });
    }
};
        `;
        
        // Create folders
        fs.mkdirSync(path.join(commandsPath, 'owner'), { recursive: true });
        fs.mkdirSync(path.join(commandsPath, 'public'), { recursive: true });
        fs.mkdirSync(path.join(commandsPath, 'admin'), { recursive: true });
        
        // Write example commands
        fs.writeFileSync(path.join(commandsPath, 'owner', 'menu.js'), exampleMenu, 'utf8');
        fs.writeFileSync(path.join(commandsPath, 'public', 'ping.js'), examplePing, 'utf8');
        fs.writeFileSync(path.join(commandsPath, 'public', 'help.js'), '// Help command', 'utf8');
        
        console.log('✅ Created example command structure');
    }
    
    // Load all commands
    let commandCount = 0;
    
    const loadFolder = (folderPath) => {
        const items = fs.readdirSync(folderPath);
        
        items.forEach(item => {
            const fullPath = path.join(folderPath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                loadFolder(fullPath);
            } else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const command = require(fullPath);
                    
                    if (command && command.name && command.execute) {
                        global.commands.set(command.name.toLowerCase(), command);
                        commandCount++;
                        console.log(`✅ Loaded command: ${command.name}`);
                    }
                } catch (error) {
                    console.error(`❌ Error loading ${item}:`, error.message);
                }
            }
        });
    };
    
    loadFolder(commandsPath);
    console.log(`📦 Total commands loaded: ${commandCount}`);
};

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        botName: config.botName,
        developer: config.developer,
        activeSessions: global.activeBots.size,
        totalCommands: global.commands.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({ status: 'active' }).limit(50);
        res.json({
            count: sessions.length,
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                userId: s.userId,
                phoneNumber: s.phoneNumber,
                connectedAt: s.connectionInfo?.connectedAt,
                lastSeen: s.connectionInfo?.lastSeen
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pair', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        
        // Validate phone number format
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }
        
        // Check existing active session
        const existingSession = await Session.findOne({ 
            phoneNumber: cleanNumber,
            status: 'active',
            expiresAt: { $gt: new Date() }
        });
        
        if (existingSession) {
            return res.json({
                status: 'already_connected',
                message: 'Bot is already connected with this number',
                sessionId: existingSession.sessionId
            });
        }
        
        // Check max sessions limit
        const activeSessionsCount = await Session.countDocuments({ 
            status: 'active',
            expiresAt: { $gt: new Date() }
        });
        
        if (activeSessionsCount >= config.maxSessions) {
            return res.status(429).json({ 
                error: 'Maximum session limit reached. Please try again later.' 
            });
        }
        
        // Generate session ID
        const sessionId = `wt6_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Generate random pairing code (6 digits)
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save session to database
        const newSession = new Session({
            sessionId,
            userId: `${cleanNumber}@s.whatsapp.net`,
            phoneNumber: cleanNumber,
            creds: {}, // Will be updated when connected
            status: 'pending',
            pairingCode,
            connectionInfo: {
                device: 'WhatsApp Web',
                platform: 'Web'
            },
            expiresAt: new Date(Date.now() + config.sessionTimeout)
        });
        
        await newSession.save();
        
        // Create or update user
        await User.findOneAndUpdate(
            { userId: `${cleanNumber}@s.whatsapp.net` },
            {
                userId: `${cleanNumber}@s.whatsapp.net`,
                phoneNumber: cleanNumber,
                name: `User_${cleanNumber.slice(-4)}`,
                'stats.lastActive': new Date()
            },
            { upsert: true, new: true }
        );
        
        // Log the pairing request
        await Log.create({
            type: 'pairing',
            sessionId,
            userId: `${cleanNumber}@s.whatsapp.net`,
            details: { 
                phoneNumber: cleanNumber, 
                status: 'pending',
                pairingCode: pairingCode 
            }
        });
        
        res.json({
            success: true,
            sessionId,
            pairingCode,
            message: `Pairing code generated for ${cleanNumber}`,
            instructions: 'Open WhatsApp → Linked Devices → Link a Device → Enter this code'
        });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/check-pairing/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Check if session expired
        if (session.expiresAt < new Date()) {
            session.status = 'expired';
            await session.save();
            
            // Remove from active bots if exists
            if (global.activeBots.has(sessionId)) {
                const bot = global.activeBots.get(sessionId);
                if (bot.socket) {
                    await bot.socket.logout();
                    await bot.socket.end();
                }
                global.activeBots.delete(sessionId);
            }
            
            return res.json({
                status: 'expired',
                message: 'Session has expired. Please generate a new code.'
            });
        }
        
        // If session is marked as active, start bot
        if (session.status === 'active' && !global.activeBots.has(sessionId)) {
            try {
                await startBotForSession(session);
            } catch (error) {
                console.error('Error starting bot:', error);
            }
        }
        
        // Check if bot is actually connected
        const isConnected = global.activeBots.has(sessionId);
        
        if (isConnected) {
            // Update last seen
            session.connectionInfo.lastSeen = new Date();
            await session.save();
        }
        
        res.json({
            status: session.status,
            connected: isConnected,
            pairingCode: session.pairingCode,
            message: session.status === 'active' ? 'Bot is connected!' : 'Waiting for pairing...'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/disconnect/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Disconnect bot if active
        if (global.activeBots.has(sessionId)) {
            const bot = global.activeBots.get(sessionId);
            try {
                if (bot.socket) {
                    await bot.socket.logout();
                    await bot.socket.end();
                }
            } catch (error) {
                console.error('Error during disconnect:', error);
            }
            global.activeBots.delete(sessionId);
        }
        
        // Update session status
        session.status = 'inactive';
        session.expiresAt = new Date();
        await session.save();
        
        // Log disconnect
        await Log.create({
            type: 'connection',
            sessionId,
            userId: session.userId,
            details: { action: 'disconnect', status: 'inactive' }
        });
        
        res.json({
            success: true,
            message: 'Bot disconnected successfully'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// WebSocket connection for real-time updates
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    socket.on('join-session', async (sessionId) => {
        socket.join(sessionId);
        const session = await Session.findOne({ sessionId });
        
        if (session) {
            socket.emit('session-update', {
                status: session.status,
                pairingCode: session.pairingCode,
                connected: global.activeBots.has(sessionId)
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Serve Web Interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start all active sessions on server start
async function initializeActiveSessions() {
    try {
        const activeSessions = await Session.find({ 
            status: 'active',
            expiresAt: { $gt: new Date() }
        }).limit(config.maxSessions);
        
        console.log(`🔄 Initializing ${activeSessions.length} active sessions...`);
        
        for (const session of activeSessions) {
            try {
                await startBotForSession(session);
                console.log(`✅ Started bot for: ${session.phoneNumber}`);
            } catch (error) {
                console.error(`❌ Failed to start session ${session.sessionId}:`, error.message);
                session.status = 'inactive';
                await session.save();
            }
        }
        
        console.log('✅ All active sessions initialized');
    } catch (error) {
        console.error('❌ Error initializing sessions:', error);
    }
}

// Start bot for a specific session
async function startBotForSession(session) {
    try {
        const bot = await createBotSession(session);
        
        if (bot) {
            global.activeBots.set(session.sessionId, bot);
            
            // Update session status
            session.status = 'active';
            session.connectionInfo.connectedAt = new Date();
            session.connectionInfo.lastSeen = new Date();
            await session.save();
            
            // Emit WebSocket event
            io.to(session.sessionId).emit('session-update', {
                status: 'connected',
                message: 'Bot is now active!',
                connected: true
            });
            
            // Log connection
            await Log.create({
                type: 'connection',
                sessionId: session.sessionId,
                userId: session.userId,
                details: { action: 'connect', status: 'active' }
            });
            
            console.log(`🤖 Bot started for ${session.phoneNumber}`);
            return bot;
        }
    } catch (error) {
        console.error(`❌ Error starting bot for session ${session.sessionId}:`, error);
        throw error;
    }
}

// Load commands
loadCommands();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ${config.botName} Server running on port ${PORT}`);
    console.log(`👑 Developer: ${config.developer}`);
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    
    // Initialize active sessions
    setTimeout(() => initializeActiveSessions(), 2000);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    
    // Disconnect all active bots
    for (const [sessionId, bot] of global.activeBots.entries()) {
        try {
            if (bot.socket) {
                await bot.socket.logout();
                await bot.socket.end();
            }
        } catch (error) {
            console.error(`Error disconnecting session ${sessionId}:`, error);
        }
    }
    
    process.exit(0);
});

// Export for testing
module.exports = { app, server };
