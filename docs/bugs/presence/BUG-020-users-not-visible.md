# BUG-020: Users Not Visible After Reconnect

## Bug Information

**Bug ID**: BUG-020  
**Title**: Users Already in Space Not Visible After WebSocket Reconnection  
**Severity**: Critical  
**Status**: Fixed  
**Date Reported**: 2025-12-01  
**Date Fixed**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Development Team  

---

## Summary

When a user's WebSocket connection drops and reconnects (due to network issues, laptop sleep, etc.), they do not see other users who were already in the space. The reconnected user's space appears empty even though other users are present. This breaks the collaborative experience of the virtual office.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Room Manager | `metaverse/apps/ws/src/Roommanager.ts` | Backend |
| User Handler | `metaverse/apps/ws/src/User.ts` | Backend |
| Redis Service | `metaverse/apps/ws/src/RedisService.ts` | Backend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |

---

## Reproduction Steps

1. Open two browser windows with different users
2. Both users join the same space
3. Verify both users can see each other
4. Disconnect User A's network (airplane mode, or kill WS connection)
5. Wait 10 seconds, reconnect User A's network
6. User A rejoins the space automatically
7. Observe: User A cannot see User B

**Expected Behavior**:  
After reconnection, User A should see all users currently in the space, including User B.

**Actual Behavior**:  
User A's space appears empty. User B is still there but not visible to User A.

---

## Console Logs / Error Messages

```
// User A's console after reconnect
🔗 WebSocket connected
🎮 Successfully joined space at: {x: 2, y: 2}
👥 [DEBUG] Received users from space-joined: []  // ← Empty!
👥 [DEBUG] Processed other users: []
```

---

## Root Cause Analysis

### Problem

When the Room Manager returned the list of users in a space, it only looked at **in-memory connected users**. If a user was connected to a different WebSocket server instance (in a scaled deployment) or if the in-memory list was out of sync, users would be missing.

Additionally, the original implementation did not persist user positions to Redis, so there was no way to recover state after a server restart or reconnection.

### Technical Details

**File**: `metaverse/apps/ws/src/Roommanager.ts` (Original)

```typescript
// BUGGY: Only returns in-memory users
getSpaceUsers(spaceId: string): User[] {
  return this.spaces.get(spaceId) || [];
}
```

---

## Solution

### Approach

1. Store user positions in Redis when they join/move
2. On `space-joined`, merge users from both memory AND Redis
3. Remove users from Redis when they disconnect
4. Add TTL (time-to-live) to Redis entries to auto-clean stale users

### Code Changes

**File**: `metaverse/apps/ws/src/Roommanager.ts`

```typescript
// Add Redis-backed user storage
class Roommanager {
  private redisService: RedisService;

  async addUser(spaceId: string, user: User): Promise<void> {
    // Add to in-memory map
    if (!this.spaces.has(spaceId)) {
      this.spaces.set(spaceId, []);
    }
    this.spaces.get(spaceId)!.push(user);

    // Persist to Redis
    const userId = user.getUserId();
    const username = user.getUsername();
    if (userId && username) {
      await this.redisService.hset(
        `space:${spaceId}:users`,
        userId,
        JSON.stringify({
          userId,
          username,
          x: user.getX(),
          y: user.getY(),
          connectedAt: Date.now()
        })
      );
      // Set TTL for auto-cleanup (5 minutes)
      await this.redisService.expire(`space:${spaceId}:users`, 300);
    }
  }

  async updateUserPositionInRedis(
    spaceId: string, 
    userId: string, 
    x: number, 
    y: number
  ): Promise<void> {
    const existing = await this.redisService.hget(`space:${spaceId}:users`, userId);
    if (existing) {
      const userData = JSON.parse(existing);
      await this.redisService.hset(
        `space:${spaceId}:users`,
        userId,
        JSON.stringify({ ...userData, x, y })
      );
    }
  }

  async getUsersFromRedis(spaceId: string): Promise<Array<{
    userId: string;
    username: string;
    x: number;
    y: number;
  }>> {
    const usersHash = await this.redisService.hgetall(`space:${spaceId}:users`);
    if (!usersHash) return [];

    return Object.values(usersHash).map(json => JSON.parse(json));
  }

  async removeUser(user: User, spaceId: string): Promise<void> {
    // Remove from memory
    const users = this.spaces.get(spaceId);
    if (users) {
      const idx = users.indexOf(user);
      if (idx !== -1) users.splice(idx, 1);
      if (users.length === 0) {
        this.spaces.delete(spaceId);
      }
    }

    // Remove from Redis
    const userId = user.getUserId();
    if (userId) {
      await this.redisService.hdel(`space:${spaceId}:users`, userId);
    }
  }
}
```

