// Jest setup file
import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '../metaverse/.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.HTTP_SERVICE_PORT = '3101';
process.env.WS_SERVICE_PORT = '3102';
process.env.CHAT_SERVICE_PORT = '3103';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/metaverse_test';

// Global test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  console.log('✅ Test suite completed');
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in tests:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in tests:', error);
});
