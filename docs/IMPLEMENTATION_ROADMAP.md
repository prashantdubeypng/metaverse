# 4-Week Implementation Roadmap

## Quick Start Decision

**Choose your path based on your environment:**

### Path A: Quick Local Development (Start Here) ⚡
- Week 1-2: Implement Redis + code changes locally
- Week 3: Deploy to cloud
- Week 4: Bug fixes
- **Start with**: Option A below

### Path B: Production-First (If you have cloud access) 🚀
- Week 1: Set up cloud infrastructure
- Week 2-3: Implement + deploy code
- Week 4: Bug fixes
- **Start with**: Option B below

---

## Week 1: Foundation (Redis + Infrastructure)

### Day 1-2: Redis Setup

**Option A: Local Development (Docker)**
```bash
# Quick start with Docker Compose
cd metaverse
mkdir docker
```

Create `docker/docker-compose.yml`:
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: metaverse
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: metaverse
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

Start services:
```bash
cd docker
docker-compose up -d
```

**Option B: AWS Production Setup**
```bash
# 1. Create Redis Cluster (ElastiCache)
aws elasticache create-cache-cluster \
  --cache-cluster-id metaverse-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1

# 2. Get Redis endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id metaverse-redis \
  --show-cache-node-info
```

### Day 3-4: Update Redis Client Package

```bash
cd metaverse/packages/redis-client
```

Update `package.json`:
```json
{
  "name": "@repo/redis-client",
  "version": "1.0.0",
  "dependencies": {
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

Create `src/index.ts`:
```typescript
import Redis from 'ioredis';

export interface UserData {
  id: string;
  x: number;
  y: number;
  name: string;
  avatar?: string;
  serverId: string;
  connectedAt: number;
}

export class RedisService {
  private publisher: Redis;
  private subscriber: Redis;
  public cache: Redis;
  private subscriptions: Map<string, Set<(message: any) => void>> = new Map();

