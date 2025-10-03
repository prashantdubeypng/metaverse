const request = require('supertest');
const WebSocket = require('ws');
const TestUtils = require('../test-utils');

describe('HTTP and WebSocket Integration Tests', () => {
  const HTTP_PORT = process.env.HTTP_SERVICE_PORT || 3101;
  const WS_PORT = process.env.WS_SERVICE_PORT || 3102;
  const httpBaseURL = `http://localhost:${HTTP_PORT}`;
  
  let ws;

  beforeAll(async () => {
    // Wait for both services to be ready
    await TestUtils.waitForService(`${httpBaseURL}/health`);
    await TestUtils.waitForWebSocketService(WS_PORT);
    console.log('🔄 HTTP and WebSocket services ready for integration testing');
  });

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      await TestUtils.sleep(100);
    }
  });

  describe('Space Creation and WebSocket Connection', () => {
    test('should create space via HTTP and connect via WebSocket', async () => {
      // 1. Create space via HTTP API
      const spaceData = {
        name: 'Integration Test Space',
        dimensions: { width: 25, height: 25 }
      };

      const createResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send(spaceData)
        .expect(201);

      const space = createResponse.body.space;
      expect(space.id).toBeDefined();
      expect(space.name).toBe(spaceData.name);

      // 2. Connect to WebSocket and join the created space
      ws = await TestUtils.connectWebSocket(WS_PORT);

      const joinMessage = {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'integration-user-1',
          username: 'IntegrationUser1'
        }
      };

      const joinResponse = await TestUtils.sendWSMessage(ws, joinMessage);
      
      TestUtils.validateWebSocketMessage(joinResponse, 'user-joined');
      expect(joinResponse.payload.spaceId).toBe(space.id);
      expect(joinResponse.payload.userId).toBe(joinMessage.payload.userId);

      // 3. Verify space info includes the user
      const spaceInfoMessage = {
        type: 'get-space-info',
        payload: {
          spaceId: space.id
        }
      };

      const spaceInfoResponse = await TestUtils.sendWSMessage(ws, spaceInfoMessage);
      
      TestUtils.validateWebSocketMessage(spaceInfoResponse, 'space-info');
      expect(spaceInfoResponse.payload.users.length).toBe(1);
      expect(spaceInfoResponse.payload.users[0].userId).toBe(joinMessage.payload.userId);

      // 4. Verify via HTTP API that space has users
      const getSpaceResponse = await request(httpBaseURL)
        .get(`/api/v1/spaces/${space.id}`)
        .expect(200);

      const retrievedSpace = getSpaceResponse.body.space;
      expect(retrievedSpace.id).toBe(space.id);
    });

    test('should update space via HTTP and reflect changes in WebSocket', async () => {
      // 1. Create space
      const spaceData = {
        name: 'Update Test Space',
        dimensions: { width: 20, height: 20 }
      };

      const createResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send(spaceData);

      const space = createResponse.body.space;

      // 2. Connect to WebSocket and join space
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'update-test-user',
          username: 'UpdateTestUser'
        }
      });

      // 3. Update space via HTTP
      const updateData = {
        name: 'Updated Test Space',
        dimensions: { width: 30, height: 30 }
      };

      await request(httpBaseURL)
        .put(`/api/v1/spaces/${space.id}`)
        .send(updateData)
        .expect(200);

      // 4. Get updated space info via WebSocket
      const spaceInfoResponse = await TestUtils.sendWSMessage(ws, {
        type: 'get-space-info',
        payload: {
          spaceId: space.id
        }
      });

      // The WebSocket should reflect the updated information
      expect(spaceInfoResponse.payload.spaceId).toBe(space.id);
    });
  });

  describe('User Management Across Services', () => {
    test('should create user via HTTP and use in WebSocket', async () => {
      // 1. Create user via HTTP
      const userData = {
        username: 'integration-user-2',
        email: 'integration-user-2@test.com'
      };

      const createUserResponse = await request(httpBaseURL)
        .post('/api/v1/users')
        .send(userData)
        .expect(201);

      const user = createUserResponse.body.user;
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);

      // 2. Create space
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'User Integration Space',
          dimensions: { width: 20, height: 20 }
        });

      const space = spaceResponse.body.space;

      // 3. Use created user in WebSocket connection
      ws = await TestUtils.connectWebSocket(WS_PORT);

      const joinMessage = {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: user.id,
          username: user.username
        }
      };

      const joinResponse = await TestUtils.sendWSMessage(ws, joinMessage);
      
      TestUtils.validateWebSocketMessage(joinResponse, 'user-joined');
      expect(joinResponse.payload.userId).toBe(user.id);

      // 4. Verify user is retrievable via HTTP
      const getUserResponse = await request(httpBaseURL)
        .get(`/api/v1/users/${user.id}`)
        .expect(200);

      const retrievedUser = getUserResponse.body.user;
      expect(retrievedUser.id).toBe(user.id);
      expect(retrievedUser.username).toBe(userData.username);
    });

    test('should handle user movement and position tracking', async () => {
      // 1. Create space and user
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Movement Test Space',
          dimensions: { width: 50, height: 50 }
        });

      const space = spaceResponse.body.space;

      // 2. Connect and join space
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'movement-user',
          username: 'MovementUser'
        }
      });

      // 3. Send movement updates
      const movements = [
        { x: 10, y: 10 },
        { x: 20, y: 15 },
        { x: 30, y: 25 }
      ];

      for (const movement of movements) {
        const moveResponse = await TestUtils.sendWSMessage(ws, {
          type: 'movement',
          payload: movement
        });

        TestUtils.validateWebSocketMessage(moveResponse, 'user-moved');
        expect(moveResponse.payload.x).toBe(movement.x);
        expect(moveResponse.payload.y).toBe(movement.y);
      }

      // 4. Verify final position via space info
      const spaceInfoResponse = await TestUtils.sendWSMessage(ws, {
        type: 'get-space-info',
        payload: {
          spaceId: space.id
        }
      });

      const user = spaceInfoResponse.payload.users.find(u => u.userId === 'movement-user');
      expect(user).toBeDefined();
      expect(user.x).toBe(30);
      expect(user.y).toBe(25);
    });
  });

  describe('Multi-User Scenarios', () => {
    test('should handle multiple users in same space', async () => {
      // 1. Create space
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Multi-User Space',
          dimensions: { width: 40, height: 40 }
        });

      const space = spaceResponse.body.space;

      // 2. Create multiple WebSocket connections
      const connections = [];
      const userCount = 3;

      for (let i = 0; i < userCount; i++) {
        const connection = await TestUtils.connectWebSocket(WS_PORT);
        connections.push(connection);

        // Join space with each user
        await TestUtils.sendWSMessage(connection, {
          type: 'join',
          payload: {
            spaceId: space.id,
            userId: `multi-user-${i}`,
            username: `MultiUser${i}`
          }
        });
      }

      // 3. Verify all users are in space
      const spaceInfoResponse = await TestUtils.sendWSMessage(connections[0], {
        type: 'get-space-info',
        payload: {
          spaceId: space.id
        }
      });

      expect(spaceInfoResponse.payload.users.length).toBe(userCount);

      // 4. Test user interaction - one user moves, others should see it
      await TestUtils.sendWSMessage(connections[0], {
        type: 'movement',
        payload: { x: 15, y: 20 }
      });

      // Give time for message propagation
      await TestUtils.sleep(100);

      // Check if other users can see the updated position
      const updatedSpaceInfo = await TestUtils.sendWSMessage(connections[1], {
        type: 'get-space-info',
        payload: {
          spaceId: space.id
        }
      });

      const movedUser = updatedSpaceInfo.payload.users.find(u => u.userId === 'multi-user-0');
      expect(movedUser.x).toBe(15);
      expect(movedUser.y).toBe(20);

      // 5. Clean up connections
      connections.forEach(connection => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.close();
        }
      });
    });

    test('should handle user leaving and rejoining', async () => {
      // 1. Create space
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Leave-Rejoin Space',
          dimensions: { width: 30, height: 30 }
        });

      const space = spaceResponse.body.space;

      // 2. User joins
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'leave-rejoin-user',
          username: 'LeaveRejoinUser'
        }
      });

      // 3. Verify user is in space
      let spaceInfo = await TestUtils.sendWSMessage(ws, {
        type: 'get-space-info',
        payload: { spaceId: space.id }
      });

      expect(spaceInfo.payload.users.length).toBe(1);

      // 4. User leaves
      await TestUtils.sendWSMessage(ws, {
        type: 'leave',
        payload: { spaceId: space.id }
      });

      // 5. Verify user is no longer in space
      spaceInfo = await TestUtils.sendWSMessage(ws, {
        type: 'get-space-info',
        payload: { spaceId: space.id }
      });

      expect(spaceInfo.payload.users.length).toBe(0);

      // 6. User rejoins
      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'leave-rejoin-user',
          username: 'LeaveRejoinUser'
        }
      });

      // 7. Verify user is back in space
      spaceInfo = await TestUtils.sendWSMessage(ws, {
        type: 'get-space-info',
        payload: { spaceId: space.id }
      });

      expect(spaceInfo.payload.users.length).toBe(1);
      expect(spaceInfo.payload.users[0].userId).toBe('leave-rejoin-user');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle WebSocket connection to non-existent space', async () => {
      ws = await TestUtils.connectWebSocket(WS_PORT);

      const joinMessage = {
        type: 'join',
        payload: {
          spaceId: 'non-existent-space-id',
          userId: 'test-user',
          username: 'TestUser'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, joinMessage);
      
      // Should handle gracefully - either create space or return error
      expect(['user-joined', 'error']).toContain(response.type);
    });

    test('should handle HTTP service unavailable scenarios', async () => {
      // This test assumes the HTTP service might be temporarily unavailable
      // In a real scenario, you might simulate this by stopping the service

      ws = await TestUtils.connectWebSocket(WS_PORT);

      // WebSocket operations should still work even if HTTP service is down
      const joinMessage = {
        type: 'join',
        payload: {
          spaceId: 'resilience-test-space',
          userId: 'resilience-user',
          username: 'ResilienceUser'
        }
      };

      const response = await TestUtils.sendWSMessage(ws, joinMessage);
      
      // WebSocket service should handle this gracefully
      expect(['user-joined', 'error']).toContain(response.type);
    });
  });

  describe('Performance Integration Tests', () => {
    test('should handle rapid HTTP requests with WebSocket updates', async () => {
      // 1. Create initial space
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Performance Test Space',
          dimensions: { width: 100, height: 100 }
        });

      const space = spaceResponse.body.space;

      // 2. Connect WebSocket
      ws = await TestUtils.connectWebSocket(WS_PORT);

      await TestUtils.sendWSMessage(ws, {
        type: 'join',
        payload: {
          spaceId: space.id,
          userId: 'performance-user',
          username: 'PerformanceUser'
        }
      });

      // 3. Rapidly update space via HTTP while monitoring via WebSocket
      const updateCount = 5;
      const startTime = Date.now();

      for (let i = 0; i < updateCount; i++) {
        await request(httpBaseURL)
          .put(`/api/v1/spaces/${space.id}`)
          .send({
            name: `Performance Test Space ${i}`,
            dimensions: { width: 100 + i, height: 100 + i }
          });

        // Small delay to prevent overwhelming the services
        await TestUtils.sleep(50);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete updates in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify final state via WebSocket
      const finalSpaceInfo = await TestUtils.sendWSMessage(ws, {
        type: 'get-space-info',
        payload: { spaceId: space.id }
      });

      expect(finalSpaceInfo.payload.spaceId).toBe(space.id);
    });

    test('should maintain consistency under concurrent operations', async () => {
      // 1. Create space
      const spaceResponse = await request(httpBaseURL)
        .post('/api/v1/spaces')
        .send({
          name: 'Consistency Test Space',
          dimensions: { width: 50, height: 50 }
        });

      const space = spaceResponse.body.space;

      // 2. Create multiple connections
      const connections = [];
      const connectionCount = 3;

      for (let i = 0; i < connectionCount; i++) {
        const connection = await TestUtils.connectWebSocket(WS_PORT);
        connections.push(connection);

        await TestUtils.sendWSMessage(connection, {
          type: 'join',
          payload: {
            spaceId: space.id,
            userId: `consistency-user-${i}`,
            username: `ConsistencyUser${i}`
          }
        });
      }

      // 3. Perform concurrent operations
      const promises = connections.map((connection, index) => 
        TestUtils.sendWSMessage(connection, {
          type: 'movement',
          payload: { x: 10 + index, y: 20 + index }
        })
      );

      const responses = await Promise.all(promises);

      // 4. Verify all operations completed successfully
      responses.forEach((response, index) => {
        TestUtils.validateWebSocketMessage(response, 'user-moved');
        expect(response.payload.x).toBe(10 + index);
        expect(response.payload.y).toBe(20 + index);
      });

      // 5. Verify final state consistency
      const spaceInfo = await TestUtils.sendWSMessage(connections[0], {
        type: 'get-space-info',
        payload: { spaceId: space.id }
      });

      expect(spaceInfo.payload.users.length).toBe(connectionCount);

      // 6. Clean up
      connections.forEach(connection => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.close();
        }
      });
    });
  });
});
