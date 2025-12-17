# BUG-032: Connection Lost to Room Users After Page Refresh

## Bug Information

**Bug ID**: BUG-032  
**Title**: User Loses Connection to Other Room Users After Page Refresh  
**Severity**: Critical  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: User Report  
**Assignee**: Unassigned  

---

## Summary

When a user refreshes the page while in a room, they lose connection to all other users who were previously in that room. The refreshed user can no longer see other users' movements, receive chat messages, or establish video calls with them. Other users also cannot see the refreshed user's updates.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| WebSocket Service | `frontend/src/services/websocket.ts` | Frontend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |
| User Handler | `metaverse/apps/ws/src/User.ts` | Backend |
| Room Manager | `metaverse/apps/ws/src/RoomManager.ts` | Backend |

---

## Reproduction Steps

1. User A joins a room/space
2. User B joins the same room
3. Both users can see each other and interact normally
4. User A refreshes the browser page (F5 or Ctrl+R)
5. **Bug occurs:**
   - User A cannot see User B anymore
   - User B cannot see User A's movements
   - Chat messages don't sync between them
   - Video calls cannot be established

**Expected Behavior**:  
After refresh, User A should rejoin the room and reconnect with all existing users seamlessly.

**Actual Behavior**:  
User A appears to be in a separate instance of the room, isolated from User B.

---

## Root Cause Analysis

### 1. WebSocket Not Rejoining Room Properly

When the page refreshes, the WebSocket connection is terminated and a new one is created. However, the new connection may not properly rejoin the room:

```typescript
// frontend/src/services/websocket.ts
// On reconnect, may not be sending join message
connect(): void {
  this.ws = new WebSocket(WS_URL);
  this.ws.onopen = () => {
    // Missing: Re-join previous room!
  };
}
```

### 2. Room State Not Persisted Client-Side

The frontend doesn't remember which room it was in before refresh:

```typescript
// frontend/src/app/space/[id]/page.tsx
useEffect(() => {
  // Gets spaceId from URL, but may not be joining properly
  websocket.send({ type: 'join', payload: { spaceId } });
  // Token may be missing or expired
}, []);
```

### 3. Backend Not Cleaning Up Old Connection

The old WebSocket connection before refresh may not be properly cleaned up:

```typescript
// metaverse/apps/ws/src/User.ts
ws.on('close', () => {
  // May be slow to remove user from room
  this.handleDisconnect();
  // User might still be in room list when new connection joins
});
```

### 4. Duplicate User Handling Issue

The backend may create a duplicate user entry or fail to replace the old one:

```typescript
// When same user rejoins with new connection
handleJoin(message: JoinMessage): void {
  // May not check if user already exists in room
  this.roomManager.addUser(spaceId, userId, userData);
  // Creates duplicate instead of replacing
}
```

### 5. Authentication Token Issues

The JWT token may not be properly restored from storage after refresh:

```typescript
// Token lost from memory on refresh
const token = localStorage.getItem('token'); // May be null
websocket.connect(spaceId, token); // Fails silently
```

---

## Solution

### 1. Persist Room State in localStorage

```typescript
// frontend/src/services/websocket.ts

class WebSocketService {
  private currentRoom: { spaceId: string; token: string } | null = null;

  joinRoom(spaceId: string, token: string): void {
    this.currentRoom = { spaceId, token };
    
    // Persist to localStorage for refresh recovery
    localStorage.setItem('current_room', JSON.stringify({
      spaceId,
      token,
      joinedAt: Date.now()
    }));

    this.send({
      type: 'join',
      payload: { spaceId, token }
    });
  }

  private restoreRoomOnReconnect(): void {
    const savedRoom = localStorage.getItem('current_room');
    if (savedRoom) {
      try {
        const { spaceId, token, joinedAt } = JSON.parse(savedRoom);
        
        // Check if session is still valid (within 24 hours)
        if (Date.now() - joinedAt < 24 * 60 * 60 * 1000) {
          console.log(`🔄 Rejoining room ${spaceId} after refresh`);
          this.joinRoom(spaceId, token);
        } else {
          localStorage.removeItem('current_room');
        }
      } catch (error) {
        console.error('Failed to restore room:', error);
        localStorage.removeItem('current_room');
      }
    }
  }

  connect(): void {
    this.ws = new WebSocket(WS_URL);
    
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.emit('connected');
      
      // Automatically rejoin room after reconnect
      this.restoreRoomOnReconnect();
    };
  }
}
```

### 2. Implement Proper Reconnection Flow

