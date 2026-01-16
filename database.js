const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    verified: { type: Boolean, default: false },
    antiDelete: { type: Boolean, default: true },
    autoRead: { type: Boolean, default: false }
});
const User = mongoose.model('WT6_User', UserSchema);
module.exports = { User };
