# BUG-029: Stale User Position After Reconnect

## Bug Information

**Bug ID**: BUG-029  
**Title**: User Avatar Shows at Old Position After Reconnection  
**Severity**: Medium  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When a user disconnects (due to network issues, tab sleep, or page refresh) and reconnects, their avatar may appear at a stale/old position for other users. This happens because the reconnecting user's last known position is cached in Redis or in other users' local state, and the position update from the fresh join doesn't always propagate correctly.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Room Manager | `metaverse/apps/ws/src/RoomManager.ts` | Backend |
| User Handler | `metaverse/apps/ws/src/User.ts` | Backend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |
| WebSocket Service | `frontend/src/services/websocket.ts` | Frontend |

---

## Reproduction Steps

1. Open application in two browser windows (User A, User B)
2. Both users join the same space
3. User A moves to position (10, 10)
4. User B sees User A at (10, 10)
5. User A closes their browser tab
6. User A reopens the application and joins the same space
7. User A spawns at default position (5, 5)
8. User B still sees User A at (10, 10) - stale position!

**Expected Behavior**:  
User B should see User A at their new spawn position (5, 5).

**Actual Behavior**:  
User B continues to see User A at the old cached position (10, 10).

---

## Root Cause Analysis

### 1. User Leave Event Not Processed

When User A closes their tab abruptly, the WebSocket `close` event may not trigger proper cleanup:

```typescript
// metaverse/apps/ws/src/User.ts
ws.on('close', () => {
  this.handleDisconnect();
  // If this doesn't complete, user remains in room
});

// Network timeout may cause close to not fire immediately
```

### 2. Redis Cache Not Invalidated

The RoomManager caches user positions in Redis, but disconnect doesn't always clear them:

```typescript
// Position cached on move
await redis.hSet(`room:${roomId}:users`, {
  [userId]: JSON.stringify({ x, y })
});

// Should be deleted on disconnect, but may not happen
await redis.hDel(`room:${roomId}:users`, [userId]);
```

### 3. Race Condition on Rejoin

If reconnection happens quickly, the following race can occur:

```
T1: Old connection times out
T2: New connection joins (gets existing users from Redis - includes self!)
T3: Old connection finally cleans up
T4: New user's position broadcast gets lost
```

### 4. Frontend Doesn't Replace Existing User

Frontend may not properly handle a user with the same ID rejoining:

```typescript
// Current logic might append instead of replace
socket.on('user-joined', (user) => {
  setUsers(prev => [...prev, user]); // Doesn't check for duplicates!
});
```

---

## Solution

### 1. Implement Proper User Replacement on Join

```typescript
// frontend/src/app/space/[id]/page.tsx

socket.on('user-joined', (user: UserData) => {
  setUsers(prev => {
    // Remove any existing entry for this user ID first
    const filtered = prev.filter(u => u.id !== user.id);
    return [...filtered, user];
  });
});

socket.on('existing-users', (existingUsers: UserData[]) => {
  setUsers(prev => {
    // Merge existing users, preferring new data
    const userMap = new Map(prev.map(u => [u.id, u]));
    existingUsers.forEach(u => userMap.set(u.id, u));
    return Array.from(userMap.values());
  });
});
```

### 2. Add User Session Versioning

```typescript
// metaverse/apps/ws/src/User.ts

interface UserSession {
  id: string
  sessionVersion: number  // Increment on each connect
  x: number
  y: number
  connectedAt: number
}

handleJoin(message: JoinMessage): void {
  // Generate unique session version
  const sessionVersion = Date.now();
  
  this.broadcast({
    type: 'user-joined',
    payload: {
      id: this.userId,
      sessionVersion,
      x: spawnX,
      y: spawnY
    }
  });
}

// Frontend ignores updates from old sessions
socket.on('user-moved', (data) => {
  setUsers(prev => prev.map(u => {
    if (u.id === data.id && data.sessionVersion >= u.sessionVersion) {
      return { ...u, x: data.x, y: data.y, sessionVersion: data.sessionVersion };
    }
    return u;
  }));
});
```