  constructor(config?: { host?: string; port?: number; password?: string }) {
    const redisConfig = {
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config?.password || process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`⚠️ Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.cache = new Redis(redisConfig);

    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    this.subscriber.on('message', (channel, message) => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        try {
          const data = JSON.parse(message);
          handlers.forEach(handler => handler(data));
        } catch (error) {
          console.error('Failed to parse Redis message:', error);
        }
      }
    });
  }

  // Room state management
  async addUserToRoom(spaceId: string, userId: string, userData: UserData): Promise<void> {
    await this.cache.hset(
      `room:${spaceId}:users`,
      userId,
      JSON.stringify(userData)
    );
    await this.cache.expire(`room:${spaceId}:users`, 3600);
  }

  async getUsersInRoom(spaceId: string): Promise<UserData[]> {
    const users = await this.cache.hgetall(`room:${spaceId}:users`);
    return Object.entries(users).map(([id, data]) => ({
      id,
      ...JSON.parse(data as string),
    }));
  }

  async removeUserFromRoom(spaceId: string, userId: string): Promise<void> {
    await this.cache.hdel(`room:${spaceId}:users`, userId);
  }

  async updateUserPosition(spaceId: string, userId: string, x: number, y: number): Promise<void> {
    const userData = await this.cache.hget(`room:${spaceId}:users`, userId);
    if (userData) {
      const parsed = JSON.parse(userData);
      parsed.x = x;
      parsed.y = y;
      parsed.lastSeen = Date.now();
      await this.cache.hset(`room:${spaceId}:users`, userId, JSON.stringify(parsed));
    }
  }

  // Pub/Sub
  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.subscriptions.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string, handler?: (message: any) => void): Promise<void> {
    if (handler) {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          await this.subscriber.unsubscribe(channel);
          this.subscriptions.delete(channel);
        }
      }
    } else {
      await this.subscriber.unsubscribe(channel);
      this.subscriptions.delete(channel);
    }
  }

  // Pattern subscribe (for room:*:events)
  async psubscribe(pattern: string, handler: (pattern: string, channel: string, message: any) => void): Promise<void> {
    await this.subscriber.psubscribe(pattern);
    this.subscriber.on('pmessage', (pat, channel, message) => {
      if (pat === pattern) {
        try {
          const data = JSON.parse(message);
          handler(pat, channel, data);
        } catch (error) {
          console.error('Failed to parse Redis pmessage:', error);
        }
      }
    });
  }

  // Server heartbeat
  async markServerAlive(serverId: string): Promise<void> {
    await this.cache.set(`server:${serverId}:alive`, '1', 'EX', 30);
  }

  async isServerAlive(serverId: string): Promise<boolean> {
    const result = await this.cache.exists(`server:${serverId}:alive`);
    return result === 1;
  }

  // Cleanup
  async disconnect(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    await this.cache.quit();
  }
}

// Export singleton
let redisInstance: RedisService | null = null;

export function getRedisService(): RedisService {
  if (!redisInstance) {
    redisInstance = new RedisService();
  }
  return redisInstance;
}
```

Create `tsconfig.json`:
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Install and build:
```bash
pnpm install
pnpm build
```

### Day 5: Update WebSocket Server

```bash
cd metaverse/apps/ws
```

Update `package.json` to add Redis:
```json
{
  "dependencies": {
    "@repo/redis-client": "workspace:*",
    // ... existing dependencies
  }
}
```

Update `src/RoomManager.ts`:
```typescript
import { RedisService, UserData } from '@repo/redis-client';
import { WebSocket } from 'ws';

export class RoomManager {
  private redis: RedisService;
  private serverId: string;
  private localConnections: Map<string, WebSocket> = new Map();
  private userToSpace: Map<string, string> = new Map();

  constructor(redis: RedisService) {
    this.redis = redis;
    this.serverId = process.env.SERVER_ID || `ws-${process.pid}-${Date.now()}`;
    
    console.log(`🆔 Server ID: ${this.serverId}`);
    
    // Subscribe to cross-server events
    this.setupCrossServerSync();
    
    // Start heartbeat
    this.startHeartbeat();
  }

  private setupCrossServerSync(): void {
    // Subscribe to all room events from other servers
    this.redis.psubscribe('room:*:events', async (pattern, channel, message) => {
      // Ignore our own events
      if (message.serverId === this.serverId) return;
      
      const spaceId = channel.split(':')[1];
      await this.forwardEventToLocalUsers(spaceId, message);
    });
  }

  private async forwardEventToLocalUsers(spaceId: string, event: any): Promise<void> {
    // Get local users in this space
    const localUserIds = Array.from(this.userToSpace.entries())
      .filter(([_, space]) => space === spaceId)
      .map(([userId]) => userId);
    
    // Forward event to each local user
    for (const userId of localUserIds) {
      const ws = this.localConnections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  }

  async addUser(
    spaceId: string,
    userId: string,
    ws: WebSocket,
    userData: Omit<UserData, 'serverId' | 'connectedAt'>
  ): Promise<void> {
    // Store connection locally
    this.localConnections.set(userId, ws);
    this.userToSpace.set(userId, spaceId);
    
    // Store in Redis (shared across all servers)
    await this.redis.addUserToRoom(spaceId, userId, {
      ...userData,
      id: userId,
      serverId: this.serverId,
      connectedAt: Date.now(),
    });
    
    // Publish join event to all servers
    await this.redis.publish(`room:${spaceId}:events`, {
      type: 'user-joined',
      payload: { userId, ...userData },
      serverId: this.serverId,
    });
  }

  async moveUser(spaceId: string, userId: string, x: number, y: number): Promise<void> {
    // Update position in Redis
    await this.redis.updateUserPosition(spaceId, userId, x, y);
    
    // Publish move event to all servers
    await this.redis.publish(`room:${spaceId}:events`, {
      type: 'user-moved',
      payload: { userId, x, y },
      serverId: this.serverId,
    });
  }

  async removeUser(spaceId: string, userId: string): Promise<void> {
    // Remove local connection
    this.localConnections.delete(userId);
    this.userToSpace.delete(userId);
    
    // Remove from Redis
    await this.redis.removeUserFromRoom(spaceId, userId);
    
    // Publish leave event
    await this.redis.publish(`room:${spaceId}:events`, {
      type: 'user-left',
      payload: { userId },
      serverId: this.serverId,
    });
  }

  async getUsers(spaceId: string): Promise<UserData[]> {
    // Get all users from Redis (includes users on all servers)
    return await this.redis.getUsersInRoom(spaceId);
  }

  getLocalConnectionCount(): number {
    return this.localConnections.size;
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      // Mark server as alive
      await this.redis.markServerAlive(this.serverId);
      
      console.log(`💓 Heartbeat: ${this.localConnections.size} local connections`);
    }, 10000); // Every 10 seconds
  }
}
```

Update `src/index.ts`:
```typescript
import { WebSocketServer } from 'ws';
import { getRedisService } from '@repo/redis-client';
import { RoomManager } from './RoomManager';
import { User } from './User';

const PORT = parseInt(process.env.WS_PORT || '3001');
const redis = getRedisService();
const roomManager = new RoomManager(redis);

const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebSocket server started on port ${PORT}`);
console.log(`🆔 Server ID: ${process.env.SERVER_ID || 'auto-generated'}`);

wss.on('connection', (ws) => {
  const user = new User(ws, roomManager);
  console.log(`✅ New connection (Total: ${wss.clients.size})`);
});

// Health check endpoint (for load balancer)
import express from 'express';
const app = express();
const HEALTH_PORT = PORT + 1;

app.get('/health', async (req, res) => {
  try {
    await redis.cache.ping();
    res.json({
      status: 'healthy',
      connections: wss.clients.size,
      serverId: process.env.SERVER_ID,
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

app.listen(HEALTH_PORT, () => {
  console.log(`💚 Health check endpoint: http://localhost:${HEALTH_PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 Shutting down gracefully...');
  wss.close();
  await redis.disconnect();
  process.exit(0);
});
```

---

## Week 2: Testing Multi-Server Setup

### Test Locally

Create `test-multi-server.sh`:
```bash
#!/bin/bash

# Start 3 WebSocket servers
SERVER_ID=ws1 WS_PORT=3001 node dist/index.js &
SERVER_ID=ws2 WS_PORT=3002 node dist/index.js &
SERVER_ID=ws3 WS_PORT=3003 node dist/index.js &

echo "Started 3 WebSocket servers"
echo "ws1: http://localhost:3001"
echo "ws2: http://localhost:3002"
echo "ws3: http://localhost:3003"
```

Test with multiple clients connecting to different ports.

---

## Week 3: Deploy + Load Balancer

Set up Nginx or AWS ALB as documented in SYSTEM_DESIGN_2000_USERS.md

---

## Week 4: Fix Critical Bugs

Follow FIX_PRIORITY_GUIDE.md starting with:
1. BUG-032 (page refresh)
2. BUG-011 (coordinates)
3. BUG-015 (WebSocket stability)

---

## Start Now

**Recommended first step:**
```bash
# 1. Start Redis locally
cd metaverse
mkdir -p docker
# Create docker-compose.yml (see Day 1-2 above)
docker-compose up -d

# 2. Build Redis client
cd packages/redis-client
pnpm install
pnpm build

# 3. Update WebSocket server
cd ../../apps/ws
pnpm install
pnpm build
pnpm dev

# 4. Test!
```

Ready to start? Which step would you like help with first?
