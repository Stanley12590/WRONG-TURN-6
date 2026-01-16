require('dotenv').config();

module.exports = {
    botName: process.env.BOT_NAME || "WRONG TURN 6",
    developer: process.env.DEVELOPER || "STANYTZ",
    prefix: process.env.PREFIX || ".",
    ownerNumber: process.env.OWNER_NUMBER || "255618558502",
    mongoUri: process.env.MONGO_URI,
    channelLink: process.env.CHANNEL_LINK,
    groupLink: process.env.GROUP_LINK,
    groupId: process.env.GROUP_ID,
    menuImage: process.env.MENU_IMAGE,
    port: process.env.PORT || 3000
};
