// Crypto polyfill for Node.js environments without native crypto
console.log('🔐 Loading crypto polyfill...');

// Import the crypto module
const crypto = require('crypto');

// Make sure crypto is available globally
if (typeof global.crypto === 'undefined') {
    console.log('✅ Setting up global crypto...');
    global.crypto = crypto;
}

// Ensure webcrypto is available
if (typeof global.crypto.subtle === 'undefined') {
    console.log('✅ Setting up subtle crypto...');
    const webcrypto = require('node-webcrypto-ossl');
    global.crypto.subtle = new webcrypto().subtle;
}

// Export the crypto module
module.exports = crypto;
