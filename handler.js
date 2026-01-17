const config = require("./config");
const { User, Group, MessageLog } = require("./firebase");

// DETECTION FUNCTIONS
const containsLink = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
};

const containsSwearWord = (text) => {
    if (!text || !config.swearFilter) return false;
    const words = text.toLowerCase().split(/\s+/);
    return config.swearWords.some(swear => 
        words.includes(swear.toLowerCase()) || 
        text.toLowerCase().includes(swear.toLowerCase())
    );
};

const isAllowedDomain = (url) => {
    try {
        const domain = new URL(url).hostname;
        return config.allowedDomains.some(allowed => 
            domain.includes(allowed) || domain.endsWith(allowed)
        );
    } catch (e) {
        return false;
    }
};

const extractText = (msg) => {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
    if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
    if (msg.message?.documentMessage?.caption) return msg.message.documentMessage.caption;
    return "";
};

// AUTO REPLY SYSTEM
const autoReply = async (sock, msg, from, sender) => {
    if (!config.autoReply.enabled) return;
    
    const text = extractText(msg).toLowerCase();
    
    // Greeting responses
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
        await sock.sendPresenceUpdate('composing', from);
        await delay(1000);
        await sock.sendMessage(from, { 
            text: `👋 ${config.autoReply.greeting}` 
        });
        return;
    }
    
    // Common questions
    const responses = {
        'name': `I'm ${config.botName}, created by ${config.ownerName}`,
        'owner': `My owner is ${config.ownerName}`,
        'help': `Use ${config.prefix}menu to see all commands`,
        'time': `Current time: ${new Date().toLocaleTimeString()}`,
        'date': `Today is: ${new Date().toLocaleDateString()}`
    };
    
    for (const [keyword, response] of Object.entries(responses)) {
        if (text.includes(keyword)) {
            await sock.sendPresenceUpdate('typing', from);
            await delay(800);
            await sock.sendMessage(from, { text: response });
            break;
        }
    }
};

// VOICE NOTE HANDLER
const handleVoiceNote = async (sock, msg, from) => {
    if (msg.message?.audioMessage) {
        await sock.sendMessage(from, {
            text: `🎤 I received your voice note! (Duration: ${msg.message.audioMessage.seconds || 0}s)`
        });
    }
};

// IMAGE ANALYSIS (Porn detection placeholder)
const analyzeImage = async (sock, msg, from, sender) => {
    if (!config.antiPorn) return false;
    
    if (msg.message?.imageMessage) {
        // In real implementation, use AI/ML model here
        // For now, we'll just log it
        console.log(`🖼️ Image received from ${sender}`);
        
        // Check for explicit content (placeholder logic)
        const caption = msg.message.imageMessage.caption || '';
        const suspiciousKeywords = ['nude', 'porn', 'sex', 'explicit', 'nsfw'];
        
        if (suspiciousKeywords.some(keyword => 
            caption.toLowerCase().includes(keyword))) {
            
            // Delete suspicious image
            await sock.sendMessage(from, { delete: msg.key });
            
            // Warn user
            await sock.sendMessage(from, {
                text: `🚨 *CONTENT VIOLATION*\n\nPornographic content detected and deleted.\n\n⚠️ Warning issued to: ${sender.split('@')[0]}`
            });
            
            // Report to owner
            await sock.sendMessage(config.ownerJid, {
                text: `🚨 PORN DETECTED\n\nFrom: ${sender}\nChat: ${from}\nTime: ${new Date().toLocaleString()}`
            });
            
            return true;
        }
    }
    return false;
};

