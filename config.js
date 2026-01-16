require('dotenv').config();

module.exports = {
    // Bot Identity
    botName: process.env.BOT_NAME || "WRONG TURN 6",
    developer: process.env.DEVELOPER || "STANYTZ",
    prefix: process.env.PREFIX || ".",
    ownerNumber: process.env.OWNER_NUMBER || "255618558502",
    
    // Database
    mongoUri: process.env.MONGO_URI || "mongodb+srv://stanytz076:stanytz076@cluster0.ennpt6t.mongodb.net/WrongTurn6?retryWrites=true&w=majority",
    
    // Social Links (MUST BE JOINED TO USE BOT)
    channelLink: process.env.CHANNEL_LINK || "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
    groupLink: process.env.GROUP_LINK || "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
    groupId: process.env.GROUP_ID || "120363302194515518@g.us",
    
    // Images
    menuImage: process.env.MENU_IMAGE || "https://i.ibb.co/vz6mD7y/wrongturn.jpg",
    
    // Server Port
    port: process.env.PORT || 3001  // Changed to 3001
};
