# Metaverse Backend Testing Suite

A comprehensive testing framework for the Metaverse backend services, including unit tests, integration tests, and end-to-end tests.

## Overview

This testing suite covers all backend services:
- **HTTP Service** (Port 3001/3101) - REST API for spaces and users
- **WebSocket Service** (Port 3002/3102) - Real-time communication
- **Chat Service** (Port 3003/3103) - Chat rooms and messaging
- **Database Service** - Data persistence and relationships
- **Kafka Service** (Port 3004/3104) - Event streaming (optional)

## Test Structure

```
tests/
├── unit/                          # Unit tests for individual services
│   ├── http-service.test.js       # HTTP API endpoints testing
│   ├── websocket-service.test.js  # WebSocket functionality testing
│   ├── chat-service.test.js       # Chat service testing
│   └── database-service.test.js   # Database operations testing
├── integration/                   # Integration tests between services
│   ├── http-websocket.test.js     # HTTP + WebSocket integration
│   └── chat-integration.test.js   # Chat + Space integration
├── e2e/                          # End-to-end tests
│   └── backend-e2e.test.js       # Complete user journey tests
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Test setup and teardown
├── jest.sequencer.js             # Custom test sequencer
├── test-utils.js                 # Shared testing utilities
├── test-environment.js           # Service management for tests
├── run-tests.js                  # Test runner script
├── test-runner.bat               # Windows test runner
├── test-runner.sh                # Unix/Linux test runner
└── package.json                  # Test dependencies
```

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- pnpm package manager
- PostgreSQL database (configured)

### Installation

```bash
# Install test dependencies
cd tests
pnpm install
```

### Running Tests

#### Option 1: Using Test Runner Scripts (Recommended)

**Windows:**
```cmd
# Run all tests with service management
test-runner.bat --start-services --stop-after

# Run only unit tests
test-runner.bat --only unit --verbose

# Skip E2E tests
test-runner.bat --skip-e2e
```

**Unix/Linux/macOS:**
```bash
# Make script executable
chmod +x test-runner.sh

# Run all tests with service management
./test-runner.sh --start-services --stop-after

# Run only integration tests
./test-runner.sh --only integration --verbose

# Skip E2E tests with custom timeout
./test-runner.sh --skip-e2e --timeout 60000
```

#### Option 2: Manual Service Management

```bash
# Start services manually (in separate terminals)
cd .. && pnpm run dev:http    # Terminal 1
cd .. && pnpm run dev:ws      # Terminal 2
cd .. && pnpm run dev:chat    # Terminal 3

# Run tests
pnpm test                     # All tests
pnpm test:unit               # Unit tests only
pnpm test:integration        # Integration tests only
pnpm test:e2e                # E2E tests only
pnpm test:watch              # Watch mode
```

#### Option 3: Direct Jest Commands

```bash
# Run specific test files
npx jest unit/http-service.test.js
npx jest integration/
npx jest --testPathPattern="websocket"

# Run with coverage
npx jest --coverage

# Run in watch mode
npx jest --watch
```

## Test Configuration

### Environment Variables

The test suite uses the following environment variables:

```bash
NODE_ENV=test
HTTP_SERVICE_PORT=3101
WS_SERVICE_PORT=3102
CHAT_SERVICE_PORT=3103
KAFKA_SERVICE_PORT=3104
DATABASE_URL=your_test_database_url
VERBOSE_TESTS=true  # Enable verbose logging
```

### Test Database

Tests require a separate test database to avoid conflicts with development data:

```bash
# Set test database URL
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/metaverse_test"

# Or in package.json
{
  "scripts": {
    "test": "cross-env TEST_DATABASE_URL=postgresql://... jest"
  }
}
```

## Test Categories

### Unit Tests

Test individual service functionality in isolation:

- **HTTP Service Tests**: API endpoints, validation, error handling
- **WebSocket Service Tests**: Connection management, message handling
- **Chat Service Tests**: Room management, messaging, user management
- **Database Service Tests**: CRUD operations, relationships, constraints

### Integration Tests

Test interactions between services:

- **HTTP + WebSocket Integration**: Coordinated user actions
- **Chat Integration**: Space and chat room coordination
- **Multi-user Scenarios**: Concurrent user interactions

### End-to-End Tests

Test complete user journeys:

- **Complete User Flow**: Space creation → User join → Chat → Leave
- **Multi-space Scenarios**: Users across multiple spaces
- **Stress Testing**: High-frequency operations
- **Data Consistency**: Persistence across service restarts

## Test Utilities

### WebSocket Testing

```javascript
const TestUtils = require('./test-utils');

// Connect to WebSocket
const ws = await TestUtils.connectWebSocket(3102);

// Send message and wait for response
const response = await TestUtils.sendWSMessage(ws, {
  type: 'join',
  payload: { spaceId: 'space-id', userId: 'user-id' }
});

// Validate response
TestUtils.validateWebSocketMessage(response, 'user-joined');
```