```typescript
// frontend/src/app/space/[id]/page.tsx

const SpacePage = ({ params }: { params: { id: string } }) => {
  const spaceId = params.id;
  const [reconnecting, setReconnecting] = useState(false);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      router.push('/login');
      return;
    }

    const handleConnected = async () => {
      if (hasJoinedRef.current) {
        console.log('⚠️ Already joined, skipping duplicate join');
        return;
      }

      console.log(`🚪 Joining space ${spaceId}`);
      
      try {
        await websocket.joinRoom(spaceId, token);
        hasJoinedRef.current = true;
        setReconnecting(false);
      } catch (error) {
        console.error('Failed to join room:', error);
        toast.error('Failed to join space');
      }
    };

    const handleDisconnected = () => {
      console.log('🔌 WebSocket disconnected');
      setReconnecting(true);
      hasJoinedRef.current = false;
    };

    const handleReconnected = () => {
      console.log('🔄 WebSocket reconnected, rejoining room...');
      handleConnected();
    };

    websocket.on('connected', handleConnected);
    websocket.on('disconnected', handleDisconnected);
    websocket.on('reconnected', handleReconnected);

    // Initial connection
    if (websocket.isConnected()) {
      handleConnected();
    } else {
      websocket.connect();
    }

    return () => {
      websocket.off('connected', handleConnected);
      websocket.off('disconnected', handleDisconnected);
      websocket.off('reconnected', handleReconnected);
      
      // Leave room when component unmounts
      websocket.send({ 
        type: 'leave', 
        payload: { spaceId } 
      });
      
      // Don't remove from localStorage - allow refresh recovery
      hasJoinedRef.current = false;
    };
  }, [spaceId]);

  if (reconnecting) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50">
        <div className="bg-white p-8 rounded-lg">
          <p>🔄 Reconnecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    // ... rest of component
  );
};
```

### 3. Backend: Handle User Replacement on Rejoin

```typescript
// metaverse/apps/ws/src/User.ts

async handleJoin(message: JoinMessage): Promise<void> {
  const { spaceId, token } = message.payload;
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    this.userId = decoded.userId;
    this.spaceId = spaceId;

    // Check if user already exists in room (from previous connection)
    const existingUser = await this.roomManager.getUser(spaceId, this.userId);
    
    if (existingUser) {
      console.log(`♻️ User ${this.userId} rejoining - replacing old connection`);
      
      // Remove old connection first
      await this.roomManager.removeUser(spaceId, this.userId);
      
      // Broadcast that user left (cleanup)
      this.broadcast({
        type: 'user-left',
        payload: { userId: this.userId, reason: 'reconnection' }
      });
      
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Get spawn position
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    const spawnX = Math.floor(space.width / 40); // Center X
    const spawnY = Math.floor(space.height / 40); // Center Y

    // Add user to room with new connection
    await this.roomManager.addUser(spaceId, this.userId, {
      x: spawnX,
      y: spawnY,
      name: decoded.username || 'Anonymous',
      avatar: decoded.avatar || null,
      connectionId: this.connectionId, // Track connection
      connectedAt: Date.now()
    });

    // Get all other users in room
    const existingUsers = await this.roomManager.getUsers(spaceId);
    const otherUsers = existingUsers.filter(u => u.id !== this.userId);

    // Send existing users to the joining user
    this.send({
      type: 'existing-users',
      payload: otherUsers
    });

    // Broadcast new user to all others
    this.broadcast({
      type: 'user-joined',
      payload: {
        id: this.userId,
        x: spawnX,
        y: spawnY,
        name: decoded.username,
        avatar: decoded.avatar
      }
    });

    // Send success confirmation
    this.send({
      type: 'join-success',
      payload: {
        spaceId,
        userId: this.userId,
        position: { x: spawnX, y: spawnY },
        userCount: existingUsers.length
      }
    });

    console.log(`✅ User ${this.userId} joined space ${spaceId} (${existingUsers.length} total users)`);
    
  } catch (error) {
    console.error('Join error:', error);
    this.send({
      type: 'error',
      payload: { message: 'Failed to join space' }
    });
  }
}
```

### 4. Backend: Aggressive Stale Connection Cleanup

```typescript
// metaverse/apps/ws/src/RoomManager.ts

class RoomManager {
  private connectionMap: Map<string, WebSocket> = new Map();

  async addUser(spaceId: string, userId: string, userData: UserData): Promise<void> {
    const room = this.rooms.get(spaceId) || this.createRoom(spaceId);
    
    // Check for existing connection
    const oldConnectionId = room.users.get(userId)?.connectionId;
    if (oldConnectionId) {
      const oldConnection = this.connectionMap.get(oldConnectionId);
      
      // Force close old connection
      if (oldConnection && oldConnection.readyState === WebSocket.OPEN) {
        console.log(`🔌 Closing stale connection for user ${userId}`);
        oldConnection.close(1000, 'Replaced by new connection');
      }
      
      this.connectionMap.delete(oldConnectionId);
    }

    // Add new user data
    room.users.set(userId, {
      ...userData,
      lastSeen: Date.now()
    });

    // Track new connection
    this.connectionMap.set(userData.connectionId, userData.connection);

    // Update Redis
    await this.redis.hSet(`room:${spaceId}:users`, {
      [userId]: JSON.stringify(userData)
    });
  }

  async removeUser(spaceId: string, userId: string): Promise<void> {
    const room = this.rooms.get(spaceId);
    if (!room) return;

    const userData = room.users.get(userId);
    if (userData) {
      this.connectionMap.delete(userData.connectionId);
      room.users.delete(userId);
    }

    await this.redis.hDel(`room:${spaceId}:users`, [userId]);

    if (room.users.size === 0) {
      this.rooms.delete(spaceId);
      console.log(`🗑️ Room ${spaceId} is empty, removed`);
    }
  }
}
```

