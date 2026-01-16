require('dotenv').config();

module.exports = {
    // Bot Identity
    botName: process.env.BOT_NAME || "WRONG TURN 6",
    developer: process.env.DEVELOPER || "STANYTZ",
    prefix: process.env.PREFIX || ".",
    ownerNumber: process.env.OWNER_NUMBER || "255618558502",
    
    // Database
    mongoUri: process.env.MONGO_URI,
    
    // Social Links
    channelLink: process.env.CHANNEL_LINK,
    groupLink: process.env.GROUP_LINK,
    groupId: process.env.GROUP_ID,
    menuImage: process.env.MENU_IMAGE,
    
    // Web App
    appUrl: process.env.APP_URL || "http://localhost:3000",
    
    // Security
    sessionSecret: process.env.SESSION_SECRET,
    apiKey: process.env.API_KEY,
    
    // Bot Settings
    maxSessions: 350, // Maximum user sessions allowed
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 350 // limit each IP to 100 requests per windowMs
    }
};
