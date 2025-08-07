const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const WS_PORT = 3001;
const HTTP_PORT = 3000;
const WS_URL = `ws://localhost:${WS_PORT}`;
const HTTP_URL = `http://localhost:${HTTP_PORT}`;
const JWT_SECRET = '123bsdkmcbcanu';

// Helper function to create a valid JWT token
function createTestToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

// Helper function to connect to WebSocket
function connectWebSocket() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
            resolve(ws);
        });
        
        ws.on('error', (error) => {
            reject(error);
        });
        
        // Set timeout for connection
        setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
        }, 5000);
    });
}

// Helper function to wait for WebSocket message
function waitForMessage(ws, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Message timeout'));
        }, timeout);
        
        ws.once('message', (data) => {
            clearTimeout(timeoutId);
            try {
                const parsed = JSON.parse(data.toString());
                resolve(parsed);
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Helper function to generate unique username
function generateUsername() {
    return "wstest" + Math.random().toString(36).substr(2, 9);
}

describe("🔌 WebSocket Server Tests", () => {
    let userToken = "";
    let spaceId = "";
    let elementId = "";
    
    // Setup test data before running WebSocket tests
    beforeAll(async () => {
        try {
            // Create a test user
            const username = generateUsername();
            const signupResponse = await axios.post(`${HTTP_URL}/api/v1/signup`, {
                username,
                password: "password123",
                type: "User"
            });
            
            // Login to get token
            const loginResponse = await axios.post(`${HTTP_URL}/api/v1/login`, {
                username,
                password: "password123"
            });
            
            userToken = loginResponse.data.token;
            
            // Create a test space
            const spaceResponse = await axios.post(`${HTTP_URL}/api/v1/space/`, {
                name: "WebSocket Test Space",
                dimensions: "1000x800"
            }, {
                headers: {
                    "Authorization": `Bearer ${userToken}`
                }
            });
            
            spaceId = spaceResponse.data.spaceId;
            
            console.log("Test setup complete:", { userToken: userToken ? "✓" : "✗", spaceId });
        } catch (error) {
            console.error("Test setup failed:", error.response?.data || error.message);
            throw error;
        }
    }, 30000);

    describe("🔗 WebSocket Connection Tests", () => {
        test("✅ Should establish WebSocket connection", async () => {
            const ws = await connectWebSocket();
            expect(ws.readyState).toBe(WebSocket.OPEN);
            ws.close();
        });

        test("❌ Should handle connection errors gracefully", async () => {
            // Try to connect to wrong port
            const ws = new WebSocket('ws://localhost:9999');
            
            await new Promise((resolve) => {
                ws.on('error', (error) => {
                    expect(error).toBeDefined();
                    resolve();
                });
                
                ws.on('open', () => {
                    ws.close();
                    throw new Error('Should not connect to wrong port');
                });
            });
        });
    });

    describe("🏠 Space Join Functionality", () => {
        test("✅ Should join space successfully with valid token", async () => {
            const ws = await connectWebSocket();
            
            // Send join message
            ws.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            // Wait for response
            const response = await waitForMessage(ws);
            
            expect(response.type).toBe('Space-joined');
            expect(response.payload.spawn).toBeDefined();
            expect(response.payload.spawn.x).toBeGreaterThanOrEqual(0);
            expect(response.payload.spawn.y).toBeGreaterThanOrEqual(0);
            expect(response.payload.Users).toBeDefined();
            expect(Array.isArray(response.payload.Users)).toBe(true);
            
            ws.close();
        });

        test("❌ Should reject join with invalid token", async () => {
            const ws = await connectWebSocket();
            
            // Send join message with invalid token
            ws.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: 'invalid-token'
                }
            }));
            
            // WebSocket should close with error
            await new Promise((resolve) => {
                ws.on('close', (code, reason) => {
                    expect(code).toBe(1008);
                    expect(reason.toString()).toBe('Invalid token');
                    resolve();
                });
                
                // Fallback timeout
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                        throw new Error('WebSocket should have closed');
                    }
                    resolve();
                }, 3000);
            });
        });

        test("❌ Should reject join with nonexistent space", async () => {
            const ws = await connectWebSocket();
            
            // Send join message with nonexistent space
            ws.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: 'nonexistent-space-id',
                    token: userToken
                }
            }));
            
            // WebSocket should close with error
            await new Promise((resolve) => {
                ws.on('close', (code, reason) => {
                    expect(code).toBe(1008);
                    expect(reason.toString()).toBe('Space not found');
                    resolve();
                });
                
                // Fallback timeout
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                        throw new Error('WebSocket should have closed');
                    }
                    resolve();
                }, 3000);
            });
        });

        test("❌ Should reject join without token", async () => {
            const ws = await connectWebSocket();
            
            // Send join message without token
            ws.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId
                }
            }));
            
            // WebSocket should close or handle error
            await new Promise((resolve) => {
                ws.on('close', (code) => {
                    expect(code).toBe(1008);
                    resolve();
                });
                
                ws.on('error', (error) => {
                    expect(error).toBeDefined();
                    resolve();
                });
                
                // Fallback timeout
                setTimeout(() => {
                    ws.close();
                    resolve();
                }, 3000);
            });
        });
    });

    describe("🚶 User Movement Tests", () => {
        let ws1, ws2;
        
        beforeEach(async () => {
            // Create two WebSocket connections
            ws1 = await connectWebSocket();
            ws2 = await connectWebSocket();
            
            // Join both users to the same space
            ws1.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            ws2.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            // Wait for join confirmations
            await waitForMessage(ws1);
            await waitForMessage(ws2);
        });
        
        afterEach(() => {
            if (ws1) ws1.close();
            if (ws2) ws2.close();
        });

        test("✅ Should accept valid move (1 unit)", async () => {
            // Get initial position from join response
            ws1.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            const joinResponse = await waitForMessage(ws1);
            const initialX = joinResponse.payload.spawn.x;
            const initialY = joinResponse.payload.spawn.y;
            
            // Send valid move (1 unit in x direction)
            ws1.send(JSON.stringify({
                type: 'move',
                payload: {
                    x: initialX + 1,
                    y: initialY
                }
            }));
            
            // ws2 should receive the movement broadcast
            const moveMessage = await waitForMessage(ws2);
            
            expect(moveMessage.type).toBe('user-moved');
            expect(moveMessage.payload.x).toBe(initialX + 1);
            expect(moveMessage.payload.y).toBe(initialY);
            expect(moveMessage.payload.userId).toBeDefined();
        });

        test("❌ Should reject invalid move (more than 1 unit)", async () => {
            // Get initial position
            ws1.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            const joinResponse = await waitForMessage(ws1);
            const initialX = joinResponse.payload.spawn.x;
            const initialY = joinResponse.payload.spawn.y;
            
            // Send invalid move (2 units)
            ws1.send(JSON.stringify({
                type: 'move',
                payload: {
                    x: initialX + 2,
                    y: initialY
                }
            }));
            
            // Should receive move rejection
            const rejectMessage = await waitForMessage(ws1);
            
            expect(rejectMessage.type).toBe('move-rejected');
            expect(rejectMessage.payload.x).toBe(initialX);
            expect(rejectMessage.payload.y).toBe(initialY);
        });

        test("❌ Should reject diagonal move", async () => {
            // Get initial position
            ws1.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            const joinResponse = await waitForMessage(ws1);
            const initialX = joinResponse.payload.spawn.x;
            const initialY = joinResponse.payload.spawn.y;
            
            // Send diagonal move
            ws1.send(JSON.stringify({
                type: 'move',
                payload: {
                    x: initialX + 1,
                    y: initialY + 1
                }
            }));
            
            // Should receive move rejection
            const rejectMessage = await waitForMessage(ws1);
            
            expect(rejectMessage.type).toBe('move-rejected');
            expect(rejectMessage.payload.x).toBe(initialX);
            expect(rejectMessage.payload.y).toBe(initialY);
        });
    });

    describe("👥 Multi-User Interaction Tests", () => {
        test("✅ Should broadcast user join to other users", async () => {
            const ws1 = await connectWebSocket();
            const ws2 = await connectWebSocket();
            
            // First user joins
            ws1.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            await waitForMessage(ws1); // Wait for join confirmation
            
            // Second user joins
            ws2.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: userToken
                }
            }));
            
            // First user should receive notification of second user joining
            const joinNotification = await waitForMessage(ws1);
            
            expect(joinNotification.type).toBe('user-joined-space');
            expect(joinNotification.payload.userId).toBeDefined();
            expect(joinNotification.payload.x).toBeGreaterThanOrEqual(0);
            expect(joinNotification.payload.y).toBeGreaterThanOrEqual(0);
            
            ws1.close();
            ws2.close();
        });

        test("✅ Should broadcast user leave to other users", async () => {
            const ws1 = await connectWebSocket();
            const ws2 = await connectWebSocket();
            
            // Both users join
            ws1.send(JSON.stringify({
                type: 'join',
                payload: { spaceId: spaceId, token: userToken }
            }));
            
            ws2.send(JSON.stringify({
                type: 'join',
                payload: { spaceId: spaceId, token: userToken }
            }));
            
            await waitForMessage(ws1);
            await waitForMessage(ws2);
            
            // Second user leaves (close connection)
            ws2.close();
            
            // First user should receive leave notification
            const leaveNotification = await waitForMessage(ws1);
            
            expect(leaveNotification.type).toBe('user-left');
            expect(leaveNotification.payload.userId).toBeDefined();
            
            ws1.close();
        });

        test("✅ Should handle multiple users in same space", async () => {
            const connections = [];
            const joinPromises = [];
            
            // Create 3 WebSocket connections
            for (let i = 0; i < 3; i++) {
                const ws = await connectWebSocket();
                connections.push(ws);
                
                ws.send(JSON.stringify({
                    type: 'join',
                    payload: { spaceId: spaceId, token: userToken }
                }));
                
                joinPromises.push(waitForMessage(ws));
            }
            
            // Wait for all join confirmations
            const joinResponses = await Promise.all(joinPromises);
            
            // Each user should see the others in the Users array
            joinResponses.forEach(response => {
                expect(response.type).toBe('Space-joined');
                expect(response.payload.Users).toBeDefined();
                expect(Array.isArray(response.payload.Users)).toBe(true);
            });
            
            // Clean up
            connections.forEach(ws => ws.close());
        });
    });

    describe("🛡️ Error Handling & Edge Cases", () => {
        test("❌ Should handle malformed JSON messages", async () => {
            const ws = await connectWebSocket();
            
            // Send malformed JSON
            ws.send('invalid-json{');
            
            // WebSocket should remain open but handle the error
            await new Promise((resolve) => {
                setTimeout(() => {
                    expect(ws.readyState).toBe(WebSocket.OPEN);
                    ws.close();
                    resolve();
                }, 1000);
            });
        });

        test("❌ Should handle unknown message types", async () => {
            const ws = await connectWebSocket();
            
            // Send unknown message type
            ws.send(JSON.stringify({
                type: 'unknown-type',
                payload: { test: 'data' }
            }));
            
            // WebSocket should remain open
            await new Promise((resolve) => {
                setTimeout(() => {
                    expect(ws.readyState).toBe(WebSocket.OPEN);
                    ws.close();
                    resolve();
                }, 1000);
            });
        });

        test("✅ Should handle rapid message sending", async () => {
            const ws = await connectWebSocket();
            
            // Join first
            ws.send(JSON.stringify({
                type: 'join',
                payload: { spaceId: spaceId, token: userToken }
            }));
            
            const joinResponse = await waitForMessage(ws);
            const x = joinResponse.payload.spawn.x;
            const y = joinResponse.payload.spawn.y;
            
            // Send multiple rapid moves
            for (let i = 0; i < 5; i++) {
                ws.send(JSON.stringify({
                    type: 'move',
                    payload: { x: x + (i % 2), y: y }
                }));
            }
            
            // WebSocket should handle all messages
            await new Promise((resolve) => {
                setTimeout(() => {
                    expect(ws.readyState).toBe(WebSocket.OPEN);
                    ws.close();
                    resolve();
                }, 2000);
            });
        });
    });

    describe("🔒 Security Tests", () => {
        test("❌ Should reject expired JWT token", async () => {
            const ws = await connectWebSocket();
            
            // Create expired token
            const expiredToken = jwt.sign(
                { userId: 'test-user' }, 
                JWT_SECRET, 
                { expiresIn: '-1h' }
            );
            
            ws.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: expiredToken
                }
            }));
            
            // Should close with error
            await new Promise((resolve) => {
                ws.on('close', (code) => {
                    expect(code).toBe(1008);
                    resolve();
                });
                
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                        throw new Error('Should have closed with expired token');
                    }
                    resolve();
                }, 3000);
            });
        });

        test("❌ Should reject token with wrong secret", async () => {
            const ws = await connectWebSocket();
            
            // Create token with wrong secret
            const wrongToken = jwt.sign(
                { userId: 'test-user' }, 
                'wrong-secret'
            );
            
            ws.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId: spaceId,
                    token: wrongToken
                }
            }));
            
            // Should close with error
            await new Promise((resolve) => {
                ws.on('close', (code) => {
                    expect(code).toBe(1008);
                    resolve();
                });
                
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                        throw new Error('Should have closed with wrong token');
                    }
                    resolve();
                }, 3000);
            });
        });
    });
});