### 5. Frontend: Show Reconnection Status

```tsx
// frontend/src/components/ConnectionStatus.tsx

const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    const handleConnected = () => setStatus('connected');
    const handleDisconnected = () => setStatus('disconnected');
    const handleReconnecting = (attempt: number) => {
      setStatus('reconnecting');
      setReconnectAttempt(attempt);
    };

    websocket.on('connected', handleConnected);
    websocket.on('disconnected', handleDisconnected);
    websocket.on('reconnecting', handleReconnecting);

    return () => {
      websocket.off('connected', handleConnected);
      websocket.off('disconnected', handleDisconnected);
      websocket.off('reconnecting', handleReconnecting);
    };
  }, []);

  if (status === 'connected') return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      {status === 'reconnecting' && (
        <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="animate-spin">🔄</div>
          <span>Reconnecting... (Attempt {reconnectAttempt})</span>
        </div>
      )}
      {status === 'disconnected' && (
        <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>⚠️</span>
          <span>Connection lost</span>
        </div>
      )}
    </div>
  );
};
```

### 6. Add Debug Logging

```typescript
// frontend/src/services/websocket.ts

class WebSocketService {
  enableDebugMode(): void {
    this.on('*', (event, data) => {
      console.log(`[WS ${new Date().toISOString()}] ${event}:`, data);
    });
  }

  // Track connection lifecycle
  private logConnectionState(): void {
    console.table({
      'Connection State': this.ws?.readyState,
      'Current Room': this.currentRoom?.spaceId,
      'Connected At': new Date(this.connectedAt).toLocaleTimeString(),
      'Message Queue': this.messageQueue.length,
      'Event Listeners': this.eventListeners.size
    });
  }
}
```

---

## Testing

### Manual Test Procedure

```bash
# Test 1: Simple Refresh
1. User A joins room → sees empty room ✓
2. User B joins room → both see each other ✓
3. User A refreshes page (F5) → should rejoin automatically
4. Verify: User A and B can still see each other ✓
5. Verify: Chat messages work both ways ✓
6. Verify: Video calls can be established ✓

# Test 2: Multiple Refreshes
1. Both users in room
2. User A refreshes 3 times rapidly
3. Verify: No duplicate users appear
4. Verify: Connection remains stable

# Test 3: Refresh During Activity
1. Both users in video call
2. User A refreshes
3. Verify: Video call ends gracefully
4. Verify: Can re-establish call after refresh

# Test 4: Long Session Refresh
1. Users connected for 1+ hour
2. Refresh page
3. Verify: Token still valid
4. Verify: Reconnection successful
```

### Automated Test

```typescript
describe('Page Refresh Connection Recovery', () => {
  it('should maintain room connection after refresh', async () => {
    const userA = await createTestUser('userA');
    const userB = await createTestUser('userB');
    const roomId = 'test-room';

    // Both join room
    await userA.joinRoom(roomId);
    await userB.joinRoom(roomId);

    // Verify both see each other
    expect(userA.getVisibleUsers()).toContain(userB.id);
    expect(userB.getVisibleUsers()).toContain(userA.id);

    // Simulate refresh for userA (disconnect + reconnect)
    await userA.disconnect();
    await wait(100);
    await userA.connect();
    await userA.joinRoom(roomId);

    // Verify connection restored
    expect(userA.getVisibleUsers()).toContain(userB.id);
    expect(userB.getVisibleUsers()).toContain(userA.id);
  });
});
```

---

## Prevention Checklist

- [ ] Persist room state in localStorage
- [ ] Implement automatic room rejoin on reconnect
- [ ] Handle duplicate user cleanup on backend
- [ ] Add connection status indicator
- [ ] Test refresh in all scenarios (idle, chat, video call)
- [ ] Add debug logging for connection lifecycle
- [ ] Set up monitoring for reconnection failures

---

## Related Issues

- **Related Bugs**: BUG-015 (disconnection loop), BUG-020 (users not visible), BUG-029 (stale position)
- **User Impact**: Critical - breaks all room functionality
- **Frequency**: Happens 100% of the time on refresh

---

## Notes

- This is likely the most common user complaint
- Similar to BUG-029 but specifically triggered by page refresh
- May also affect users who switch tabs and come back
- Mobile browsers that kill background tabs will trigger this
- Consider adding "rejoin room" button as fallback if auto-rejoin fails

---

## Priority

**CRITICAL - P0**

This bug should be fixed immediately in Phase 1 (Week 1) alongside coordinate and WebSocket stability issues, as it affects basic room functionality.