**File**: `metaverse/apps/ws/src/User.ts` (handleJoin)

```typescript
private async handleJoin(payload: JoinPayload): Promise<void> {
  // ... authentication and validation ...

  // Add user to room manager (now async for Redis)
  await Roommanager.getInstance().addUser(spaceId, this);

  // Get users from both memory AND Redis
  const currentUsers = Roommanager.getInstance().getSpaceUsers(spaceId);
  const redisUsers = await Roommanager.getInstance().getUsersFromRedis(spaceId);

  // Merge users, removing duplicates (prefer memory for connected users)
  const userMap = new Map<string, any>();

  // Add connected users from memory (priority)
  currentUsers
    .filter(user => user.id !== this.id)
    .forEach(user => {
      const uid = user.getUserId();
      if (uid) {
        userMap.set(uid, {
          userId: uid,
          username: user.getUsername(),
          x: user.getX(),
          y: user.getY(),
        });
      }
    });

  // Add users from Redis if not in memory (reconnection recovery)
  redisUsers
    .filter(user => user.userId !== this.userId)
    .forEach(user => {
      if (!userMap.has(user.userId)) {
        userMap.set(user.userId, user);
      }
    });

  const allUsers = Array.from(userMap.values());

  console.log(`📊 [SPACE JOIN] Sending ${allUsers.length} users: ` +
    `${currentUsers.length} from memory, ${redisUsers.length} from Redis`);

  // Send join confirmation with merged user list
  this.send({
    type: 'space-joined',
    payload: {
      spawn: { x: this.x, y: this.y },
      users: allUsers
    }
  });
}
```

---

## Redis Data Structure

```
Key: space:{spaceId}:users
Type: Hash
TTL: 300 seconds (5 minutes)

Fields:
  {userId1}: '{"userId":"user1","username":"Alice","x":3,"y":2,"connectedAt":1234567890}'
  {userId2}: '{"userId":"user2","username":"Bob","x":5,"y":4,"connectedAt":1234567891}'
```

---

## Testing

### Manual Testing

1. Open two browser windows with different users
2. Both join the same space
3. Verify they can see each other
4. Open browser DevTools → Network → Disable network
5. Wait 30 seconds
6. Re-enable network
7. Verify both users can still see each other

### Automated Testing

```typescript
describe('BUG-020: User Persistence', () => {
  it('should store user in Redis on join', async () => {
    const spaceId = 'test-space';
    const mockUser = createMockUser('user1', 'Alice', 3, 2);
    
    await roomManager.addUser(spaceId, mockUser);
    
    const redisUsers = await roomManager.getUsersFromRedis(spaceId);
    expect(redisUsers).toContainEqual({
      userId: 'user1',
      username: 'Alice',
      x: 3,
      y: 2,
      connectedAt: expect.any(Number)
    });
  });

  it('should merge memory and Redis users on rejoin', async () => {
    const spaceId = 'test-space';
    
    // User1 is in memory (connected)
    const user1 = createMockUser('user1', 'Alice', 3, 2);
    await roomManager.addUser(spaceId, user1);
    
    // User2 is only in Redis (from previous connection)
    await redisService.hset(
      `space:${spaceId}:users`,
      'user2',
      JSON.stringify({ userId: 'user2', username: 'Bob', x: 5, y: 4 })
    );
    
    // New user joins
    const newUser = createMockUser('user3', 'Charlie', 1, 1);
    await roomManager.addUser(spaceId, newUser);
    
    const allUsers = await getAllUsersForSpace(spaceId);
    expect(allUsers.length).toBe(3); // Alice, Bob, Charlie
  });
});
```

---

## Edge Cases

1. **Stale Redis entries**: TTL handles cleanup, but position might be outdated
2. **User in Redis but actually disconnected**: Check via memory map first
3. **Race condition**: User might rejoin while cleanup is running
4. **Multiple server instances**: Redis ensures consistency across servers

---

## Related Issues

- **Related Bugs**: BUG-021 (ghost users), BUG-022 (duplicate users)
- **Infrastructure**: Requires Redis to be running
- **Scaling**: This fix enables horizontal WebSocket scaling

---

## Notes

- Redis TTL of 5 minutes is a balance between data freshness and recovery window
- Consider adding heartbeat to refresh TTL for active users
- Monitor Redis memory usage with many concurrent users
- Future: Use Redis pub/sub for cross-server user presence updates
