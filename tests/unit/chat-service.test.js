const request = require('supertest');
const TestUtils = require('../test-utils');

describe('Chat Service - Unit Tests', () => {
  const CHAT_PORT = process.env.CHAT_SERVICE_PORT || 3103;
  const baseURL = `http://localhost:${CHAT_PORT}`;

  beforeAll(async () => {
    // Wait for Chat service to be ready
    await TestUtils.waitForService(`${baseURL}/health`);
    console.log('💬 Chat Service ready for testing');
  });

  describe('Health Endpoint', () => {
    test('should return health status', async () => {
      const response = await request(baseURL)
        .get('/health')
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('chat-service');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Chat Rooms Management', () => {
    let testRoom;

    beforeEach(async () => {
      testRoom = {
        roomId: `test-room-${Date.now()}`,
        name: `Test Room ${Date.now()}`,
        spaceId: `test-space-${Date.now()}`
      };
    });

    test('should create a new chat room', async () => {
      const roomData = {
        name: testRoom.name,
        spaceId: testRoom.spaceId,
        isPublic: true
      };

      const response = await request(baseURL)
        .post('/api/chat/rooms')
        .send(roomData)
        .expect(201);

      const data = TestUtils.validateResponse(response, 201);
      expect(data.room).toBeDefined();
      expect(data.room.name).toBe(roomData.name);
      expect(data.room.spaceId).toBe(roomData.spaceId);
      expect(data.room.id).toBeDefined();
    });

    test('should get all chat rooms', async () => {
      const response = await request(baseURL)
        .get('/api/chat/rooms')
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.rooms).toBeDefined();
      expect(Array.isArray(data.rooms)).toBe(true);
    });

    test('should get rooms by space ID', async () => {
      // First create a room
      const createResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: testRoom.name,
          spaceId: testRoom.spaceId,
          isPublic: true
        });

      const createdRoom = createResponse.body.room;

      // Then get rooms by space ID
      const response = await request(baseURL)
        .get(`/api/chat/rooms/space/${testRoom.spaceId}`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.rooms).toBeDefined();
      expect(Array.isArray(data.rooms)).toBe(true);
      
      const foundRoom = data.rooms.find(room => room.id === createdRoom.id);
      expect(foundRoom).toBeDefined();
      expect(foundRoom.spaceId).toBe(testRoom.spaceId);
    });

    test('should get specific room by ID', async () => {
      // First create a room
      const createResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: testRoom.name,
          spaceId: testRoom.spaceId,
          isPublic: true
        });

      const createdRoom = createResponse.body.room;

      // Then get it by ID
      const response = await request(baseURL)
        .get(`/api/chat/rooms/${createdRoom.id}`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.room).toBeDefined();
      expect(data.room.id).toBe(createdRoom.id);
      expect(data.room.name).toBe(testRoom.name);
    });

    test('should update room settings', async () => {
      // First create a room
      const createResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: testRoom.name,
          spaceId: testRoom.spaceId,
          isPublic: true
        });

      const createdRoom = createResponse.body.room;

      // Then update it
      const updateData = {
        name: 'Updated Room Name',
        isPublic: false
      };

      const response = await request(baseURL)
        .put(`/api/chat/rooms/${createdRoom.id}`)
        .send(updateData)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.room.name).toBe(updateData.name);
      expect(data.room.isPublic).toBe(updateData.isPublic);
    });

    test('should delete room', async () => {
      // First create a room
      const createResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: testRoom.name,
          spaceId: testRoom.spaceId,
          isPublic: true
        });

      const createdRoom = createResponse.body.room;

      // Then delete it
      const response = await request(baseURL)
        .delete(`/api/chat/rooms/${createdRoom.id}`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.message).toBeDefined();

      // Verify it's deleted
      await request(baseURL)
        .get(`/api/chat/rooms/${createdRoom.id}`)
        .expect(404);
    });
  });

  describe('Chat Messages', () => {
    let testRoom;
    let testUser;

    beforeEach(async () => {
      testUser = await TestUtils.createTestUser();
      
      // Create a test room
      const roomResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: `Test Room ${Date.now()}`,
          spaceId: `test-space-${Date.now()}`,
          isPublic: true
        });

      testRoom = roomResponse.body.room;
    });

    test('should send a message to room', async () => {
      const messageData = {
        content: 'Hello, this is a test message!',
        userId: testUser.userId,
        username: testUser.username
      };

      const response = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages`)
        .send(messageData)
        .expect(201);

      const data = TestUtils.validateResponse(response, 201);
      expect(data.message).toBeDefined();
      expect(data.message.content).toBe(messageData.content);
      expect(data.message.userId).toBe(messageData.userId);
      expect(data.message.username).toBe(messageData.username);
      expect(data.message.timestamp).toBeDefined();
      expect(data.message.id).toBeDefined();
    });

    test('should get messages from room', async () => {
      // First send a message
      await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages`)
        .send({
          content: 'Test message for retrieval',
          userId: testUser.userId,
          username: testUser.username
        });

      // Then get messages
      const response = await request(baseURL)
        .get(`/api/chat/rooms/${testRoom.id}/messages`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.messages).toBeDefined();
      expect(Array.isArray(data.messages)).toBe(true);
      expect(data.messages.length).toBeGreaterThan(0);
      
      const message = data.messages[0];
      expect(message.content).toBeDefined();
      expect(message.userId).toBeDefined();
      expect(message.username).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    test('should get messages with pagination', async () => {
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await request(baseURL)
          .post(`/api/chat/rooms/${testRoom.id}/messages`)
          .send({
            content: `Test message ${i}`,
            userId: testUser.userId,
            username: testUser.username
          });
      }

      // Get messages with limit
      const response = await request(baseURL)
        .get(`/api/chat/rooms/${testRoom.id}/messages?limit=3`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.messages).toBeDefined();
      expect(data.messages.length).toBeLessThanOrEqual(3);
      expect(data.pagination).toBeDefined();
    });

    test('should get messages after specific timestamp', async () => {
      const timestamp = new Date().toISOString();
      
      // Wait a bit then send a message
      await TestUtils.sleep(100);
      
      await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages`)
        .send({
          content: 'Message after timestamp',
          userId: testUser.userId,
          username: testUser.username
        });

      // Get messages after timestamp
      const response = await request(baseURL)
        .get(`/api/chat/rooms/${testRoom.id}/messages?after=${timestamp}`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.messages).toBeDefined();
      
      if (data.messages.length > 0) {
        const message = data.messages[0];
        expect(new Date(message.timestamp).getTime()).toBeGreaterThan(new Date(timestamp).getTime());
      }
    });

    test('should validate message content', async () => {
      const invalidMessageData = {
        content: '', // Empty content
        userId: testUser.userId,
        username: testUser.username
      };

      const response = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages`)
        .send(invalidMessageData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle message content length limits', async () => {
      const longContent = 'A'.repeat(5000); // Very long message
      
      const messageData = {
        content: longContent,
        userId: testUser.userId,
        username: testUser.username
      };

      const response = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages`)
        .send(messageData);

      // Should either accept it or return an error for message too long
      expect([201, 400]).toContain(response.status);
    });

    test('should delete message', async () => {
      // First send a message
      const createResponse = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages`)
        .send({
          content: 'Message to be deleted',
          userId: testUser.userId,
          username: testUser.username
        });

      const createdMessage = createResponse.body.message;

      // Then delete it
      const response = await request(baseURL)
        .delete(`/api/chat/rooms/${testRoom.id}/messages/${createdMessage.id}`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.message).toBeDefined();
    });
  });

  describe('User Management in Chat', () => {
    let testRoom;
    let testUser;

    beforeEach(async () => {
      testUser = await TestUtils.createTestUser();
      
      // Create a test room
      const roomResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: `Test Room ${Date.now()}`,
          spaceId: `test-space-${Date.now()}`,
          isPublic: true
        });

      testRoom = roomResponse.body.room;
    });

    test('should join user to room', async () => {
      const response = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/join`)
        .send({
          userId: testUser.userId,
          username: testUser.username
        })
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.message).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.userId).toBe(testUser.userId);
    });

    test('should leave user from room', async () => {
      // First join the room
      await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/join`)
        .send({
          userId: testUser.userId,
          username: testUser.username
        });

      // Then leave
      const response = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/leave`)
        .send({
          userId: testUser.userId
        })
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.message).toBeDefined();
    });

    test('should get users in room', async () => {
      // First join the room
      await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/join`)
        .send({
          userId: testUser.userId,
          username: testUser.username
        });

      // Then get users
      const response = await request(baseURL)
        .get(`/api/chat/rooms/${testRoom.id}/users`)
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      
      const foundUser = data.users.find(user => user.userId === testUser.userId);
      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(testUser.username);
    });
  });

  describe('Real-time Features', () => {
    test('should handle typing indicators', async () => {
      // Create a room and user
      const roomResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Typing Test Room',
          spaceId: 'test-space-typing',
          isPublic: true
        });

      const testRoom = roomResponse.body.room;
      const testUser = await TestUtils.createTestUser();

      // Send typing indicator
      const response = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/typing`)
        .send({
          userId: testUser.userId,
          username: testUser.username,
          isTyping: true
        })
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.message).toBeDefined();
    });

    test('should handle message reactions', async () => {
      // Create room and send a message
      const roomResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Reaction Test Room',
          spaceId: 'test-space-reactions',
          isPublic: true
        });

      const testRoom = roomResponse.body.room;
      const testUser = await TestUtils.createTestUser();

      const messageResponse = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages`)
        .send({
          content: 'Message to react to',
          userId: testUser.userId,
          username: testUser.username
        });

      const message = messageResponse.body.message;

      // Add reaction
      const response = await request(baseURL)
        .post(`/api/chat/rooms/${testRoom.id}/messages/${message.id}/reactions`)
        .send({
          userId: testUser.userId,
          reaction: '👍'
        })
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.message).toBeDefined();
      expect(data.reaction).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle room not found', async () => {
      const nonExistentRoomId = 'non-existent-room-id';
      
      const response = await request(baseURL)
        .get(`/api/chat/rooms/${nonExistentRoomId}`)
        .expect(404);

      expect(response.body.error).toBeDefined();
    });

    test('should handle invalid room data', async () => {
      const invalidRoomData = {
        // Missing required fields
      };

      const response = await request(baseURL)
        .post('/api/chat/rooms')
        .send(invalidRoomData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle message to non-existent room', async () => {
      const testUser = await TestUtils.createTestUser();
      const nonExistentRoomId = 'non-existent-room-id';

      const response = await request(baseURL)
        .post(`/api/chat/rooms/${nonExistentRoomId}/messages`)
        .send({
          content: 'Message to nowhere',
          userId: testUser.userId,
          username: testUser.username
        })
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple concurrent message sends', async () => {
      // Create a room
      const roomResponse = await request(baseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Concurrent Test Room',
          spaceId: 'test-space-concurrent',
          isPublic: true
        });

      const testRoom = roomResponse.body.room;
      const testUser = await TestUtils.createTestUser();

      // Send multiple messages concurrently
      const messageCount = 10;
      const promises = [];

      for (let i = 0; i < messageCount; i++) {
        promises.push(
          request(baseURL)
            .post(`/api/chat/rooms/${testRoom.id}/messages`)
            .send({
              content: `Concurrent message ${i}`,
              userId: testUser.userId,
              username: testUser.username
            })
            .expect(201)
        );
      }

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(messageCount);

      responses.forEach((response, index) => {
        const data = TestUtils.validateResponse(response, 201);
        expect(data.message.content).toBe(`Concurrent message ${index}`);
      });
    });
  });
});
