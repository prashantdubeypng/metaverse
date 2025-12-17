# Redis-Based Room State Persistence

## Problem Solved
When a user's WebSocket connection disconnects and reconnects, they couldn't see other users who were already in the room because the WebSocket state was lost. Both users would appear "lost" to each other.

## Solution: Redis State Persistence

### Backend Changes

#### 1. **RedisService.ts** - New Methods Added
```typescript
// Save user state in space
saveUserInSpace(spaceId, userId, userData)

// Remove user from space
removeUserFromSpace(spaceId, userId)

// Get all users in space (for reconnection)
getUsersInSpace(spaceId)

// Update user position
updateUserPosition(spaceId, userId, x, y)

// Clean up stale users (not updated in 5 minutes)
cleanupStaleUsersInSpace(spaceId, maxAgeMs)
```

**Redis Data Structure:**
```
Key: space:{spaceId}:users
Type: Hash
Value: {
  userId: {
    username: string,
    x: number,
    y: number,
    connectionId: string,
    lastUpdated: timestamp
  }
}
Expiration: 1 hour
```

#### 2. **Roommanager.ts** - Updated Methods

**addUser()** - Now async, persists to Redis:
```typescript
await this.redisService.saveUserInSpace(spaceId, userId, {
  username,
  x: user.getX(),
  y: user.getY(),
  connectionId: user.id
});
```

**removeUser()** - Removes from Redis:
```typescript
await this.redisService.removeUserFromSpace(spaceId, userId);
```

**New Methods:**
- `getUsersFromRedis(spaceId)` - Get users from Redis for reconnection
- `updateUserPositionInRedis(spaceId, userId, x, y)` - Update position in Redis

**cleanupDisconnectedUsers()** - Enhanced:
- Removes disconnected users from Redis
- Cleans up stale users (not updated in 5 minutes)

#### 3. **User.ts** - Updated Join & Move Handlers

**handleJoin()** - Merges users from memory AND Redis:
```typescript
// Get users from both memory AND Redis
const currentUsers = Roommanager.getInstance().getSpaceUsers(spaceId);
const redisUsers = await Roommanager.getInstance().getUsersFromRedis(spaceId);

// Merge users, removing duplicates (memory takes priority)
const userMap = new Map();

// Add connected users from memory (priority)
currentUsers.forEach(user => {
  userMap.set(user.getUserId(), {
    userId: user.getUserId(),
    username: user.getUsername(),
    x: user.getX(),
    y: user.getY()
  });
});

// Add users from Redis if not in memory (reconnection case)
redisUsers.forEach(user => {
  if (!userMap.has(user.userId)) {
    userMap.set(user.userId, user);
  }
});

const allUsers = Array.from(userMap.values());
```

**handleMove()** - Updates Redis position:
```typescript
this.x = moveX;
this.y = moveY;

// Update position in Redis
if (this.userId) {
  await Roommanager.getInstance().updateUserPositionInRedis(
    this.spaceId, 
    this.userId, 
    moveX, 
    moveY
  );
}
```

### Frontend - Already Has Auto-Reconnect

**websocketService.ts** already includes:
- ✅ Automatic reconnection with exponential backoff
- ✅ Message queue for offline messages
- ✅ Heartbeat to detect connection issues
- ✅ Max 5 reconnection attempts
- ✅ Retry interval: 1s → 2s → 4s → 8s → 16s → 30s (max)

## How It Works

### Scenario 1: Normal Operation
1. User A joins space → Saved to Redis & memory
2. User B joins space → Saved to Redis & memory
3. Both users see each other (from memory)
4. Users move → Updates Redis & broadcasts to others

