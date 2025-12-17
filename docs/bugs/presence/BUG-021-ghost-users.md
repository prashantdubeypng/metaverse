# BUG-021: Ghost Users in Space

## Bug Information

**Bug ID**: BUG-021  
**Title**: Disconnected Users Remain Visible as Ghost Avatars  
**Severity**: Major  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When a user disconnects (closes browser, network failure, etc.), their avatar remains visible to other users in the space as a "ghost" - a static, unresponsive avatar. This ghost avatar can persist for minutes or indefinitely, confusing other users who try to interact with it.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Room Manager | `metaverse/apps/ws/src/RoomManager.ts` | Backend |
| User Handler | `metaverse/apps/ws/src/User.ts` | Backend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |

---

## Reproduction Steps

1. Open application in two browser windows (User A, User B)
2. Both users join the same space
3. User A sees User B's avatar
4. User B closes their browser tab abruptly (not graceful logout)
5. User A still sees User B's avatar
6. Wait 1 minute - avatar still visible
7. User A tries to video call User B - nothing happens

**Expected Behavior**:  
User B's avatar should disappear within seconds of disconnection.

**Actual Behavior**:  
User B's avatar remains visible indefinitely as a ghost.

---

## Root Cause Analysis

### 1. WebSocket Close Not Detected Immediately

When a browser tab is closed, the WebSocket `close` event may not fire immediately, especially if the network connection is the cause of disconnection:

```typescript
// metaverse/apps/ws/src/User.ts
ws.on('close', () => {
  this.handleDisconnect();
  // May not fire if network dies
});
```

### 2. No Heartbeat/Ping System

Without active heartbeat, the server can't detect dead connections:

```typescript
// Current: No heartbeat implementation
// Server doesn't know if client is alive
```

### 3. Room Manager Doesn't Clean Up

Even if disconnect is detected, room cleanup may fail:

```typescript
handleDisconnect(): void {
  // Remove from room
  this.roomManager.removeUser(this.spaceId, this.userId);
  // But broadcast may fail, other clients don't know
}
```

### 4. Frontend Doesn't Handle user-left

The frontend may not properly process user-left events:

```typescript
// May be missing or not working
socket.on('user-left', (data) => {
  setUsers(prev => prev.filter(u => u.id !== data.userId));
});
```

---

## Solution

### 1. Implement Server-Side Heartbeat

```typescript
// metaverse/apps/ws/src/index.ts

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 35000; // Allow 5 second grace

wss.on('connection', (ws, req) => {
  const user = new User(ws);
  
  // Mark connection as alive
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastPong = Date.now();
  });
  
  ws.on('message', () => {
    // Any message also proves liveness
    ws.isAlive = true;
  });
});

// Heartbeat check interval
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(`💀 Terminating dead connection`);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);
```

### 2. Add Client-Side Heartbeat Response

```typescript
// frontend/src/services/websocket.ts

class WebSocketService {
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPong: number = Date.now();
  private readonly PING_INTERVAL = 25000;
  private readonly PONG_TIMEOUT = 35000;

  setupHeartbeat(): void {
    // Send application-level ping
    this.pingInterval = setInterval(() => {
      if (!this.isConnected()) return;
      
      // Check if we got pong from last ping
      if (Date.now() - this.lastPong > this.PONG_TIMEOUT) {
        console.warn('⚠️ No pong received, reconnecting...');
        this.reconnect();
        return;
      }
      
      this.send({ type: 'ping', timestamp: Date.now() });
    }, this.PING_INTERVAL);

    // Handle pong response
    this.on('pong', () => {
      this.lastPong = Date.now();
    });
  }

  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    // ... rest of disconnect
  }
}
```

### 3. Implement Stale User Cleanup

