const WebSocket = require('ws');
const TestUtils = require('../test-utils');

describe('WebSocket Service - Unit Tests', () => {
  const WS_PORT = process.env.WS_SERVICE_PORT || 3102;
  let ws;

  beforeAll(async () => {
    // Wait for WebSocket service to be ready
    await TestUtils.waitForWebSocketService(WS_PORT);
    console.log('🔌 WebSocket Service ready for testing');
  });

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      await TestUtils.sleep(100); // Allow time for cleanup
    }
  });

  describe('Connection Management', () => {
    test('should establish WebSocket connection', async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    test('should handle connection close gracefully', async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
      
      return new Promise((resolve) => {
        ws.on('close', (code, reason) => {
          expect(code).toBeDefined();
          resolve();
        });
        
        ws.close();
      });
    });

    test('should handle ping/pong for heartbeat', async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, 5000);

        ws.on('pong', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.ping();
      });
    });
  });

  describe('User Management', () => {
    beforeEach(async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
    });

    test('should handle user join', async () => {
      const joinMessage = {
        type: 'join',
        payload: {
          spaceId: 'test-space-1',
          userId: 'test-user-1',
          username: 'TestUser1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, joinMessage);
      
      TestUtils.validateWebSocketMessage(response, 'user-joined');
      expect(response.payload.userId).toBe(joinMessage.payload.userId);
      expect(response.payload.spaceId).toBe(joinMessage.payload.spaceId);
    });

    test('should handle user movement', async () => {
      // First join a space
      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: 'test-space-1',
          userId: 'test-user-1',
          username: 'TestUser1'
        }
      });

      // Then move
      const moveMessage = {
        type: 'movement',
        payload: {
          x: 10,
          y: 15
        }
      };

      const response = await TestUtils.sendWSMessage(ws, moveMessage);
      
      TestUtils.validateWebSocketMessage(response, 'user-moved');
      expect(response.payload.x).toBe(moveMessage.payload.x);
      expect(response.payload.y).toBe(moveMessage.payload.y);
    });

    test('should handle user leave', async () => {
      // First join a space
      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: 'test-space-1',
          userId: 'test-user-1',
          username: 'TestUser1'
        }
      });

      // Then leave
      const leaveMessage = {
        type: 'leave',
        payload: {
          spaceId: 'test-space-1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, leaveMessage);
      
      TestUtils.validateWebSocketMessage(response, 'user-left');
      expect(response.payload.spaceId).toBe(leaveMessage.payload.spaceId);
    });

    test('should validate user join data', async () => {
      const invalidJoinMessage = {
        type: 'join',
        payload: {
          // Missing required fields
          spaceId: 'test-space-1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, invalidJoinMessage);
      
      TestUtils.validateWebSocketMessage(response, 'error');
      expect(response.payload.message).toBeDefined();
    });
  });

  describe('Space Management', () => {
    beforeEach(async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
    });

    test('should handle space creation', async () => {
      const createSpaceMessage = {
        type: 'create-space',
        payload: {
          name: 'Test Space',
          dimensions: { width: 20, height: 20 },
          ownerId: 'test-user-1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, createSpaceMessage);
      
      TestUtils.validateWebSocketMessage(response, 'space-created');
      expect(response.payload.space.name).toBe(createSpaceMessage.payload.name);
      expect(response.payload.space.dimensions).toEqual(createSpaceMessage.payload.dimensions);
      expect(response.payload.space.id).toBeDefined();
    });

    test('should get space info', async () => {
      const spaceInfoMessage = {
        type: 'get-space-info',
        payload: {
          spaceId: 'test-space-1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, spaceInfoMessage);
      
      TestUtils.validateWebSocketMessage(response, 'space-info');
      expect(response.payload.spaceId).toBe(spaceInfoMessage.payload.spaceId);
      expect(response.payload.users).toBeDefined();
      expect(Array.isArray(response.payload.users)).toBe(true);
    });

    test('should list available spaces', async () => {
      const listSpacesMessage = {
        type: 'list-spaces',
        payload: {}
      };

      const response = await TestUtils.sendWSMessage(ws, listSpacesMessage);
      
      TestUtils.validateWebSocketMessage(response, 'spaces-list');
      expect(response.payload.spaces).toBeDefined();
      expect(Array.isArray(response.payload.spaces)).toBe(true);
    });
  });

  describe('Chat Functionality', () => {
    beforeEach(async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
      
      // Join a space first
      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: 'test-space-1',
          userId: 'test-user-1',
          username: 'TestUser1'
        }
      });
    });

    test('should send chat message', async () => {
      const chatMessage = {
        type: 'chat-message',
        payload: {
          message: 'Hello, world!',
          spaceId: 'test-space-1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, chatMessage);
      
      TestUtils.validateWebSocketMessage(response, 'chat-message-sent');
      expect(response.payload.message).toBe(chatMessage.payload.message);
      expect(response.payload.sender).toBeDefined();
      expect(response.payload.timestamp).toBeDefined();
    });

    test('should validate chat message content', async () => {
      const invalidChatMessage = {
        type: 'chat-message',
        payload: {
          message: '', // Empty message
          spaceId: 'test-space-1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, invalidChatMessage);
      
      TestUtils.validateWebSocketMessage(response, 'error');
      expect(response.payload.message).toBeDefined();
    });

    test('should handle long chat messages', async () => {
      const longMessage = 'A'.repeat(1000); // Very long message
      
      const chatMessage = {
        type: 'chat-message',
        payload: {
          message: longMessage,
          spaceId: 'test-space-1'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, chatMessage);
      
      // Should either accept it or return an error for message too long
      expect(['chat-message-sent', 'error']).toContain(response.type);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
    });

    test('should handle invalid message format', async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Error response timeout'));
        }, 5000);

        ws.on('message', (data) => {
          clearTimeout(timeout);
          try {
            const response = JSON.parse(data.toString());
            TestUtils.validateWebSocketMessage(response, 'error');
            expect(response.payload.message).toBeDefined();
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        // Send invalid JSON
        ws.send('invalid json');
      });
    });

    test('should handle unknown message type', async () => {
      const unknownMessage = {
        type: 'unknown-message-type',
        payload: {}
      };

      const response = await TestUtils.sendWSMessage(ws, unknownMessage);
      
      TestUtils.validateWebSocketMessage(response, 'error');
      expect(response.payload.message).toBeDefined();
    });

    test('should handle missing payload', async () => {
      const messageWithoutPayload = {
        type: 'join'
        // Missing payload
      };

      const response = await TestUtils.sendWSMessage(ws, messageWithoutPayload);
      
      TestUtils.validateWebSocketMessage(response, 'error');
      expect(response.payload.message).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple concurrent connections', async () => {
      const connections = [];
      const connectionCount = 10;

      try {
        // Create multiple connections
        for (let i = 0; i < connectionCount; i++) {
          const connection = await TestUtils.connectWebSocket(WS_PORT);
          connections.push(connection);
        }

        expect(connections).toHaveLength(connectionCount);

        // Test that all connections are working
        const promises = connections.map((connection, index) => 
          TestUtils.sendWSMessage(connection, {
            type: 'join',
            payload: {
              spaceId: 'test-space-concurrent',
              userId: `test-user-${index}`,
              username: `TestUser${index}`
            }
          })
        );

        const responses = await Promise.all(promises);
        expect(responses).toHaveLength(connectionCount);

        responses.forEach((response, index) => {
          TestUtils.validateWebSocketMessage(response, 'user-joined');
          expect(response.payload.userId).toBe(`test-user-${index}`);
        });

      } finally {
        // Clean up all connections
        connections.forEach(connection => {
          if (connection.readyState === WebSocket.OPEN) {
            connection.close();
          }
        });
      }
    });

    test('should handle rapid message sending', async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);
      
      // Join a space first
      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: 'test-space-rapid',
          userId: 'test-user-rapid',
          username: 'TestUserRapid'
        }
      });

      // Send multiple messages rapidly
      const messageCount = 20;
      const promises = [];

      for (let i = 0; i < messageCount; i++) {
        promises.push(
          TestUtils.sendWSMessage(ws, {
            type: 'movement',
            payload: {
              x: i,
              y: i
            }
          })
        );
      }

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(messageCount);

      responses.forEach((response, index) => {
        TestUtils.validateWebSocketMessage(response, 'user-moved');
        expect(response.payload.x).toBe(index);
        expect(response.payload.y).toBe(index);
      });
    });
  });
});
