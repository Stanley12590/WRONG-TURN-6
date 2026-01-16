const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    antiDelete: { type: Boolean, default: true },
    antiViewOnce: { type: Boolean, default: true },
    autoTyping: { type: Boolean, default: true },
    autoRecording: { type: Boolean, default: true },
    alwaysOnline: { type: Boolean, default: true }
});
const User = mongoose.model('WT6_User', UserSchema);
module.exports = { User };