// MAIN MESSAGE HANDLER
async function messageHandler(sock, msg) {
    try {
        // Skip if no message or from self
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        const pushName = msg.pushName || "Unknown";
        
        // Save user info
        await User.save(sender, {
            name: pushName,
            jid: sender,
            pushName: pushName,
            isGroup: isGroup,
            lastSeen: new Date().toISOString(),
            messageCount: (await User.get(sender))?.messageCount + 1 || 1
        });
        
        // AUTO STATUS VIEW & REACT
        if (from === 'status@broadcast') {
            if (config.autoStatusView) {
                await sock.readMessages([msg.key]);
                const reactions = ['❤️', '🔥', '👏', '🎉', '👍'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                
                await sock.sendMessage(from, { 
                    react: { text: randomReaction, key: msg.key } 
                });
                
                // Auto reply to status
                if (msg.message?.conversation) {
                    await sock.sendMessage(sender, {
                        text: `👀 Saw your status: "${msg.message.conversation.substring(0, 50)}${msg.message.conversation.length > 50 ? '...' : ''}"`
                    });
                }
            }
            return;
        }
        
        // VIEW-ONCE MEDIA CAPTURE
        if (config.viewOnceCapture && 
            (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2)) {
            
            const mediaType = msg.message.viewOnceMessage ? 
                Object.keys(msg.message.viewOnceMessage.message)[0] :
                Object.keys(msg.message.viewOnceMessageV2.message)[0];
            
            // Forward to owner
            await sock.sendMessage(config.ownerJid, {
                forward: msg,
                caption: `🔓 VIEW-ONCE CAPTURED\n\n` +
                        `From: ${pushName} (${sender})\n` +
                        `Chat: ${isGroup ? 'Group' : 'Private'}\n` +
                        `Type: ${mediaType}\n` +
                        `Time: ${new Date().toLocaleString()}`
            });
            
            // Notify in chat
            await sock.sendMessage(from, {
                text: `🔓 *View-Once detected*: Media has been captured by security system.`
            });
            
            return;
        }
        
        // EXTRACT MESSAGE TEXT
        const text = extractText(msg);
        
        // AUTO REPLY SYSTEM
        await autoReply(sock, msg, from, sender);
        
        // VOICE NOTE HANDLER
        await handleVoiceNote(sock, msg, from);
        
        // IMAGE ANALYSIS
        if (await analyzeImage(sock, msg, from, sender)) {
            return; // Message was deleted due to porn
        }
        
        // GET GROUP SETTINGS
        let settings = {};
        if (isGroup) {
            settings = await Group.getSettings(from);
        } else {
            settings = {
                antiLink: config.antiLink,
                antiSpam: config.antiSpam,
                swearFilter: config.swearFilter
            };
        }
        
        // ANTI-LINK PROTECTION
        if (settings.antiLink && text && containsLink(text)) {
            const links = text.match(/(https?:\/\/[^\s]+)/g) || [];
            const hasDisallowed = links.some(link => !isAllowedDomain(link));
            
            if (hasDisallowed) {
                await sock.sendMessage(from, { delete: msg.key });
                await sock.sendMessage(from, {
                    text: `🚫 *LINK REMOVED*\n\nLinks are not allowed in this chat.\n\nUser: @${sender.split('@')[0]}\nAction: Message deleted`
                });
                
                // Report to owner
                await sock.sendMessage(config.ownerJid, {
                    text: `🚫 LINK DELETED\n\nFrom: ${sender}\nChat: ${from}\nLink: ${links[0]?.substring(0, 50)}`
                });
                return;
            }
        }
        
        // SWEAR WORD FILTER
        if (settings.swearFilter && text && containsSwearWord(text)) {
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, {
                text: `⚠️ *LANGUAGE VIOLATION*\n\nSwear words are not allowed.\n\nUser: @${sender.split('@')[0]}\nAction: Message deleted`
            });
            return;
        }
        
        // ANTI-SPAM DETECTION (basic)
        if (settings.antiSpam) {
            // Simple spam detection (can be enhanced)
            const user = await User.get(sender);
            if (user && user.messageCount > 10) {
                const recentMessages = user.messageCount;
                if (recentMessages > 15) { // Threshold
                    await sock.sendMessage(from, {
                        text: `🚨 *SPAM DETECTED*\n\nUser @${sender.split('@')[0]} is sending too many messages.`
                    });
                }
            }
        }
        
        // AUTO TYPING PRESENCE
        if (config.autoTyping && Math.random() > 0.5) {
            await sock.sendPresenceUpdate('composing', from);
            setTimeout(async () => {
                await sock.sendPresenceUpdate('paused', from);
            }, 2000);
        }
        
        // CHECK FOR COMMANDS
        if (text.startsWith(config.prefix)) {
            const args = text.slice(config.prefix.length).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            const command = global.commands.get(cmd);
            
            if (command) {
                console.log(`⚡ Command: ${cmd} from ${pushName}`);
                
                // Update user command count
                await User.update(sender, {
                    commandCount: (user?.commandCount || 0) + 1,
                    lastCommand: cmd
                });
                
                // Execute command
                await sock.sendPresenceUpdate('composing', from);
                await command.execute(sock, msg, args);
            }
        }
        
    } catch (error) {
        console.error("Handler error:", error.message);
    }
}

// Utility function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { messageHandler };
