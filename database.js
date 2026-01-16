const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    creds: { type: Object }
});

const UserSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    antiDelete: { type: Boolean, default: true },
    antiLink: { type: Boolean, default: true },
    autoStatus: { type: Boolean, default: true },
    verified: { type: Boolean, default: true }
});

const Session = mongoose.model('WT6_Session', SessionSchema);
const User = mongoose.model('WT6_User', UserSchema);

module.exports = { Session, User };