### Service Health Checks

```javascript
// Wait for service to be ready
await TestUtils.waitForService('http://localhost:3101/health');

// Wait for WebSocket service
await TestUtils.waitForWebSocketService(3102);

// Check all services
const status = await testEnv.checkServices();
```

### Test Data Creation

```javascript
// Create test space
const space = await TestUtils.createTestSpace({
  name: 'Test Space',
  dimensions: { width: 30, height: 30 }
});

// Create test user
const user = await TestUtils.createTestUser({
  username: 'testuser',
  email: 'test@example.com'
});

// Create test chat room
const room = await TestUtils.createTestChatRoom({
  name: 'Test Room',
  spaceId: space.id
});
```

## Test Runner Options

### Command Line Options

```bash
--start-services    # Start backend services before running tests
--stop-after        # Stop services after tests complete
--verbose           # Enable verbose output and logging
--skip-e2e          # Skip end-to-end tests (faster execution)
--only <suite>      # Run only tests matching suite name (unit/integration/e2e)
--timeout <ms>      # Set test timeout in milliseconds (default: 30000)
--help, -h          # Show help message
```

### Examples

```bash
# Development workflow - quick unit tests
./test-runner.sh --only unit

# CI/CD pipeline - full test suite
./test-runner.sh --start-services --stop-after --verbose

# Performance testing - E2E only with longer timeout
./test-runner.sh --only e2e --timeout 120000 --start-services

# Debug specific issues - integration tests with verbose logging
./test-runner.sh --only integration --verbose --start-services
```

## Performance Considerations

### Test Execution Speed

- **Unit Tests**: ~5-10 seconds
- **Integration Tests**: ~15-30 seconds  
- **E2E Tests**: ~30-60 seconds
- **Full Suite**: ~60-90 seconds

### Optimization Tips

1. **Run tests in parallel** where possible (unit tests)
2. **Use `--runInBand`** for WebSocket tests to avoid port conflicts
3. **Skip E2E tests** during development with `--skip-e2e`
4. **Use `--only`** flag to run specific test categories
5. **Enable `--verbose`** only when debugging

## Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check if ports are already in use
netstat -an | find "3101"  # Windows
lsof -i :3101              # Unix/Linux/macOS

# Kill processes using test ports
taskkill /F /IM node.exe   # Windows
pkill -f "node.*3101"      # Unix/Linux/macOS
```

**Database connection errors:**
```bash
# Verify database is running
pg_isready -h localhost -p 5432

# Check database URL
echo $DATABASE_URL
echo $TEST_DATABASE_URL
```

**WebSocket connection timeouts:**
```bash
# Increase timeout in tests
--timeout 60000

# Check WebSocket service logs
node run-tests.js --verbose --only integration
```

**Memory issues with large test suites:**
```bash
# Run tests with more memory
node --max-old-space-size=4096 run-tests.js

# Run test categories separately
./test-runner.sh --only unit
./test-runner.sh --only integration  
./test-runner.sh --only e2e
```

### Debug Mode

Enable verbose logging for detailed output:

```bash
# Environment variable
export VERBOSE_TESTS=true

# Command line flag
./test-runner.sh --verbose

# Direct Jest with debug
DEBUG=* npx jest
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Backend Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: metaverse_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install pnpm
        run: npm install -g pnpm
        
      - name: Install dependencies
        run: pnpm install
        
      - name: Run tests
        run: |
          cd tests
          ./test-runner.sh --start-services --stop-after --verbose
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/metaverse_test
```

## Coverage Reports

Generate test coverage reports:

```bash
# Generate coverage for unit tests
pnpm test:coverage

# View coverage report
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html # Windows
```

Expected coverage targets:
- **Unit Tests**: >80% line coverage
- **Integration Tests**: >70% feature coverage
- **E2E Tests**: >90% user journey coverage

## Contributing

When adding new tests:

1. **Follow naming conventions**: `feature.test.js`
2. **Use descriptive test names**: `should handle user joining space with existing users`
3. **Include setup/teardown**: Clean up resources after tests
4. **Add to appropriate category**: Unit, integration, or E2E
5. **Update this README**: Document new test patterns or utilities

### Test Template

```javascript
const request = require('supertest');
const TestUtils = require('../test-utils');

describe('New Feature Tests', () => {
  beforeAll(async () => {
    // Setup once before all tests
  });

  beforeEach(async () => {
    // Setup before each test
  });

  afterEach(async () => {
    // Cleanup after each test
  });

  afterAll(async () => {
    // Cleanup once after all tests
  });

  test('should handle specific scenario', async () => {
    // Test implementation
    expect(result).toBeDefined();
  });
});
```
