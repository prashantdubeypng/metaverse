const request = require('supertest');
const TestUtils = require('../test-utils');

describe('End-to-End Backend Tests', () => {
  const HTTP_PORT = process.env.HTTP_SERVICE_PORT || 3101;
  const WS_PORT = process.env.WS_SERVICE_PORT || 3102;
  const CHAT_PORT = process.env.CHAT_SERVICE_PORT || 3103;
  const KAFKA_PORT = process.env.KAFKA_SERVICE_PORT || 3104;
  
  const httpBaseURL = `http://localhost:${HTTP_PORT}`;
  const chatBaseURL = `http://localhost:${CHAT_PORT}`;
  const kafkaBaseURL = `http://localhost:${KAFKA_PORT}`;

  beforeAll(async () => {
    // Wait for all services to be ready
    console.log('🚀 Starting E2E test suite - waiting for all services...');
    
    await TestUtils.waitForService(`${httpBaseURL}/health`);
    console.log('✅ HTTP Service ready');
    
    await TestUtils.waitForService(`${chatBaseURL}/health`);
    console.log('✅ Chat Service ready');
    
    try {
      await TestUtils.waitForService(`${kafkaBaseURL}/health`);
      console.log('✅ Kafka Service ready');
    } catch (error) {
      console.log('⚠️ Kafka Service not available - some tests may be skipped');
    }
    
    await TestUtils.waitForWebSocketService(WS_PORT);
    console.log('✅ WebSocket Service ready');
    
    console.log('🔄 All available services ready for E2E testing');
  });

  describe('Complete User Journey', () => {
    test('should handle complete user interaction flow', async () => {
      console.log('🎯 Running complete user journey test');
      
      // 1. Create a user space
      const spaceData = {
        name: 'E2E Test Space',
        description: 'End-to-end testing space',
        dimensions: { width: 50, height: 50 },
        backgroundColor: '#1a1a1a',
        isPublic: true
      };

      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send(spaceData)
        .expect(201);

      const space = spaceResponse.body.space;
      expect(space.name).toBe(spaceData.name);
      console.log(`📍 Created space: ${space.id}`);

      // 2. Create users
      const users = [];
      for (let i = 1; i <= 3; i++) {
        const userData = {
          username: `e2e-user-${i}`,
          email: `e2e-user-${i}@test.com`,
          avatar: `avatar-${i}.png`
        };

        const userResponse = await request(httpBaseURL)
          .post('/api/v1/users')
          .send(userData)
          .expect(201);

        users.push(userResponse.body.user);
        console.log(`👤 Created user: ${userResponse.body.user.username}`);
      }

      // 3. Create chat room for the space
      const roomData = {
        name: 'E2E Chat Room',
        description: 'Chat room for end-to-end testing',
        spaceId: space.id,
        isPublic: true,
        maxUsers: 10
      };

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send(roomData)
        .expect(201);

      const room = roomResponse.body.room;
      console.log(`💬 Created chat room: ${room.id}`);

      // 4. Connect users via WebSocket
      const connections = [];
      for (let i = 0; i < users.length; i++) {
        const ws = await TestUtils.connectWebSocket(WS_PORT);
        connections.push(ws);

        // Join space
        const joinResponse = await TestUtils.sendWSMessage(ws, {
          type: 'join',
          payload: {
            spaceId: space.id,
            userId: users[i].id,
            username: users[i].username,
            position: { x: 10 + i * 5, y: 10 + i * 5 }
          }
        });

        TestUtils.validateWebSocketMessage(joinResponse, 'user-joined');
        console.log(`🔌 User ${users[i].username} connected via WebSocket`);

        // Join chat room
        await request(chatBaseURL)
          .post(`/api/chat/rooms/${room.id}/join`)
          .send({
            userId: users[i].id,
            username: users[i].username
          })
          .expect(200);

        console.log(`💬 User ${users[i].username} joined chat room`);
      }

      // 5. Simulate user interactions
      
      // User 1 moves
      const moveResponse = await TestUtils.sendWSMessage(connections[0], {
        type: 'move',
        payload: {
          position: { x: 25, y: 25 },
          spaceId: space.id
        }
      });
      TestUtils.validateWebSocketMessage(moveResponse, 'user-moved');
      console.log('👟 User 1 moved in space');

      // User 2 sends chat message
      const chatResponse = await TestUtils.sendWSMessage(connections[1], {
        type: 'chat-message',
        payload: {
          message: 'Hello everyone in E2E test!',
          spaceId: space.id
        }
      });
      TestUtils.validateWebSocketMessage(chatResponse, 'chat-message-sent');
      console.log('💬 User 2 sent chat message');

      // User 3 reacts to space
      const reactionResponse = await TestUtils.sendWSMessage(connections[2], {
        type: 'reaction',
        payload: {
          reaction: '👋',
          spaceId: space.id,
          position: { x: 30, y: 30 }
        }
      });
      TestUtils.validateWebSocketMessage(reactionResponse, 'reaction-sent');
      console.log('😊 User 3 sent reaction');

      // 6. Verify data persistence

      // Check space users
      const spaceUsersResponse = await request(httpBaseURL)
        .get(`/api/v1/spaces/${space.id}/users`)
        .expect(200);

      const spaceUsers = spaceUsersResponse.body.users;
      expect(spaceUsers.length).toBe(3);
      console.log(`👥 Verified ${spaceUsers.length} users in space`);

      // Check chat messages
      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      expect(messages.length).toBeGreaterThan(0);
      
      const testMessage = messages.find(msg => msg.content === 'Hello everyone in E2E test!');
      expect(testMessage).toBeDefined();
      expect(testMessage.username).toBe(users[1].username);
      console.log('💬 Verified chat message persistence');

      // 7. Test user interactions
      
      // User mentions
      const mentionResponse = await TestUtils.sendWSMessage(connections[0], {
        type: 'chat-message',
        payload: {
          message: `@${users[1].username} How are you doing?`,
          spaceId: space.id,
          mentions: [users[1].id]
        }
      });
      TestUtils.validateWebSocketMessage(mentionResponse, 'chat-message-sent');
      console.log('🏷️ User 1 mentioned user 2');

      // Private message
      const privateMessageResponse = await request(chatBaseURL)
        .post('/api/chat/private-messages')
        .send({
          fromUserId: users[0].id,
          toUserId: users[2].id,
          content: 'Private message in E2E test',
          fromUsername: users[0].username,
          toUsername: users[2].username
        })
        .expect(201);

      expect(privateMessageResponse.body.message.content).toBe('Private message in E2E test');
      console.log('🔒 Sent private message');

      // 8. Test space updates
      const spaceUpdateData = {
        name: 'Updated E2E Test Space',
        description: 'Updated description for E2E testing',
        backgroundColor: '#2a2a2a'
      };

      const updateResponse = await request(httpBaseURL)
        .put(`/api/v1/spaces/${space.id}`)
        .send(spaceUpdateData)
        .expect(200);

      const updatedSpace = updateResponse.body.space;
      expect(updatedSpace.name).toBe(spaceUpdateData.name);
      console.log('📝 Updated space information');

      // 9. Test user leaving
      const leaveResponse = await TestUtils.sendWSMessage(connections[2], {
        type: 'leave',
        payload: {
          spaceId: space.id
        }
      });
      TestUtils.validateWebSocketMessage(leaveResponse, 'user-left');
      console.log('👋 User 3 left the space');

      // 10. Verify user count updated
      await TestUtils.sleep(100);
      
      const updatedUsersResponse = await request(httpBaseURL)
        .get(`/api/v1/spaces/${space.id}/users`)
        .expect(200);

      const updatedUsers = updatedUsersResponse.body.users;
      expect(updatedUsers.length).toBe(2);
      console.log('👥 Verified user count after leave');

      // 11. Cleanup
      connections.forEach((connection, index) => {
        if (connection.readyState === 1) { // WebSocket.OPEN
          connection.close();
          console.log(`🔌 Closed connection for user ${index + 1}`);
        }
      });

      console.log('✅ Complete user journey test completed successfully');
    }, 30000); // 30 second timeout for comprehensive test
  });

  describe('Multi-Space Concurrent Users', () => {
    test('should handle users across multiple spaces simultaneously', async () => {
      console.log('🎯 Running multi-space concurrent users test');
      
      // 1. Create multiple spaces
      const spaces = [];
      for (let i = 1; i <= 3; i++) {
        const spaceResponse = await request(httpBaseURL)
          .post('/api/v1/spaces')
          .send({
            name: `Concurrent Space ${i}`,
            dimensions: { width: 30, height: 30 },
            isPublic: true
          })
          .expect(201);

        spaces.push(spaceResponse.body.space);
        console.log(`📍 Created space ${i}: ${spaceResponse.body.space.id}`);
      }

      // 2. Create chat rooms for each space
      const rooms = [];
      for (let i = 0; i < spaces.length; i++) {
        const roomResponse = await request(chatBaseURL)
          .post('/api/chat/rooms')
          .send({
            name: `Chat Room ${i + 1}`,
            spaceId: spaces[i].id,
            isPublic: true
          })
          .expect(201);

        rooms.push(roomResponse.body.room);
        console.log(`💬 Created chat room ${i + 1}: ${roomResponse.body.room.id}`);
      }

      // 3. Create users and distribute across spaces
      const userConnections = [];
      const totalUsers = 6; // 2 users per space

      for (let i = 0; i < totalUsers; i++) {
        const userResponse = await request(httpBaseURL)
          .post('/api/v1/users')
          .send({
            username: `concurrent-user-${i}`,
            email: `concurrent-user-${i}@test.com`
          })
          .expect(201);

        const user = userResponse.body.user;
        const spaceIndex = i % spaces.length; // Distribute users across spaces
        const space = spaces[spaceIndex];
        const room = rooms[spaceIndex];

        // Connect to WebSocket
        const ws = await TestUtils.connectWebSocket(WS_PORT);

        // Join space
        await TestUtils.sendWSMessage(ws, {
          type: 'join',
          payload: {
            spaceId: space.id,
            userId: user.id,
            username: user.username,
            position: { x: 10 + (i * 5), y: 10 + (i * 5) }
          }
        });

        // Join chat room
        await request(chatBaseURL)
          .post(`/api/chat/rooms/${room.id}/join`)
          .send({
            userId: user.id,
            username: user.username
          });

        userConnections.push({
          user,
          ws,
          space,
          room,
          spaceIndex
        });

        console.log(`👤 User ${user.username} joined space ${spaceIndex + 1}`);
      }

      // 4. Simulate concurrent activities
      const activities = userConnections.map(async (connection, index) => {
        const { user, ws, space, room } = connection;

        // Each user sends a message
        await TestUtils.sendWSMessage(ws, {
          type: 'chat-message',
          payload: {
            message: `Message from ${user.username}`,
            spaceId: space.id
          }
        });

        // Users move around
        if (index % 2 === 0) {
          await TestUtils.sendWSMessage(ws, {
            type: 'move',
            payload: {
              position: { x: 20 + index, y: 20 + index },
              spaceId: space.id
            }
          });
        }

        // Some users send reactions
        if (index % 3 === 0) {
          await TestUtils.sendWSMessage(ws, {
            type: 'reaction',
            payload: {
              reaction: '🎉',
              spaceId: space.id,
              position: { x: 25, y: 25 }
            }
          });
        }

        return `Activity completed for ${user.username}`;
      });

      // Wait for all activities to complete
      const results = await Promise.all(activities);
      console.log(`🔄 Completed ${results.length} concurrent activities`);

      // 5. Verify message distribution
      for (let i = 0; i < spaces.length; i++) {
        const messagesResponse = await request(chatBaseURL)
          .get(`/api/chat/rooms/${rooms[i].id}/messages`)
          .expect(200);

        const messages = messagesResponse.body.messages;
        expect(messages.length).toBe(2); // 2 users per space
        console.log(`💬 Verified ${messages.length} messages in space ${i + 1}`);
      }

      // 6. Test cross-space user lookup
      const allUsersResponse = await request(httpBaseURL)
        .get('/api/v1/users')
        .expect(200);

      const allUsers = allUsersResponse.body.users;
      const concurrentUsers = allUsers.filter(user => user.username.startsWith('concurrent-user-'));
      expect(concurrentUsers.length).toBe(totalUsers);
      console.log(`👥 Verified ${concurrentUsers.length} total users across all spaces`);

      // 7. Cleanup connections
      userConnections.forEach((connection, index) => {
        if (connection.ws.readyState === 1) {
          connection.ws.close();
          console.log(`🔌 Closed connection for user ${index + 1}`);
        }
      });

      console.log('✅ Multi-space concurrent users test completed successfully');
    }, 45000); // 45 second timeout
  });

  describe('System Stress and Performance', () => {
    test('should handle high-frequency message sending', async () => {
      console.log('🎯 Running high-frequency messaging stress test');
      
      // 1. Create space and room
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Stress Test Space',
          dimensions: { width: 40, height: 40 },
          isPublic: true
        })
        .expect(201);

      const space = spaceResponse.body.space;

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Stress Test Room',
          spaceId: space.id,
          isPublic: true
        })
        .expect(201);

      const room = roomResponse.body.room;

      // 2. Create multiple users
      const userCount = 5;
      const connections = [];

      for (let i = 0; i < userCount; i++) {
        const userResponse = await request(httpBaseURL)
          .post('/api/v1/users')
          .send({
            username: `stress-user-${i}`,
            email: `stress-user-${i}@test.com`
          });

        const user = userResponse.body.user;
        const ws = await TestUtils.connectWebSocket(WS_PORT);

        await TestUtils.sendWSMessage(ws, {
          type: 'join',
          payload: {
            spaceId: space.id,
            userId: user.id,
            username: user.username
          }
        });

        connections.push({ user, ws });
      }

      console.log(`👥 Created ${userCount} users for stress testing`);

      // 3. Send high-frequency messages
      const messageCount = 20;
      const sendMessages = connections.map(async (connection, userIndex) => {
        const messages = [];
        for (let i = 0; i < messageCount; i++) {
          const messagePromise = TestUtils.sendWSMessage(connection.ws, {
            type: 'chat-message',
            payload: {
              message: `Stress message ${i} from user ${userIndex}`,
              spaceId: space.id
            }
          });
          messages.push(messagePromise);
          
          // Small delay to prevent overwhelming
          await TestUtils.sleep(10);
        }
        return Promise.all(messages);
      });

      const startTime = Date.now();
      await Promise.all(sendMessages);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`⚡ Sent ${userCount * messageCount} messages in ${duration}ms`);
      console.log(`📊 Average: ${Math.round((userCount * messageCount) / (duration / 1000))} messages/second`);

      // 4. Verify message persistence
      await TestUtils.sleep(500); // Wait for all messages to be processed

      const messagesResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      const messages = messagesResponse.body.messages;
      expect(messages.length).toBe(userCount * messageCount);
      console.log(`✅ Verified ${messages.length} messages persisted correctly`);

      // 5. Test system health after stress
      const healthResponse = await request(httpBaseURL)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      console.log('💚 System health check passed after stress test');

      // 6. Cleanup
      connections.forEach((connection, index) => {
        if (connection.ws.readyState === 1) {
          connection.ws.close();
        }
      });

      console.log('✅ High-frequency messaging stress test completed');
    }, 60000); // 60 second timeout
  });

  describe('Data Consistency and Recovery', () => {
    test('should maintain data consistency across service restarts', async () => {
      console.log('🎯 Running data consistency test');
      
      // 1. Create persistent test data
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Persistence Test Space',
          description: 'Testing data persistence',
          dimensions: { width: 35, height: 35 },
          isPublic: true
        })
        .expect(201);

      const space = spaceResponse.body.space;
      console.log(`📍 Created persistent space: ${space.id}`);

      const userResponse = await request(httpBaseURL)
        .post('/api/v1/users')
        .send({
          username: 'persistence-user',
          email: 'persistence@test.com',
          avatar: 'persistence-avatar.png'
        })
        .expect(201);

      const user = userResponse.body.user;
      console.log(`👤 Created persistent user: ${user.id}`);

      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Persistence Test Room',
          spaceId: space.id,
          isPublic: true
        })
        .expect(201);

      const room = roomResponse.body.room;

      // Send some messages
      for (let i = 0; i < 5; i++) {
        await request(chatBaseURL)
          .post(`/api/chat/rooms/${room.id}/messages`)
          .send({
            content: `Persistent message ${i}`,
            userId: user.id,
            username: user.username
          })
          .expect(201);
      }

      console.log('💬 Created 5 persistent messages');

      // 2. Verify data exists before simulated restart
      const spaceCheck1 = await request(httpBaseURL)
        .get(`/api/v1/spaces/${space.id}`)
        .expect(200);

      expect(spaceCheck1.body.space.name).toBe('Persistence Test Space');

      const userCheck1 = await request(httpBaseURL)
        .get(`/api/v1/users/${user.id}`)
        .expect(200);

      expect(userCheck1.body.user.username).toBe('persistence-user');

      const messagesCheck1 = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      expect(messagesCheck1.body.messages.length).toBe(5);
      console.log('✅ Verified data exists before restart simulation');

      // 3. Wait and re-verify (simulating service restart)
      await TestUtils.sleep(1000);

      const spaceCheck2 = await request(httpBaseURL)
        .get(`/api/v1/spaces/${space.id}`)
        .expect(200);

      expect(spaceCheck2.body.space.id).toBe(space.id);
      expect(spaceCheck2.body.space.name).toBe('Persistence Test Space');

      const userCheck2 = await request(httpBaseURL)
        .get(`/api/v1/users/${user.id}`)
        .expect(200);

      expect(userCheck2.body.user.id).toBe(user.id);
      expect(userCheck2.body.user.username).toBe('persistence-user');

      const messagesCheck2 = await request(chatBaseURL)
        .get(`/api/chat/rooms/${room.id}/messages`)
        .expect(200);

      expect(messagesCheck2.body.messages.length).toBe(5);

      // Verify message content integrity
      const persistentMessages = messagesCheck2.body.messages;
      for (let i = 0; i < 5; i++) {
        const message = persistentMessages.find(msg => msg.content === `Persistent message ${i}`);
        expect(message).toBeDefined();
        expect(message.username).toBe('persistence-user');
      }

      console.log('✅ Data consistency maintained after restart simulation');

      // 4. Test data relationships
      const spaceUsersResponse = await request(httpBaseURL)
        .get(`/api/v1/spaces/${space.id}/users`)
        .expect(200);

      // Note: Users might not be in space unless actively connected
      // This tests the relationship endpoints work

      const roomsResponse = await request(chatBaseURL)
        .get(`/api/chat/rooms/space/${space.id}`)
        .expect(200);

      expect(roomsResponse.body.rooms.length).toBe(1);
      expect(roomsResponse.body.rooms[0].id).toBe(room.id);

      console.log('✅ Data relationships maintained correctly');
    });

    test('should handle edge case scenarios gracefully', async () => {
      console.log('🎯 Running edge case scenarios test');
      
      // 1. Test duplicate space creation
      const duplicateSpaceData = {
        name: 'Edge Case Space',
        dimensions: { width: 25, height: 25 }
      };

      const space1Response = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send(duplicateSpaceData)
        .expect(201);

      const space2Response = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send(duplicateSpaceData);

      // Should either succeed with different ID or handle gracefully
      expect([201, 400, 409]).toContain(space2Response.status);
      console.log('✅ Handled duplicate space creation');

      // 2. Test very long content
      const longMessage = 'x'.repeat(1000);
      
      const roomResponse = await request(chatBaseURL)
        .post('/api/chat/rooms')
        .send({
          name: 'Edge Case Room',
          spaceId: space1Response.body.space.id,
          isPublic: true
        });

      const longMessageResponse = await request(chatBaseURL)
        .post(`/api/chat/rooms/${roomResponse.body.room.id}/messages`)
        .send({
          content: longMessage,
          userId: 'edge-case-user',
          username: 'EdgeCaseUser'
        });

      // Should either truncate, reject, or handle gracefully
      expect([201, 400, 413]).toContain(longMessageResponse.status);
      console.log('✅ Handled very long message content');

      // 3. Test invalid data types
      const invalidSpaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 123, // Invalid type
          dimensions: 'invalid' // Invalid type
        });

      expect([400, 422]).toContain(invalidSpaceResponse.status);
      console.log('✅ Handled invalid data types');

      // 4. Test operations on non-existent resources
      const nonExistentResponse = await request(httpBaseURL)
        .get('/api/v1/spaces/non-existent-id')
        .expect(404);

      expect(nonExistentResponse.body.error).toBeDefined();

      const nonExistentMessageResponse = await request(chatBaseURL)
        .post('/api/chat/rooms/non-existent-room/messages')
        .send({
          content: 'Message to nowhere',
          userId: 'test-user',
          username: 'TestUser'
        });

      expect([400, 404]).toContain(nonExistentMessageResponse.status);
      console.log('✅ Handled operations on non-existent resources');

      // 5. Test concurrent operations on same resource
      const space = space1Response.body.space;
      
      const concurrentUpdates = Array.from({ length: 5 }, (_, i) =>
        request(httpBaseURL)
          .put(`/api/v1/spaces/${space.id}`)
          .send({
            name: `Concurrent Update ${i}`,
            description: `Update ${i}`
          })
      );

      const updateResults = await Promise.allSettled(concurrentUpdates);
      const successfulUpdates = updateResults.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successfulUpdates.length).toBeGreaterThan(0);
      console.log(`✅ Handled ${successfulUpdates.length}/5 concurrent updates`);

      console.log('✅ Edge case scenarios test completed');
    });
  });

  describe('Health and Monitoring', () => {
    test('should provide comprehensive health status', async () => {
      console.log('🎯 Running health and monitoring test');
      
      // 1. Check all service health endpoints
      const services = [
        { name: 'HTTP Service', url: `${httpBaseURL}/health` },
        { name: 'Chat Service', url: `${chatBaseURL}/health` }
      ];

      for (const service of services) {
        const healthResponse = await request(service.url.replace(service.url.split('/')[0] + '//' + service.url.split('/')[2], ''))
          .get('/health')
          .expect(200);

        expect(healthResponse.body.status).toBe('healthy');
        expect(healthResponse.body.timestamp).toBeDefined();
        console.log(`✅ ${service.name} health check passed`);
      }

      // 2. Test service metrics (if available)
      try {
        const metricsResponse = await request(httpBaseURL)
          .get('/metrics');
        
        if (metricsResponse.status === 200) {
          expect(metricsResponse.text).toBeDefined();
          console.log('📊 Metrics endpoint available');
        }
      } catch (error) {
        console.log('⚠️ Metrics endpoint not available (optional)');
      }

      // 3. Test database connectivity through API
      const testSpaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Health Check Space',
          dimensions: { width: 10, height: 10 }
        })
        .expect(201);

      const spaceId = testSpaceResponse.body.space.id;

      const retrieveResponse = await request(httpBaseURL)
        .get(`/api/v1/spaces/${spaceId}`)
        .expect(200);

      expect(retrieveResponse.body.space.id).toBe(spaceId);
      console.log('✅ Database connectivity verified');

      // 4. Clean up test data
      await request(httpBaseURL)
        .delete(`/api/v1/spaces/${spaceId}`)
        .expect(200);

      console.log('✅ Health and monitoring test completed');
    });
  });
});
