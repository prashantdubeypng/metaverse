# BUG-031: Room State Not Synchronized Across Servers

## Bug Information

**Bug ID**: BUG-031  
**Title**: Users in Same Room See Different States with Multiple Server Instances  
**Severity**: Critical  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When the application is scaled to multiple WebSocket server instances (horizontal scaling), users connected to different server instances don't see each other or see inconsistent room states. This is because room state is stored in-memory on each server instance rather than in a shared state store.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Room Manager | `metaverse/apps/ws/src/RoomManager.ts` | Backend |
| WebSocket Server | `metaverse/apps/ws/src/index.ts` | Backend |
| Redis Client | `metaverse/packages/redis-client/` | Backend |

---

## Reproduction Steps

1. Start two WebSocket server instances (port 3001 and 3002)
2. Configure load balancer to distribute connections
3. User A connects (routed to server 1)
4. User B connects (routed to server 2)
5. Both users join the same space/room
6. User A sees only themselves
7. User B sees only themselves
8. Neither user sees the other!

**Expected Behavior**:  
Both users should see each other regardless of which server instance they're connected to.

**Actual Behavior**:  
Users only see other users connected to the same server instance.

---

## Root Cause Analysis

### In-Memory Room State

The current RoomManager stores all room state in local memory:

```typescript
// metaverse/apps/ws/src/RoomManager.ts

class RoomManager {
  private rooms: Map<string, Room> = new Map();  // Local memory only!
  
  addUser(roomId: string, userId: string, userData: UserData): void {
    const room = this.rooms.get(roomId) || { users: new Map() };
    room.users.set(userId, userData);
    this.rooms.set(roomId, room);
    // Only this server instance knows about this user!
  }
}
```

### No Cross-Server Communication

When User A on Server 1 moves, Server 2 never receives the update:

```
Server 1: User A moves to (5, 5)
          ↓
          Broadcasts to Server 1 connections only
          ↓
Server 2: Has no idea User A moved (or exists)
```

---

## Solution

### 1. Use Redis for Shared Room State

```typescript
// metaverse/apps/ws/src/RoomManager.ts

import { RedisService } from '@repo/redis-client';

class RoomManager {
  private redis: RedisService;
  private localUsers: Map<string, WebSocket> = new Map();  // For direct messaging

  constructor(redis: RedisService) {
    this.redis = redis;
  }

  async addUser(roomId: string, userId: string, userData: UserData): Promise<void> {
    // Store in Redis (shared across all servers)
    await this.redis.hSet(`room:${roomId}:users`, {
      [userId]: JSON.stringify({
        ...userData,
        serverId: this.serverId,
        connectedAt: Date.now()
      })
    });

    // Set TTL for automatic cleanup
    await this.redis.expire(`room:${roomId}:users`, 3600);

    // Publish join event to all servers
    await this.redis.publish(`room:${roomId}:events`, JSON.stringify({
      type: 'user-joined',
      payload: { userId, ...userData }
    }));
  }

  async getUsers(roomId: string): Promise<UserData[]> {
    const users = await this.redis.hGetAll(`room:${roomId}:users`);
    return Object.entries(users).map(([id, data]) => ({
      id,
      ...JSON.parse(data)
    }));
  }

  async updatePosition(roomId: string, userId: string, x: number, y: number): Promise<void> {
    // Update Redis
    const userData = await this.redis.hGet(`room:${roomId}:users`, userId);
    if (userData) {
      const data = JSON.parse(userData);
      data.x = x;
      data.y = y;
      await this.redis.hSet(`room:${roomId}:users`, {
        [userId]: JSON.stringify(data)
      });
    }

    // Publish move event to all servers
    await this.redis.publish(`room:${roomId}:events`, JSON.stringify({
      type: 'user-moved',
      payload: { userId, x, y }
    }));
  }

  async removeUser(roomId: string, userId: string): Promise<void> {
    await this.redis.hDel(`room:${roomId}:users`, [userId]);
    
    await this.redis.publish(`room:${roomId}:events`, JSON.stringify({
      type: 'user-left',
      payload: { userId }
    }));
  }
}
```

### 2. Implement Redis Pub/Sub for Cross-Server Events

```typescript
// metaverse/apps/ws/src/RedisPubSub.ts

class RedisPubSub {
  private subscriber: RedisClient;
  private publisher: RedisClient;
  private subscriptions: Map<string, Set<(message: any) => void>> = new Map();

  constructor() {
    this.subscriber = createRedisClient();
    this.publisher = createRedisClient();
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      
      await this.subscriber.subscribe(channel, (message) => {
        const data = JSON.parse(message);
        const handlers = this.subscriptions.get(channel);
        handlers?.forEach(h => h(data));
      });
    }
    
    this.subscriptions.get(channel)!.add(handler);
  }

  async publish(channel: string, data: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(data));
  }

  async unsubscribe(channel: string, handler: (message: any) => void): Promise<void> {
    const handlers = this.subscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        await this.subscriber.unsubscribe(channel);
        this.subscriptions.delete(channel);
      }
    }
  }
}

export const redisPubSub = new RedisPubSub();
```

### 3. Subscribe to Room Events on Join

