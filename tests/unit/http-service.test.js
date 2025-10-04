const request = require('supertest');
const TestUtils = require('../test-utils');

describe('HTTP Service - Unit Tests', () => {
  const HTTP_PORT = process.env.HTTP_SERVICE_PORT || 3101;
  const baseURL = `http://localhost:${HTTP_PORT}`;
  let server;

  beforeAll(async () => {
    // Wait for HTTP service to be ready
    await TestUtils.waitForService(`${baseURL}/health`);
    console.log('🌐 HTTP Service ready for testing');
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Health Endpoint', () => {
    test('should return health status', async () => {
      const response = await request(baseURL)
        .get('/health')
        .expect(200);

      const data = TestUtils.validateResponse(response);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('http-service');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    test('should handle preflight requests', async () => {
      const response = await request(baseURL)
        .options('/api/v1/spaces')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('API v1 Routes', () => {
    describe('Spaces API', () => {
      let testSpace;

      beforeEach(async () => {
        testSpace = await TestUtils.createTestSpace();
      });

      test('should create a new space', async () => {
        const spaceData = {
          name: testSpace.name,
          dimensions: testSpace.dimensions
        };

        const response = await request(baseURL)
          .post('/api/v1/spaces')
          .send(spaceData)
          .expect(201);

        const data = TestUtils.validateResponse(response, 201);
        expect(data.space).toBeDefined();
        expect(data.space.name).toBe(spaceData.name);
        expect(data.space.dimensions).toEqual(spaceData.dimensions);
        expect(data.space.id).toBeDefined();
      });

      test('should get all spaces', async () => {
        const response = await request(baseURL)
          .get('/api/v1/spaces')
          .expect(200);

        const data = TestUtils.validateResponse(response);
        expect(data.spaces).toBeDefined();
        expect(Array.isArray(data.spaces)).toBe(true);
      });

      test('should get specific space by ID', async () => {
        // First create a space
        const createResponse = await request(baseURL)
          .post('/api/v1/spaces')
          .send({
            name: testSpace.name,
            dimensions: testSpace.dimensions
          });

        const createdSpace = createResponse.body.space;

        // Then get it by ID
        const response = await request(baseURL)
          .get(`/api/v1/spaces/${createdSpace.id}`)
          .expect(200);

        const data = TestUtils.validateResponse(response);
        expect(data.space).toBeDefined();
        expect(data.space.id).toBe(createdSpace.id);
        expect(data.space.name).toBe(testSpace.name);
      });

      test('should handle space not found', async () => {
        const nonExistentId = 'non-existent-space-id';
        
        const response = await request(baseURL)
          .get(`/api/v1/spaces/${nonExistentId}`)
          .expect(404);

        expect(response.body.error).toBeDefined();
      });

      test('should validate space creation data', async () => {
        const invalidSpaceData = {
          // Missing required fields
        };

        const response = await request(baseURL)
          .post('/api/v1/spaces')
          .send(invalidSpaceData)
          .expect(400);

        expect(response.body.error).toBeDefined();
      });

      test('should update space', async () => {
        // First create a space
        const createResponse = await request(baseURL)
          .post('/api/v1/spaces')
          .send({
            name: testSpace.name,
            dimensions: testSpace.dimensions
          });

        const createdSpace = createResponse.body.space;

        // Then update it
        const updateData = {
          name: 'Updated Space Name',
          dimensions: { width: 30, height: 30 }
        };

        const response = await request(baseURL)
          .put(`/api/v1/spaces/${createdSpace.id}`)
          .send(updateData)
          .expect(200);

        const data = TestUtils.validateResponse(response);
        expect(data.space.name).toBe(updateData.name);
        expect(data.space.dimensions).toEqual(updateData.dimensions);
      });

      test('should delete space', async () => {
        // First create a space
        const createResponse = await request(baseURL)
          .post('/api/v1/spaces')
          .send({
            name: testSpace.name,
            dimensions: testSpace.dimensions
          });

        const createdSpace = createResponse.body.space;

        // Then delete it
        const response = await request(baseURL)
          .delete(`/api/v1/spaces/${createdSpace.id}`)
          .expect(200);

        const data = TestUtils.validateResponse(response);
        expect(data.message).toBeDefined();

        // Verify it's deleted
        await request(baseURL)
          .get(`/api/v1/spaces/${createdSpace.id}`)
          .expect(404);
      });
    });

    describe('Users API', () => {
      let testUser;

      beforeEach(async () => {
        testUser = await TestUtils.createTestUser();
      });

      test('should create a new user', async () => {
        const userData = {
          username: testUser.username,
          email: `${testUser.username}@test.com`
        };

        const response = await request(baseURL)
          .post('/api/v1/users')
          .send(userData)
          .expect(201);

        const data = TestUtils.validateResponse(response, 201);
        expect(data.user).toBeDefined();
        expect(data.user.username).toBe(userData.username);
        expect(data.user.email).toBe(userData.email);
        expect(data.user.id).toBeDefined();
      });

      test('should get user by ID', async () => {
        // First create a user
        const createResponse = await request(baseURL)
          .post('/api/v1/users')
          .send({
            username: testUser.username,
            email: `${testUser.username}@test.com`
          });

        const createdUser = createResponse.body.user;

        // Then get it by ID
        const response = await request(baseURL)
          .get(`/api/v1/users/${createdUser.id}`)
          .expect(200);

        const data = TestUtils.validateResponse(response);
        expect(data.user).toBeDefined();
        expect(data.user.id).toBe(createdUser.id);
        expect(data.user.username).toBe(testUser.username);
      });

      test('should handle duplicate username', async () => {
        const userData = {
          username: testUser.username,
          email: `${testUser.username}@test.com`
        };

        // Create first user
        await request(baseURL)
          .post('/api/v1/users')
          .send(userData)
          .expect(201);

        // Try to create another user with same username
        const response = await request(baseURL)
          .post('/api/v1/users')
          .send({
            username: testUser.username,
            email: `different-${testUser.username}@test.com`
          })
          .expect(409);

        expect(response.body.error).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      test('should handle malformed JSON', async () => {
        const response = await request(baseURL)
          .post('/api/v1/spaces')
          .send('invalid json')
          .type('application/json')
          .expect(400);

        expect(response.body.error).toBeDefined();
      });

      test('should handle unknown routes', async () => {
        const response = await request(baseURL)
          .get('/api/v1/unknown-route')
          .expect(404);

        expect(response.body.error).toBeDefined();
      });

      test('should handle large payloads', async () => {
        const largePayload = {
          name: 'A'.repeat(10000), // Very long name
          dimensions: { width: 100, height: 100 }
        };

        const response = await request(baseURL)
          .post('/api/v1/spaces')
          .send(largePayload)
          .expect(413);

        expect(response.body.error).toBeDefined();
      });
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(baseURL)
            .get('/health')
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body.status).toBe('ok');
      });
    });

    test('should respond within acceptable time', async () => {
      const start = Date.now();
      
      await request(baseURL)
        .get('/health')
        .expect(200);

      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});
