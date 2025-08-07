# 🔌 WebSocket Testing Guide

## Overview
This guide covers comprehensive testing for your metaverse WebSocket server, including connection tests, user interactions, and real-time messaging.

## Test Files Created

### 1. `websocket-tests.test.js` - Full Test Suite
Comprehensive Jest test suite covering:
- **Connection Tests** - Basic WebSocket connectivity
- **Authentication** - JWT token validation
- **Space Management** - Joining/leaving spaces
- **User Movement** - Position updates and validation  
- **Multi-user Interactions** - Broadcasting and user presence
- **Error Handling** - Malformed messages and edge cases
- **Security** - Token validation and authorization

### 2. `simple-websocket-test.js` - Quick Manual Test
Simple script for manual testing and debugging WebSocket connections.

## Running the Tests

### Prerequisites
1. **Start the HTTP server** (port 3000):
   ```bash
   cd apps/http
   npm start
   ```

2. **Start the WebSocket server** (port 3001):
   ```bash
   cd apps/ws  
   npm start
   ```

3. **Install test dependencies**:
   ```bash
   cd tests
   npm install
   ```

### Run Full Test Suite
```bash
cd tests
npm test websocket-tests.test.js
```

### Run Simple Manual Test
```bash
cd tests
node simple-websocket-test.js
```

## Test Coverage

### 🔗 Connection Tests
- ✅ Basic WebSocket connection establishment
- ❌ Connection error handling
- ⏰ Connection timeout scenarios

### 🏠 Space Join Functionality  
- ✅ Valid token + valid space = successful join
- ❌ Invalid token = connection closed (code 1008)
- ❌ Nonexistent space = connection closed (code 1008)
- ❌ Missing token = error handling

### 🚶 Movement Validation
- ✅ Valid moves (1 unit horizontal/vertical)
- ❌ Invalid moves (>1 unit, diagonal)
- 📡 Movement broadcasting to other users
- 🔄 Position validation and rejection

### 👥 Multi-User Interactions
- 📢 User join notifications
- 👋 User leave notifications  
- 🌐 Multiple users in same space
- 🔄 Real-time message broadcasting

### 🛡️ Security & Error Handling
- 🔒 JWT token validation (expired, wrong secret)
- 📝 Malformed JSON message handling
- ❓ Unknown message type handling
- ⚡ Rapid message sending

## Message Types Tested

### Incoming Messages (Client → Server)
```javascript
// Join a space
{
  type: 'join',
  payload: {
    spaceId: 'space-uuid',
    token: 'jwt-token'
  }
}

// Move user position
{
  type: 'move', 
  payload: {
    x: number,
    y: number
  }
}
```

### Outgoing Messages (Server → Client)
```javascript
// Successful space join
{
  type: 'Space-joined',
  payload: {
    spawn: { x: number, y: number },
    Users: [{ userId: string }]
  }
}

// User movement broadcast
{
  type: 'user-moved',
  payload: {
    userId: string,
    x: number, 
    y: number
  }
}

// Movement rejected
{
  type: 'move-rejected',
  payload: {
    userId: string,
    x: number,
    y: number
  }
}

// User joined space
{
  type: 'user-joined-space',
  payload: {
    userId: string,
    x: number,
    y: number  
  }
}

// User left space
{
  type: 'user-left',
  payload: {
    userId: string
  }
}
```

## Test Scenarios

### Basic Flow Test
1. Connect to WebSocket
2. Send join message with valid token & space
3. Receive Space-joined confirmation
4. Send valid move command
5. Verify movement is processed
6. Disconnect and verify cleanup

### Multi-User Test
1. Connect two WebSocket clients
2. Both join same space
3. Move one user
4. Verify other user receives movement broadcast
5. Disconnect one user
6. Verify other user receives leave notification

### Error Handling Test
1. Send invalid JSON → should handle gracefully
2. Send join with bad token → should close connection
3. Send move before join → should handle gracefully
4. Send rapid fire messages → should process all

## Expected Test Results

### When Running Full Test Suite
```
🔌 WebSocket Server Tests
  🔗 WebSocket Connection Tests
    ✅ Should establish WebSocket connection
    ❌ Should handle connection errors gracefully
  🏠 Space Join Functionality
    ✅ Should join space successfully with valid token
    ❌ Should reject join with invalid token
    ❌ Should reject join with nonexistent space
    ❌ Should reject join without token
  🚶 User Movement Tests
    ✅ Should accept valid move (1 unit)
    ❌ Should reject invalid move (more than 1 unit)
    ❌ Should reject diagonal move
  👥 Multi-User Interaction Tests
    ✅ Should broadcast user join to other users
    ✅ Should broadcast user leave to other users
    ✅ Should handle multiple users in same space
  🛡️ Error Handling & Edge Cases
    ❌ Should handle malformed JSON messages
    ❌ Should handle unknown message types
    ✅ Should handle rapid message sending
  🔒 Security Tests
    ❌ Should reject expired JWT token
    ❌ Should reject token with wrong secret

Tests: 16 passed, 16 total
```

## Debugging Tips

### WebSocket Not Connecting
- Check if WebSocket server is running on port 3001
- Verify no firewall blocking the port
- Check server logs for startup errors

### Tests Failing
- Ensure HTTP server is running (needed for user/space creation)
- Check if database is accessible
- Verify JWT secret matches between test and server

### Manual Testing
Use the simple test script to debug specific issues:
```bash
node simple-websocket-test.js
```

## Integration with Your Architecture

These tests validate:
- **User.ts** - User class functionality and message handling
- **Roommanager.ts** - Room management and broadcasting
- **types.ts** - Message type definitions
- **index.ts** - WebSocket server setup and connection handling

The tests ensure your real-time metaverse platform works correctly for:
- User authentication via JWT
- Space-based user management  
- Real-time position updates
- Multi-user synchronization
- Error handling and security

## Performance Considerations

The tests include scenarios for:
- Multiple concurrent connections
- Rapid message sending
- Connection cleanup
- Memory leak prevention
- Error recovery

This ensures your WebSocket server can handle production loads effectively! 🚀
