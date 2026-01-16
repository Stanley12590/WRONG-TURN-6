const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    verified: { type: Boolean, default: false },
    antiLink: { type: Boolean, default: true },
    antiDelete: { type: Boolean, default: true },
    autoStatusView: { type: Boolean, default: true },
    autoStatusLike: { type: Boolean, default: true },
    autoStatusReply: { type: Boolean, default: false },
    statusReplyMsg: { type: String, default: "Nice status! Viewed by WRONG TURN 6 ✔️" }
});
const User = mongoose.model('WT6_User', UserSchema);
module.exports = { User };
