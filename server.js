require('dotenv').config();
const http = require('http');

// Load config
const config = require('./config');

// Create HTTP server
const app = require('./index');

// Get port from environment
const PORT = process.env.PORT || config.port || 3001;

// Create server
const server = http.createServer(app);

// Function to start server on available port
function startServer(port) {
    server.listen(port, () => {
        console.log(`🚀 ${config.botName} Server running on port ${port}`);
        console.log(`👑 Developer: ${config.developer}`);
        console.log(`🌐 Web Interface: http://localhost:${port}`);
    });
    
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${port} is busy. Trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('❌ Server error:', error);
            process.exit(1);
        }
    });
}

// Start the server
startServer(PORT);
