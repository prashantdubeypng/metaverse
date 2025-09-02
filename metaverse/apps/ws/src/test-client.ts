import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

// Test WebSocket connection with proper authentication
const JWT_SECRET = 'prashant143tanu'; // Same as in .env
const WS_URL = 'ws://localhost:3001';

// Create a test JWT token
const testToken = jwt.sign(
    {
        userId: 'test-user-123',
        username: 'TestUser'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
);

console.log('🔑 Generated test token:', testToken);
console.log('🔍 Token payload:', jwt.decode(testToken));

// Connect to WebSocket
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    
    // Send join message with token
    const joinMessage = {
        type: 'join',
        payload: {
            spaceId: 'test-space-id', // You'll need a valid space ID from your database
            token: testToken
        }
    };
    
    console.log('📤 Sending join message:', joinMessage);
    console.log('⚠️  NOTE: You need to replace "test-space-id" with a real space ID from your database');
    ws.send(JSON.stringify(joinMessage));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', message);
    } catch (error) {
        console.error('❌ Error parsing message:', error);
    }
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason.toString()}`);
    
    // Decode the close codes
    switch (code) {
        case 1008:
            console.log('❌ Authentication failed - check your token and space ID');
            break;
        case 1011:
            console.log('❌ Server error during initialization');
            break;
        default:
            console.log(`❓ Unknown close code: ${code}`);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
});

// Keep the process alive for testing
setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
    process.exit(0);
}, 10000);