### 3. Force Position Broadcast on Join

```typescript
// metaverse/apps/ws/src/User.ts

async handleJoin(message: JoinMessage): Promise<void> {
  // First, remove any stale data for this user
  await this.roomManager.removeUser(this.spaceId, this.userId);
  
  // Then add fresh
  await this.roomManager.addUser(this.spaceId, this.userId, {
    x: spawnX,
    y: spawnY,
    joinedAt: Date.now()
  });

  // Broadcast to ALL users (including those who had cached data)
  this.broadcastToAll({
    type: 'user-position-reset',
    payload: {
      id: this.userId,
      x: spawnX,
      y: spawnY
    }
  });
  
  // Also send to the joining user
  this.send({
    type: 'existing-users',
    payload: Array.from(this.room.users.values())
  });
}
```

### 4. Implement Heartbeat and Stale User Cleanup

```typescript
// metaverse/apps/ws/src/RoomManager.ts

class RoomManager {
  private readonly STALE_THRESHOLD = 30000; // 30 seconds
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleUsers();
    }, 10000);
  }

  async cleanupStaleUsers(): Promise<void> {
    const now = Date.now();
    
    for (const [roomId, room] of this.rooms) {
      const staleUsers: string[] = [];
      
      for (const [userId, userData] of room.users) {
        if (now - userData.lastSeen > this.STALE_THRESHOLD) {
          staleUsers.push(userId);
        }
      }
      
      for (const userId of staleUsers) {
        console.log(`🧹 Removing stale user ${userId} from room ${roomId}`);
        await this.removeUser(roomId, userId);
        this.broadcastToRoom(roomId, {
          type: 'user-left',
          payload: { id: userId }
        });
      }
    }
  }

  updateLastSeen(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room && room.users.has(userId)) {
      room.users.get(userId).lastSeen = Date.now();
    }
  }
}
```

### 5. Client-Side Heartbeat

```typescript
// frontend/src/services/websocket.ts

class WebSocketService {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds

  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    // ... rest of disconnect logic
  }
}
```

### 6. Handle Page Visibility Change

```typescript
// frontend/src/app/space/[id]/page.tsx

useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab became hidden - may disconnect soon
      console.log('Tab hidden - connection may become stale');
    } else {
      // Tab became visible - refresh state
      console.log('Tab visible - refreshing user positions');
      websocketService.send({
        type: 'request-room-state',
        payload: { spaceId }
      });
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [spaceId]);
```

---

## Testing

### Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Close tab abruptly | User removed within 30s |
| Refresh page | User appears at spawn, not old position |
| Network disconnect/reconnect | Position updates correctly |
| Sleep computer, wake up | State refreshes on wake |
| Switch tabs for 5+ minutes | Heartbeat keeps state fresh |

### Debug Logging

```typescript
// Add logging to track state
console.log(`[Position Debug] User ${userId}:`, {
  action: 'rejoin',
  oldPosition: cachedPosition,
  newPosition: { x: spawnX, y: spawnY },
  sessionVersion
});
```

---

## Prevention

1. **Always use unique session identifiers** for each connection
2. **Implement heartbeat** for connection liveness
3. **Clear cached state** before adding new state on join
4. **Use timestamps** to determine freshness of position data
5. **Handle `visibilitychange`** events to refresh state

---

## Related Issues

- **Related Bugs**: BUG-020 (users not visible), BUG-015 (disconnection loop)
- **Feature**: Could show "reconnecting" status for users with stale connections
- **UX**: Consider showing ghost avatar while position is uncertain

---

## Notes

- This bug is more common on mobile devices due to aggressive tab sleeping
- Consider using Service Workers for more reliable connection management
- WebSocket `close` event may have significant delay on network disconnects
- IndexedDB could be used to persist last known positions client-side
