module.exports = {
    // Bot Identity
    botName: "WRONG TURN 6",
    ownerName: "STANYTZ",
    ownerNumber: "255618558502@s.whatsapp.net",
    ownerJid: "255618558502@s.whatsapp.net",
    prefix: ".",
    
    // Session
    sessionName: "wt6_master_session",
    
    // Security
    antiLink: true,
    antiDelete: true,
    swearFilter: true,
    viewOnceCapture: true,
    autoTyping: true,
    autoStatusView: true,
    
    // Force Join
    forceJoin: {
        enabled: true,
        groupLink: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
        channelLink: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
        groupId: "120363302194515518@g.us"
    },
    
    // Server
    port: process.env.PORT || 3000,
    
    // Swear words
    swearWords: ['mavi', 'kuma', 'mate', 'chuma', 'mnyiri', 'mtama']
};