```typescript
// metaverse/apps/ws/src/User.ts

class User {
  private roomSubscription: ((message: any) => void) | null = null;

  async handleJoin(message: JoinMessage): Promise<void> {
    const { spaceId } = message.payload;
    this.spaceId = spaceId;
    
    // Subscribe to room events from other servers
    this.roomSubscription = (event) => {
      // Don't echo back our own events
      if (event.payload.userId === this.userId) return;
      
      // Forward event to connected client
      this.send(event);
    };
    
    await redisPubSub.subscribe(`room:${spaceId}:events`, this.roomSubscription);
    
    // Add self to room
    await roomManager.addUser(spaceId, this.userId, {
      x: spawnX,
      y: spawnY,
      name: this.name
    });
    
    // Get existing users from Redis (includes users on other servers)
    const existingUsers = await roomManager.getUsers(spaceId);
    this.send({
      type: 'existing-users',
      payload: existingUsers.filter(u => u.id !== this.userId)
    });
  }

  async handleDisconnect(): Promise<void> {
    if (this.spaceId) {
      // Unsubscribe from room events
      if (this.roomSubscription) {
        await redisPubSub.unsubscribe(
          `room:${this.spaceId}:events`,
          this.roomSubscription
        );
      }
      
      // Remove from room
      await roomManager.removeUser(this.spaceId, this.userId);
    }
  }
}
```

### 4. Add Server Identification

```typescript
// metaverse/apps/ws/src/index.ts

import { randomUUID } from 'crypto';

const SERVER_ID = process.env.SERVER_ID || randomUUID();

console.log(`🚀 WebSocket Server starting with ID: ${SERVER_ID}`);

// Pass to RoomManager for tracking
const roomManager = new RoomManager(redis, SERVER_ID);
```

### 5. Implement Sticky Sessions (Alternative/Complementary)

For WebSocket, sticky sessions are recommended to reduce cross-server communication:

```nginx
# nginx.conf
upstream websocket_servers {
    ip_hash;  # Sticky sessions based on client IP
    server ws1:3001;
    server ws2:3002;
}

server {
    location /ws {
        proxy_pass http://websocket_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 6. Handle Server Failure Gracefully

```typescript
// metaverse/apps/ws/src/RoomManager.ts

async cleanupStaleServerUsers(): Promise<void> {
  // Run periodically to clean up users from crashed servers
  const allRooms = await this.redis.keys('room:*:users');
  
  for (const roomKey of allRooms) {
    const users = await this.redis.hGetAll(roomKey);
    
    for (const [userId, dataStr] of Object.entries(users)) {
      const data = JSON.parse(dataStr);
      
      // Check if user's server is still alive (via heartbeat key)
      const serverAlive = await this.redis.exists(`server:${data.serverId}:alive`);
      
      if (!serverAlive) {
        // Server crashed, clean up user
        const roomId = roomKey.replace('room:', '').replace(':users', '');
        await this.removeUser(roomId, userId);
        console.log(`🧹 Cleaned up user ${userId} from crashed server ${data.serverId}`);
      }
    }
  }
}

// Server heartbeat
setInterval(async () => {
  await this.redis.set(`server:${SERVER_ID}:alive`, '1', { EX: 30 });
}, 10000);
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
│                    (Sticky Sessions)                             │
└─────────────┬───────────────────────────┬───────────────────────┘
              │                           │
     ┌────────▼────────┐         ┌────────▼────────┐
     │  WS Server 1    │         │  WS Server 2    │
     │  (Port 3001)    │         │  (Port 3002)    │
     │                 │         │                 │
     │  Local Users:   │         │  Local Users:   │
     │  - User A       │         │  - User B       │
     │  - User C       │         │  - User D       │
     └────────┬────────┘         └────────┬────────┘
              │                           │
              │    Redis Pub/Sub          │
              │    ┌─────────────┐        │
              └────►    REDIS    ◄────────┘
                   │             │
                   │ - Room State│
                   │ - Pub/Sub   │
                   │ - Sessions  │
                   └─────────────┘
```

---

## Testing

### Multi-Server Test Script

```bash
# Start multiple server instances
PORT=3001 SERVER_ID=server1 node dist/index.js &
PORT=3002 SERVER_ID=server2 node dist/index.js &

# Connect clients to different servers
# Verify they can see each other
```

### Verification Steps

1. Start 2 server instances
2. Connect User A to server 1
3. Connect User B to server 2
4. Verify User A sees User B
5. Move User A, verify User B sees movement
6. Kill server 1, verify User A removed on server 2

---

## Prevention

1. **Design for horizontal scaling** from the start
2. **Use shared state stores** (Redis/Memcached) for room state
3. **Implement pub/sub** for real-time cross-server communication
4. **Use sticky sessions** to minimize cross-server traffic
5. **Test with multiple instances** before deployment

---

## Related Issues

- **Related Bugs**: BUG-020 (users not visible), BUG-015 (disconnection loop)
- **Scalability**: Required for 2000+ concurrent users
- **Performance**: Redis operations add latency

---

## Notes

- Redis Cluster can be used for higher availability
- Consider using Redis Streams for event ordering guarantees
- WebSocket connection count per server should be monitored
- Memory usage will be lower per server with shared state
