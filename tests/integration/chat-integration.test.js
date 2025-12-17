const request = require('supertest');
const WebSocket = require('ws');
const TestUtils = require('../test-utils');

describe('Chat Service Integration Tests', () => {
  const HTTP_PORT = process.env.HTTP_SERVICE_PORT || 3101;
  const WS_PORT = process.env.WS_SERVICE_PORT || 3102;
  const CHAT_PORT = process.env.CHAT_SERVICE_PORT || 3103;
  
  const httpBaseURL = `http://localhost:${HTTP_PORT}`;
  const chatBaseURL = `http://localhost:${CHAT_PORT}`;
  
  let ws;

  beforeAll(async () => {
    // Wait for all services to be ready
    await TestUtils.waitForService(`${httpBaseURL}/health`);
    await TestUtils.waitForService(`${chatBaseURL}/health`);
    await TestUtils.waitForWebSocketService(WS_PORT);
    console.log('🔄 All services ready for chat integration testing');
  });

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      await TestUtils.sleep(100);
    }
  });

  describe('Space and Chat Room Integration', () => {
    test('should create space and associated chat room', async () => {
      // 1. Create space via HTTP API
      const spaceData = {
        name: 'Chat Integration Space',
        dimensions: { width: 30, height: 30 }
      };

      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send(spaceData)
        .expect(201);

      const space = spaceResponse.body.space;

      // 2. Create chat room for the space
      const roomData = {
        name: `Chat for ${space.name}`,
        spaceId: space.id,
        isPublic: true
      };

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send(roomData)
        .expect(201);

      const room = roomResponse.body.room;
      expect(room.spaceId).toBe(space.id);
      expect(room.name).toBe(roomData.name);

      // 3. Connect to WebSocket and join the space
      ws = await TestUtils.connectWebSocket(WS_PORT);

      const joinResponse = await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'chat-integration-user',
          username: 'ChatIntegrationUser'
        }
      });

      TestUtils.validateWebSocketMessage(joinResponse, 'user-joined');

      // 4. Send chat message via WebSocket
      const chatResponse = await TestUtils.sendWSMessage(ws, {
        type: 'chat-message',
        payload: {
          message: 'Hello from WebSocket!',
          spaceId: space.id
        }
      });

      TestUtils.validateWebSocketMessage(chatResponse, 'chat-message-sent');
      expect(chatResponse.payload.message).toBe('Hello from WebSocket!');

      // 5. Verify message is stored via Chat API
      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      expect(messages.length).toBeGreaterThan(0);
      
      const sentMessage = messages.find(msg => msg.content === 'Hello from WebSocket!');
      expect(sentMessage).toBeDefined();
      expect(sentMessage.username).toBe('ChatIntegrationUser');
    });

    test('should sync chat messages between HTTP API and WebSocket', async () => {
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Message Sync Space',
          dimensions: { width: 25, height: 25 }
        });

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Message Sync Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 2. Send message via HTTP API
      const httpMessageResponse = await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/messages`)
        .send({
          content: 'Message sent via HTTP',
          userId: 'http-user',
          username: 'HttpUser'
        })
        .expect(201);

      const httpMessage = httpMessageResponse.body.message;

      // 3. Connect via WebSocket and join space
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'ws-user',
          username: 'WebSocketUser'
        }
      });

      // 4. Send message via WebSocket
      await TestUtils.sendWSMessage(ws, {
        type: 'chat-message',
        payload: {
          message: 'Message sent via WebSocket',
          spaceId: space.id
        }
      });

      // 5. Retrieve all messages via HTTP API
      const allMessagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const allMessages = allMessagesResponse.body.messages;
      expect(allMessages.length).toBeGreaterThanOrEqual(2);

      const httpMsg = allMessages.find(msg => msg.content === 'Message sent via HTTP');
      const wsMsg = allMessages.find(msg => msg.content === 'Message sent via WebSocket');

      expect(httpMsg).toBeDefined();
      expect(wsMsg).toBeDefined();
      expect(httpMsg.username).toBe('HttpUser');
      expect(wsMsg.username).toBe('WebSocketUser');
    });
  });

  describe('Multi-User Chat Scenarios', () => {
    test('should handle multiple users chatting in same space', async () => {
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Multi-User Chat Space',
          dimensions: { width: 40, height: 40 }
        });

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Multi-User Chat Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 2. Create multiple WebSocket connections
      const connections = [];
      const userCount = 3;

      for (let i = 0; i < userCount; i++) {
        const connection = await TestUtils.connectWebSocket(WS_PORT);
        connections.push(connection);

        // Join space
        await TestUtils.sendWSMessage(connection, {
          type: 'join',
          payload: {
            spaceId: space.id,
            userId: `multi-chat-user-${i}`,
            username: `MultiChatUser${i}`
          }
        });

        // Join chat room
        await request(chatBaseURL)
          .post(`/api/chat/rooms/${room.id}/join`)
          .send({
            userId: `multi-chat-user-${i}`,
            username: `MultiChatUser${i}`
          });
      }

      // 3. Each user sends a message
      for (let i = 0; i < userCount; i++) {
        await TestUtils.sendWSMessage(connections[i], {
          type: 'chat-message',
          payload: {
            message: `Hello from user ${i}!`,
            spaceId: space.id
          }
        });
      }

      // 4. Wait for message propagation
      await TestUtils.sleep(200);

      // 5. Verify all messages are stored
      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      expect(messages.length).toBe(userCount);

      for (let i = 0; i < userCount; i++) {
        const userMessage = messages.find(msg => msg.content === `Hello from user ${i}!`);
        expect(userMessage).toBeDefined();
        expect(userMessage.username).toBe(`MultiChatUser${i}`);
      }

      // 6. Clean up connections
      connections.forEach(connection => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.close();
        }
      });
    });

    test('should handle user joining mid-conversation', async () => {
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Mid-Conversation Space',
          dimensions: { width: 30, height: 30 }
        });

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Mid-Conversation Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 2. First user joins and sends messages
      const firstConnection = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(firstConnection, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'first-user',
          username: 'FirstUser'
        }
      });

      await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/join`)
        .send({
          userId: 'first-user',
          username: 'FirstUser'
        });

      // Send some messages
      for (let i = 0; i < 3; i++) {
        await TestUtils.sendWSMessage(firstConnection, {
          type: 'chat-message',
          payload: {
            message: `Message ${i} from first user`,
            spaceId: space.id
          }
        });
      }

      // 3. Second user joins later
      const secondConnection = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(secondConnection, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'second-user',
          username: 'SecondUser'
        }
      });

      await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/join`)
        .send({
          userId: 'second-user',
          username: 'SecondUser'
        });

      // 4. Second user should be able to see previous messages
      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      expect(messages.length).toBe(3);

      // 5. Second user sends a message
      await TestUtils.sendWSMessage(secondConnection, {
        type: 'chat-message',
        payload: {
          message: 'Hello, I just joined!',
          spaceId: space.id
        }
      });

      // 6. Verify both users' messages are present
      const updatedMessagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const updatedMessages = updatedMessagesResponse.body.messages;
      expect(updatedMessages.length).toBe(4);

      const joinMessage = updatedMessages.find(msg => msg.content === 'Hello, I just joined!');
      expect(joinMessage).toBeDefined();
      expect(joinMessage.username).toBe('SecondUser');

      // Clean up
      firstConnection.close();
      secondConnection.close();
    });
  });

  describe('Chat Room Management Integration', () => {
    test('should handle room creation, updates, and deletion with active users', async () => {
      // 1. Create space
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Room Management Space',
          dimensions: { width: 35, height: 35 }
        });

      const space = spaceResponse.body.space;

      // 2. Create chat room
      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Management Test Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 3. User joins space and room
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'management-user',
          username: 'ManagementUser'
        }
      });

      await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/join`)
        .send({
          userId: 'management-user',
          username: 'ManagementUser'
        });

      // 4. Send a message
      await TestUtils.sendWSMessage(ws, {
        type: 'chat-message',
        payload: {
          message: 'Message in original room',
          spaceId: space.id
        }
      });

      // 5. Update room settings
      await request(chatBaseURL)
        .put(`/api/chat/rooms/${room.id}`)
        .send({
          name: 'Updated Management Room',
          isPublic: false
        })
        .expect(200);

      // 6. Verify room is updated
      const updatedRoomResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}`)
        .expect(200);

      const updatedRoom = updatedRoomResponse.body.room;
      expect(updatedRoom.name).toBe('Updated Management Room');
      expect(updatedRoom.isPublic).toBe(false);

      // 7. Messages should still be accessible
      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Message in original room');

      // 8. Delete room (this should also handle user cleanup)
      await request(chatBaseURL)
        .delete(`/api/chat/rooms/${room.id}`)
        .expect(200);

      // 9. Verify room is deleted
      await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}`)
        .expect(404);
    });

    test('should handle multiple rooms in same space', async () => {
      // 1. Create space
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Multi-Room Space',
          dimensions: { width: 50, height: 50 }
        });

      const space = spaceResponse.body.space;

      // 2. Create multiple rooms
      const rooms = [];
      for (let i = 0; i < 3; i++) {
        const roomResponse = await request(chatBaseURL)
          .post('/api/chat/rooms')
          .send({
            name: `Room ${i} in Space`,
            spaceId: space.id,
            isPublic: true
          });

        rooms.push(roomResponse.body.room);
      }

      // 3. User joins space
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'multi-room-user',
          username: 'MultiRoomUser'
        }
      });

      // 4. Join all rooms and send messages
      for (let i = 0; i < rooms.length; i++) {
        await request(chatBaseURL)
          .post(`/api/chat/rooms/${rooms[i].id}/join`)
          .send({
            userId: 'multi-room-user',
            username: 'MultiRoomUser'
          });

        await request(chatBaseURL)
          .post(`/api/chat/rooms/${rooms[i].id}/messages`)
          .send({
            content: `Message in room ${i}`,
            userId: 'multi-room-user',
            username: 'MultiRoomUser'
          });
      }

      // 5. Verify messages in each room
      for (let i = 0; i < rooms.length; i++) {
        const messagesResponse = await request(chatBaseURL)
          .get(`/api/chat/rooms/${rooms[i].id}/messages`)
          .expect(200);

        const messages = messagesResponse.body.messages;
        expect(messages.length).toBe(1);
        expect(messages[0].content).toBe(`Message in room ${i}`);
      }

      // 6. Get all rooms for the space
      const spaceRoomsResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/space/${space.id}`)
        .expect(200);

      const spaceRooms = spaceRoomsResponse.body.rooms;
      expect(spaceRooms.length).toBe(3);
    });
  });

  describe('Real-time Chat Features Integration', () => {
    test('should handle typing indicators across services', async () => {
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Typing Indicator Space',
          dimensions: { width: 25, height: 25 }
        });

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Typing Indicator Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 2. Connect WebSocket and join
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'typing-user',
          username: 'TypingUser'
        }
      });

      await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/join`)
        .send({
          userId: 'typing-user',
          username: 'TypingUser'
        });

      // 3. Send typing indicator via HTTP
      const typingResponse = await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/typing`)
        .send({
          userId: 'typing-user',
          username: 'TypingUser',
          isTyping: true
        })
        .expect(200);

      expect(typingResponse.body.message).toBeDefined();

      // 4. Stop typing
      await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/typing`)
        .send({
          userId: 'typing-user',
          username: 'TypingUser',
          isTyping: false
        })
        .expect(200);
    });

    test('should handle message reactions integration', async () => {
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Reactions Space',
          dimensions: { width: 25, height: 25 }
        });

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Reactions Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 2. Send message via WebSocket
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'reaction-user',
          username: 'ReactionUser'
        }
      });

      const messageResponse = await TestUtils.sendWSMessage(ws, {
        type: 'chat-message',
        payload: {
          message: 'React to this message!',
          spaceId: space.id
        }
      });

      // 3. Get message ID from chat service
      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      const targetMessage = messages.find(msg => msg.content === 'React to this message!');
      expect(targetMessage).toBeDefined();

      // 4. Add reaction via HTTP
      const reactionResponse = await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/messages/${targetMessage.id}/reactions`)
        .send({
          userId: 'reaction-user',
          reaction: '👍'
        })
        .expect(200);

      expect(reactionResponse.body.reaction).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle chat in deleted space', async () => {
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Temporary Space',
          dimensions: { width: 20, height: 20 }
        });

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Temporary Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 2. Delete space
      await request(httpBaseURL)
        .delete(`/api/v1/spaces/${space.id}`)
        .expect(200);

      // 3. Try to send message to room
      const messageResponse = await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/messages`)
        .send({
          content: 'Message to deleted space',
          userId: 'test-user',
          username: 'TestUser'
        });

      // Should handle gracefully (either error or create orphaned message)
      expect([201, 400, 404]).toContain(messageResponse.status);
    });

    test('should handle WebSocket disconnect during chat', async () => {
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Disconnect Test Space',
          dimensions: { width: 30, height: 30 }
        });

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Disconnect Test Room',
          spaceId: space.id,
          isPublic: true
        });

      const room = roomResponse.body.room;

      // 2. Connect and join
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'disconnect-user',
          username: 'DisconnectUser'
        }
      });

      await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/join`)
        .send({
          userId: 'disconnect-user',
          username: 'DisconnectUser'
        });

      // 3. Send message
      await TestUtils.sendWSMessage(ws, {
        type: 'chat-message',
        payload: {
          message: 'Message before disconnect',
          spaceId: space.id
        }
      });

      // 4. Disconnect WebSocket
      ws.close();
      await TestUtils.sleep(100);

      // 5. Send message via HTTP (should still work)
      const httpMessageResponse = await request(chatBaseURL)
        .post(`/api/chat/rooms/${room.id}/messages`)
        .send({
          content: 'Message after disconnect',
          userId: 'disconnect-user',
          username: 'DisconnectUser'
        })
        .expect(201);

      expect(httpMessageResponse.body.message.content).toBe('Message after disconnect');

      // 6. Verify both messages are stored
      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      expect(messages.length).toBe(2);
    });
  });
});
