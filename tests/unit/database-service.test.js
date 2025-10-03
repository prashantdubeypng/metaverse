const { PrismaClient } = require('@prisma/client');
const TestUtils = require('../test-utils');

describe('Database Service - Unit Tests', () => {
  let prisma;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Test database connection
    try {
      await prisma.$connect();
      console.log('🗄️ Database connection established for testing');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Delete in correct order to respect foreign key constraints
      await prisma.chatMessage.deleteMany({
        where: {
          OR: [
            { content: { contains: 'test' } },
            { username: { contains: 'test' } }
          ]
        }
      });
      
      await prisma.spaceUser.deleteMany({
        where: {
          OR: [
            { userId: { contains: 'test' } },
            { spaceId: { contains: 'test' } }
          ]
        }
      });
      
      await prisma.space.deleteMany({
        where: {
          OR: [
            { name: { contains: 'test' } },
            { name: { contains: 'Test' } }
          ]
        }
      });
      
      await prisma.user.deleteMany({
        where: {
          OR: [
            { username: { contains: 'test' } },
            { email: { contains: 'test' } }
          ]
        }
      });
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  describe('User Model', () => {
    test('should create a new user', async () => {
      const userData = {
        username: 'testuser1',
        email: 'testuser1@test.com'
      };

      const user = await prisma.user.create({
        data: userData
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    test('should find user by ID', async () => {
      // First create a user
      const userData = {
        username: 'testuser2',
        email: 'testuser2@test.com'
      };

      const createdUser = await prisma.user.create({
        data: userData
      });

      // Then find it
      const foundUser = await prisma.user.findUnique({
        where: { id: createdUser.id }
      });

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.username).toBe(userData.username);
    });

    test('should find user by username', async () => {
      const userData = {
        username: 'testuser3',
        email: 'testuser3@test.com'
      };

      await prisma.user.create({
        data: userData
      });

      const foundUser = await prisma.user.findUnique({
        where: { username: userData.username }
      });

      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(userData.username);
    });

    test('should update user', async () => {
      const userData = {
        username: 'testuser4',
        email: 'testuser4@test.com'
      };

      const createdUser = await prisma.user.create({
        data: userData
      });

      const updateData = {
        email: 'updated-testuser4@test.com'
      };

      const updatedUser = await prisma.user.update({
        where: { id: createdUser.id },
        data: updateData
      });

      expect(updatedUser.email).toBe(updateData.email);
      expect(updatedUser.username).toBe(userData.username); // Should remain unchanged
    });

    test('should delete user', async () => {
      const userData = {
        username: 'testuser5',
        email: 'testuser5@test.com'
      };

      const createdUser = await prisma.user.create({
        data: userData
      });

      await prisma.user.delete({
        where: { id: createdUser.id }
      });

      const deletedUser = await prisma.user.findUnique({
        where: { id: createdUser.id }
      });

      expect(deletedUser).toBeNull();
    });

    test('should enforce unique username constraint', async () => {
      const userData = {
        username: 'duplicate-user',
        email: 'user1@test.com'
      };

      await prisma.user.create({
        data: userData
      });

      // Try to create another user with same username
      await expect(
        prisma.user.create({
          data: {
            username: 'duplicate-user',
            email: 'user2@test.com'
          }
        })
      ).rejects.toThrow();
    });

    test('should enforce unique email constraint', async () => {
      const userData = {
        username: 'user1',
        email: 'duplicate@test.com'
      };

      await prisma.user.create({
        data: userData
      });

      // Try to create another user with same email
      await expect(
        prisma.user.create({
          data: {
            username: 'user2',
            email: 'duplicate@test.com'
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Space Model', () => {
    test('should create a new space', async () => {
      const spaceData = {
        name: 'Test Space 1',
        width: 20,
        height: 20,
        thumbnail: 'https://example.com/thumbnail.jpg'
      };

      const space = await prisma.space.create({
        data: spaceData
      });

      expect(space).toBeDefined();
      expect(space.id).toBeDefined();
      expect(space.name).toBe(spaceData.name);
      expect(space.width).toBe(spaceData.width);
      expect(space.height).toBe(spaceData.height);
      expect(space.thumbnail).toBe(spaceData.thumbnail);
      expect(space.createdAt).toBeDefined();
      expect(space.updatedAt).toBeDefined();
    });

    test('should find all spaces', async () => {
      // Create multiple spaces
      const spacesData = [
        { name: 'Test Space A', width: 10, height: 10 },
        { name: 'Test Space B', width: 15, height: 15 },
        { name: 'Test Space C', width: 20, height: 20 }
      ];

      for (const spaceData of spacesData) {
        await prisma.space.create({
          data: spaceData
        });
      }

      const spaces = await prisma.space.findMany({
        where: {
          name: {
            contains: 'Test Space'
          }
        }
      });

      expect(spaces.length).toBeGreaterThanOrEqual(3);
    });

    test('should update space', async () => {
      const spaceData = {
        name: 'Test Space Update',
        width: 20,
        height: 20
      };

      const createdSpace = await prisma.space.create({
        data: spaceData
      });

      const updateData = {
        name: 'Updated Test Space',
        width: 30,
        height: 30
      };

      const updatedSpace = await prisma.space.update({
        where: { id: createdSpace.id },
        data: updateData
      });

      expect(updatedSpace.name).toBe(updateData.name);
      expect(updatedSpace.width).toBe(updateData.width);
      expect(updatedSpace.height).toBe(updateData.height);
    });

    test('should delete space', async () => {
      const spaceData = {
        name: 'Test Space Delete',
        width: 20,
        height: 20
      };

      const createdSpace = await prisma.space.create({
        data: spaceData
      });

      await prisma.space.delete({
        where: { id: createdSpace.id }
      });

      const deletedSpace = await prisma.space.findUnique({
        where: { id: createdSpace.id }
      });

      expect(deletedSpace).toBeNull();
    });
  });

  describe('SpaceUser Relations', () => {
    let testUser;
    let testSpace;

    beforeEach(async () => {
      // Create test user and space
      testUser = await prisma.user.create({
        data: {
          username: 'testuser-relation',
          email: 'testuser-relation@test.com'
        }
      });

      testSpace = await prisma.space.create({
        data: {
          name: 'Test Space Relation',
          width: 20,
          height: 20
        }
      });
    });

    test('should create space-user relationship', async () => {
      const spaceUser = await prisma.spaceUser.create({
        data: {
          userId: testUser.id,
          spaceId: testSpace.id
        }
      });

      expect(spaceUser).toBeDefined();
      expect(spaceUser.userId).toBe(testUser.id);
      expect(spaceUser.spaceId).toBe(testSpace.id);
      expect(spaceUser.createdAt).toBeDefined();
    });

    test('should find users in space', async () => {
      // Add user to space
      await prisma.spaceUser.create({
        data: {
          userId: testUser.id,
          spaceId: testSpace.id
        }
      });

      const spaceWithUsers = await prisma.space.findUnique({
        where: { id: testSpace.id },
        include: {
          users: {
            include: {
              user: true
            }
          }
        }
      });

      expect(spaceWithUsers).toBeDefined();
      expect(spaceWithUsers.users.length).toBe(1);
      expect(spaceWithUsers.users[0].user.id).toBe(testUser.id);
    });

    test('should find spaces for user', async () => {
      // Add user to space
      await prisma.spaceUser.create({
        data: {
          userId: testUser.id,
          spaceId: testSpace.id
        }
      });

      const userWithSpaces = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: {
          spaces: {
            include: {
              space: true
            }
          }
        }
      });

      expect(userWithSpaces).toBeDefined();
      expect(userWithSpaces.spaces.length).toBe(1);
      expect(userWithSpaces.spaces[0].space.id).toBe(testSpace.id);
    });

    test('should remove user from space', async () => {
      // Add user to space
      await prisma.spaceUser.create({
        data: {
          userId: testUser.id,
          spaceId: testSpace.id
        }
      });

      // Remove user from space
      await prisma.spaceUser.delete({
        where: {
          userId_spaceId: {
            userId: testUser.id,
            spaceId: testSpace.id
          }
        }
      });

      const spaceUser = await prisma.spaceUser.findUnique({
        where: {
          userId_spaceId: {
            userId: testUser.id,
            spaceId: testSpace.id
          }
        }
      });

      expect(spaceUser).toBeNull();
    });
  });

  describe('Chat Messages', () => {
    test('should create chat message', async () => {
      const messageData = {
        content: 'Test chat message',
        userId: 'test-user-chat',
        username: 'TestUserChat',
        spaceId: 'test-space-chat'
      };

      const message = await prisma.chatMessage.create({
        data: messageData
      });

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.content).toBe(messageData.content);
      expect(message.userId).toBe(messageData.userId);
      expect(message.username).toBe(messageData.username);
      expect(message.spaceId).toBe(messageData.spaceId);
      expect(message.timestamp).toBeDefined();
    });

    test('should find messages by space', async () => {
      const spaceId = 'test-space-messages';
      
      // Create multiple messages
      for (let i = 0; i < 3; i++) {
        await prisma.chatMessage.create({
          data: {
            content: `Test message ${i}`,
            userId: `test-user-${i}`,
            username: `TestUser${i}`,
            spaceId: spaceId
          }
        });
      }

      const messages = await prisma.chatMessage.findMany({
        where: { spaceId: spaceId },
        orderBy: { timestamp: 'desc' }
      });

      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe('Test message 2'); // Most recent first
    });

    test('should find messages with pagination', async () => {
      const spaceId = 'test-space-pagination';
      
      // Create multiple messages
      for (let i = 0; i < 10; i++) {
        await prisma.chatMessage.create({
          data: {
            content: `Pagination message ${i}`,
            userId: `test-user-${i}`,
            username: `TestUser${i}`,
            spaceId: spaceId
          }
        });
      }

      const messages = await prisma.chatMessage.findMany({
        where: { spaceId: spaceId },
        orderBy: { timestamp: 'desc' },
        take: 5,
        skip: 0
      });

      expect(messages.length).toBe(5);
    });

    test('should find messages after timestamp', async () => {
      const spaceId = 'test-space-timestamp';
      const baseTime = new Date();
      
      // Create message before
      await prisma.chatMessage.create({
        data: {
          content: 'Message before',
          userId: 'test-user-before',
          username: 'TestUserBefore',
          spaceId: spaceId,
          timestamp: new Date(baseTime.getTime() - 1000)
        }
      });

      // Create message after
      await prisma.chatMessage.create({
        data: {
          content: 'Message after',
          userId: 'test-user-after',
          username: 'TestUserAfter',
          spaceId: spaceId,
          timestamp: new Date(baseTime.getTime() + 1000)
        }
      });

      const messages = await prisma.chatMessage.findMany({
        where: {
          spaceId: spaceId,
          timestamp: {
            gt: baseTime
          }
        }
      });

      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Message after');
    });

    test('should delete chat message', async () => {
      const messageData = {
        content: 'Test message to delete',
        userId: 'test-user-delete',
        username: 'TestUserDelete',
        spaceId: 'test-space-delete'
      };

      const createdMessage = await prisma.chatMessage.create({
        data: messageData
      });

      await prisma.chatMessage.delete({
        where: { id: createdMessage.id }
      });

      const deletedMessage = await prisma.chatMessage.findUnique({
        where: { id: createdMessage.id }
      });

      expect(deletedMessage).toBeNull();
    });
  });

  describe('Database Constraints and Validation', () => {
    test('should validate required fields', async () => {
      // Test missing required field for user
      await expect(
        prisma.user.create({
          data: {
            // Missing username and email
          }
        })
      ).rejects.toThrow();

      // Test missing required field for space
      await expect(
        prisma.space.create({
          data: {
            // Missing name, width, height
          }
        })
      ).rejects.toThrow();
    });

    test('should handle cascading deletes', async () => {
      // Create user and space
      const user = await prisma.user.create({
        data: {
          username: 'cascade-test-user',
          email: 'cascade-test@test.com'
        }
      });

      const space = await prisma.space.create({
        data: {
          name: 'Cascade Test Space',
          width: 20,
          height: 20
        }
      });

      // Create space-user relationship
      await prisma.spaceUser.create({
        data: {
          userId: user.id,
          spaceId: space.id
        }
      });

      // Delete user
      await prisma.user.delete({
        where: { id: user.id }
      });

      // Check that space-user relationship is also deleted
      const spaceUser = await prisma.spaceUser.findUnique({
        where: {
          userId_spaceId: {
            userId: user.id,
            spaceId: space.id
          }
        }
      });

      expect(spaceUser).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    test('should handle bulk operations efficiently', async () => {
      const bulkSize = 100;
      const userData = [];

      for (let i = 0; i < bulkSize; i++) {
        userData.push({
          username: `bulk-user-${i}`,
          email: `bulk-user-${i}@test.com`
        });
      }

      const startTime = Date.now();
      
      await prisma.user.createMany({
        data: userData
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete bulk insert in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify all users were created
      const createdUsers = await prisma.user.findMany({
        where: {
          username: {
            startsWith: 'bulk-user-'
          }
        }
      });

      expect(createdUsers.length).toBe(bulkSize);
    });

    test('should handle complex queries efficiently', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          username: 'complex-query-user',
          email: 'complex-query@test.com'
        }
      });

      const space = await prisma.space.create({
        data: {
          name: 'Complex Query Space',
          width: 20,
          height: 20
        }
      });

      await prisma.spaceUser.create({
        data: {
          userId: user.id,
          spaceId: space.id
        }
      });

      for (let i = 0; i < 10; i++) {
        await prisma.chatMessage.create({
          data: {
            content: `Complex query message ${i}`,
            userId: user.id,
            username: user.username,
            spaceId: space.id
          }
        });
      }

      const startTime = Date.now();

      // Complex query with joins
      const result = await prisma.space.findUnique({
        where: { id: space.id },
        include: {
          users: {
            include: {
              user: true
            }
          },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 5
          }
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.users.length).toBe(1);
      expect(result.messages.length).toBe(5);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
