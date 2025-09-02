# WebSocket Authentication Debug Guide

## Common Reasons for Auto-Disconnection

### 1. Missing JWT Token
- **Error Code**: 1008
- **Message**: "No token provided"
- **Solution**: Include a valid JWT token in the join message

### 2. Invalid JWT Token
- **Error Code**: 1008  
- **Message**: "JWT Error: [specific error]"
- **Common Issues**:
  - Wrong JWT secret (must match `JWT_SECRET` in .env)
  - Expired token
  - Malformed token

### 3. Missing User Data in Token
- **Error Code**: 1008
- **Message**: "Invalid token - missing user data"
- **Solution**: Token must contain `userId` and `username` fields

### 4. Space Not Found
- **Error Code**: 1008
- **Message**: "Space not found"
- **Solution**: Use a valid space ID that exists in your database

## How to Test WebSocket Connection

### Step 1: Get a Valid Space ID
First, create or get a space using the HTTP API:

```bash
# Create a new space
curl -X POST http://localhost:3000/api/v1/space \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Space",
    "dimensions": "100x100",
    "mapId": "default"
  }'

# Or list existing spaces
curl -X GET http://localhost:3000/api/v1/space \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 2: Create a Valid JWT Token
The token must be signed with the same secret as in your .env file:

```javascript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    userId: 'your-user-id',
    username: 'your-username'
  },
  'prashant143tanu', // Must match JWT_SECRET in .env
  { expiresIn: '1h' }
);
```

### Step 3: Connect to WebSocket
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'join',
    payload: {
      spaceId: 'your-valid-space-id',
      token: 'your-valid-jwt-token'
    }
  }));
});
```

## Test Script
Run the test client to debug connection issues:

```bash
cd metaverse/apps/ws
npm run test
```

## Environment Variables Check
Make sure these are set in your .env file:

```env
JWT_SECRET="prashant143tanu"
DATABASE_URL="your-database-url"
WS_PORT=3001
```

## Debug Logs to Watch For

### Successful Connection:
```
🔐 [AUTH] Processing join request for space: space-id
🔑 [AUTH] Token provided: Yes
🔍 [AUTH] Verifying JWT token with secret: prash...
✅ [AUTH] Token verified successfully. UserId: user-123, Username: TestUser
🏢 [SPACE] Checking if space exists: space-id
✅ [SPACE] Space found: Test Space (space-id)
```

### Failed Connection:
```
❌ [AUTH] No token provided
❌ [JWT ERROR] Invalid JWT token: jwt malformed
❌ [SPACE] Space not found: invalid-space-id
```