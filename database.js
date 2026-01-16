const mongoose = require('mongoose');

// Session Schema
const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    creds: { type: Object },
    status: { type: String, default: 'pending' },
    pairingCode: String,
    joinedGroup: { type: Boolean, default: false },
    joinedChannel: { type: Boolean, default: false },
    connectedAt: Date,
    lastSeen: Date
});

// User Schema
const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    name: String,
    joinedGroup: { type: Boolean, default: false },
    joinedChannel: { type: Boolean, default: false },
    warnings: { type: Number, default: 0 },
    banned: { type: Boolean, default: false },
    lastActive: Date,
    createdAt: { type: Date, default: Date.now }
});

const Session = mongoose.model('Session', SessionSchema);
const User = mongoose.model('User', UserSchema);

// Connect to MongoDB
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || "mongodb+srv://stanytz076:stanytz076@cluster0.ennpt6t.mongodb.net/WrongTurn6?retryWrites=true&w=majority";
        
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB Connected Successfully');
        return true;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        return false;
    }
};

module.exports = { Session, User, connectDB };