### Scenario 2: User Reconnects
1. User A is in space (in Redis & memory)
2. User B's connection drops → Removed from memory only
3. User B reconnects:
   - Frontend automatically reconnects (exponential backoff)
   - Backend `handleJoin()` runs
   - Gets users from memory (User A connected)
   - Gets users from Redis (User B's old state cleaned, User A still there)
   - Merges and sends complete user list
4. User B sees User A ✅

### Scenario 3: Multiple Reconnections
1. Users A, B, C in space
2. User B disconnects → Still in Redis for 5 minutes
3. User A disconnects and reconnects → Sees B & C from Redis
4. After 5 minutes, cleanup removes stale User B
5. Only active users remain in Redis

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Joins Space                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  1. Verify JWT & Space                                  │
│  2. Calculate spawn position                            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  3. Add to RoomManager (Memory + Redis)                 │
│     - Memory: User object with WebSocket               │
│     - Redis: User data (id, name, position)            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  4. Get Other Users                                     │
│     a) From Memory (connected users)                    │
│     b) From Redis (all users incl. recent disconnects) │
│     c) Merge (remove duplicates, memory priority)      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  5. Send 'space-joined' event                          │
│     - spawn position                                    │
│     - merged user list                                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  6. Broadcast 'user-joined-space' to others             │
└─────────────────────────────────────────────────────────┘
```

## Benefits

✅ **Resilient to Connection Issues** - Users don't "disappear" on reconnection
✅ **No State Loss** - Redis persists user positions during brief disconnections
✅ **Automatic Cleanup** - Stale users removed after 5 minutes
✅ **Scalable** - Redis can handle millions of users across spaces
✅ **Performance** - Redis operations are fast (< 1ms typically)
✅ **Backwards Compatible** - Memory-based system still works, Redis is additive

## Configuration

**Redis Connection:**
```env
REDIS_URL=redis://localhost:6379
```

**Timeouts:**
- User state expiration: 1 hour
- Stale user cleanup: 5 minutes
- Cleanup runs: Every 30 seconds

## Testing Instructions

### Test Reconnection Scenario:

1. **Open two browser windows**
   ```
   Window A: http://localhost:3000/space/{spaceId}
   Window B: http://localhost:3000/space/{spaceId}
   ```

2. **Both users join** - Should see each other

3. **Disconnect User A:**
   - Close Window A (or kill network)
   - User A disappears from User B's view

4. **Reconnect User A:**
   - Open Window A again
   - Login and join space
   - **Expected:** User A immediately sees User B ✅
   - **Expected:** User B sees User A rejoin ✅

5. **Verify Redis Data:**
   ```bash
   redis-cli
   > HGETALL space:{spaceId}:users
   ```
   Should show both users with positions

## Monitoring

**Check Redis health:**
```typescript
const health = await redisService.healthCheck();
console.log(health); // { status: 'healthy', latency: 2 }
```

**Check room stats:**
```typescript
const stats = Roommanager.getInstance().getStats();
console.log(stats); 
// {
//   totalSpaces: 3,
//   totalUsers: 5,
//   spacesWithUsers: [
//     { spaceId: 'abc', userCount: 2 },
//     { spaceId: 'def', userCount: 3 }
//   ]
// }
```

## Logs to Watch

**User joins:**
```
💾 [REDIS SPACE] Saved user Alice in space abc123 at (10, 5)
```

**User reconnects:**
```
📖 [REDIS SPACE] Retrieved 2 users from space abc123
📊 [SPACE JOIN] Sending 2 users to Alice: 1 from memory, 2 from Redis
```

**Position updates:**
```
📍 [REDIS SPACE] Updated position for user xyz789 in space abc123 to (15, 8)
```

**Cleanup:**
```
🧹 [REDIS CLEANUP] Removed stale user xyz789 from space abc123
🧹 [REDIS CLEANUP] Cleaned up 1 stale users from space abc123
```

## Future Enhancements

1. **Pub/Sub for Multi-Server** - Use Redis Pub/Sub to sync across multiple WebSocket servers
2. **User Activity Tracking** - Track when users were last active
3. **Persistent Chat History** - Store chat messages in Redis
4. **Space Analytics** - Track peak users, average session time
5. **Ghost Mode** - Show "ghost" avatars for recently disconnected users

## Troubleshooting

**Users not appearing after reconnect:**
1. Check Redis is running: `redis-cli ping` → PONG
2. Check Redis connection in logs: "✅ All Redis connections established"
3. Verify user saved to Redis: `redis-cli HGETALL space:{spaceId}:users`
4. Check cleanup isn't too aggressive (5 minute threshold)

**Redis connection failed:**
```
❌ Redis Client Error: ECONNREFUSED
```
Solution: Start Redis server or check REDIS_URL

**Stale users accumulating:**
- Check cleanup interval is running (every 30s)
- Verify `cleanupStaleUsersInSpace()` is being called
- Increase cleanup frequency if needed
