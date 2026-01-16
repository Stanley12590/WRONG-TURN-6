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

const Session = mongoose.model('Session_WT6', SessionSchema);
const User = mongoose.model('User_WT6', UserSchema);

module.exports = { Session, User };
