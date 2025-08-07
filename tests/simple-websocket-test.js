const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Simple WebSocket connection test
const JWT_SECRET = '123bsdkmcbcanu';
const WS_URL = 'ws://localhost:3001';

function createTestToken(userId = 'test-user-123') {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

async function testWebSocketConnection() {
    console.log('🔌 Testing WebSocket connection...');
    
    try {
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
            console.log('✅ WebSocket connected successfully');
            
            // Test joining a space
            const token = createTestToken();
            const joinMessage = {
                type: 'join',
                payload: {
                    spaceId: 'test-space-id',  // You'll need a real space ID
                    token: token
                }
            };
            
            console.log('📤 Sending join message:', joinMessage);
            ws.send(JSON.stringify(joinMessage));
        });
        
        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            console.log('📥 Received message:', message);
        });
        
        ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket closed - Code: ${code}, Reason: ${reason}`);
        });
        
        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });
        
        // Keep connection alive for 10 seconds
        setTimeout(() => {
            console.log('⏰ Closing connection after 10 seconds');
            ws.close();
        }, 10000);
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testWebSocketConnection();
}

module.exports = { testWebSocketConnection, createTestToken };