```typescript
// metaverse/apps/ws/src/RoomManager.ts

class RoomManager {
  private readonly STALE_THRESHOLD = 60000; // 1 minute
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupGhostUsers();
    }, 30000);
  }

  async cleanupGhostUsers(): Promise<void> {
    const now = Date.now();
    
    for (const [roomId, room] of this.rooms) {
      const ghostUsers: string[] = [];
      
      for (const [userId, userData] of room.users) {
        // Check if user's connection is still in WebSocket server
        const hasActiveConnection = this.hasActiveConnection(userId);
        
        // Check last activity time
        const lastActivity = userData.lastActivity || 0;
        const isStale = now - lastActivity > this.STALE_THRESHOLD;
        
        if (!hasActiveConnection || isStale) {
          ghostUsers.push(userId);
        }
      }
      
      // Remove ghosts and notify remaining users
      for (const userId of ghostUsers) {
        console.log(`👻 Removing ghost user ${userId} from room ${roomId}`);
        await this.removeUserAndBroadcast(roomId, userId);
      }
    }
  }

  async removeUserAndBroadcast(roomId: string, userId: string): Promise<void> {
    this.removeUser(roomId, userId);
    
    // Broadcast to all clients in room
    this.broadcastToRoom(roomId, {
      type: 'user-left',
      payload: { userId, reason: 'ghost-cleanup' }
    });
    
    // Also update Redis if using shared state
    await this.redis.hDel(`room:${roomId}:users`, [userId]);
  }
}
```

### 4. Properly Handle user-left on Frontend

```typescript
// frontend/src/app/space/[id]/page.tsx

useEffect(() => {
  const handleUserLeft = (data: { userId: string; reason?: string }) => {
    console.log(`👋 User left: ${data.userId}, reason: ${data.reason}`);
    
    // Remove from users list
    setUsers(prev => prev.filter(u => u.id !== data.userId));
    
    // End any active video calls with this user
    proximityVideoCall.endCallWith(data.userId);
    
    // Remove from chat participants if in DM
    closeChatWith(data.userId);
    
    // Update UI
    toast.info(`${data.userId} has left the space`);
  };

  websocket.on('user-left', handleUserLeft);
  
  return () => {
    websocket.off('user-left', handleUserLeft);
  };
}, []);
```

### 5. Add Visual Indicator for Inactive Users

```typescript
// frontend/src/components/Avatar.tsx

interface Props {
  user: UserData;
  lastSeen?: number;
}

const Avatar: React.FC<Props> = ({ user, lastSeen }) => {
  const isInactive = lastSeen && Date.now() - lastSeen > 30000;
  
  return (
    <div 
      className={`avatar ${isInactive ? 'opacity-50 grayscale' : ''}`}
      title={isInactive ? 'User may be disconnected' : user.name}
    >
      {isInactive && (
        <div className="absolute -top-2 -right-2 text-xs">⚠️</div>
      )}
      {/* Avatar content */}
    </div>
  );
};
```

### 6. Request Room Refresh on Reconnect

```typescript
// frontend/src/services/websocket.ts

async handleReconnection(): Promise<void> {
  console.log('🔄 Reconnected, refreshing room state');
  
  // Request fresh user list from server
  this.send({
    type: 'request-room-state',
    payload: { spaceId: this.currentSpaceId }
  });
}

// Server handler
handleRequestRoomState(spaceId: string): void {
  const users = this.roomManager.getUsers(spaceId);
  
  // Filter out any users without active connections
  const activeUsers = users.filter(u => this.hasActiveConnection(u.id));
  
  this.send({
    type: 'room-state',
    payload: { users: activeUsers }
  });
}
```

---

## Testing

### Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Close browser tab | Avatar removed within 60s |
| Network disconnect | Avatar removed after heartbeat timeout |
| Force kill browser process | Server terminates connection, avatar removed |
| Rejoin after ghost | Old ghost replaced with new avatar |

### Manual Test

1. User A and B in room
2. User B: Open DevTools → Network → Offline
3. Wait 60 seconds
4. User A should see User B disappear
5. User B: Go back online
6. User B should be able to rejoin cleanly

---

## Prevention

1. **Always implement heartbeat** for WebSocket connections
2. **Run periodic cleanup** of stale users
3. **Handle reconnection** by refreshing full state
4. **Visual indicators** for potentially stale users
5. **Log disconnect reasons** for debugging

---

## Related Issues

- **Related Bugs**: BUG-020 (users not visible), BUG-029 (stale position)
- **UX**: Ghost users make the space feel broken
- **Performance**: Many ghosts can waste server resources

---

## Notes

- TCP keepalive can help but isn't reliable across all networks
- Mobile browsers aggressively kill background connections
- Consider showing "last seen" timestamp for all users
- WebSocket ping/pong is more reliable than application-level heartbeat
