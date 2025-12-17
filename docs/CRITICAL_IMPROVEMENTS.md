# Critical Architectural Improvements

**Based on expert review feedback - IMPLEMENT THESE FIRST**

---

## 🚨 High Priority Fixes (Before 2000 Users)

### 1. Remove Sticky Sessions - Use Connection Registry

**Problem**: Sticky sessions break autoscaling and failovers.

**Solution**: Redis-based connection registry

```typescript
// packages/redis-client/src/ConnectionRegistry.ts
export class ConnectionRegistry {
  constructor(private redis: RedisService) {}

  // Map user to server
  async registerConnection(userId: string, serverId: string): Promise<void> {
    await this.redis.cache.multi()
      .hset('user:connections', userId, serverId)
      .sadd(`server:${serverId}:users`, userId)
      .expire(`server:${serverId}:users`, 3600)
      .exec();
  }

  // Find which server has this user
  async getUserServer(userId: string): Promise<string | null> {
    return await this.redis.cache.hget('user:connections', userId);
  }

  // Get all users on a server
  async getServerUsers(serverId: string): Promise<string[]> {
    return await this.redis.cache.smembers(`server:${serverId}:users`);
  }

  // Remove connection
  async unregisterConnection(userId: string, serverId: string): Promise<void> {
    await this.redis.cache.multi()
      .hdel('user:connections', userId)
      .srem(`server:${serverId}:users`, userId)
      .exec();
  }

  // Check if server is alive (for failover)
  async isServerHealthy(serverId: string): Promise<boolean> {
    const lastHeartbeat = await this.redis.cache.get(`server:${serverId}:heartbeat`);
    if (!lastHeartbeat) return false;
    
    const lastSeen = parseInt(lastHeartbeat);
    const now = Date.now();
    return (now - lastSeen) < 30000; // 30 seconds tolerance
  }

  // Failover: move users from dead server
  async failoverServer(deadServerId: string, newServerId: string): Promise<string[]> {
    const users = await this.getServerUsers(deadServerId);
    
    const pipeline = this.redis.cache.multi();
    for (const userId of users) {
      pipeline.hset('user:connections', userId, newServerId);
      pipeline.srem(`server:${deadServerId}:users`, userId);
      pipeline.sadd(`server:${newServerId}:users`, userId);
    }
    await pipeline.exec();
    
    return users;
  }
}
```

**Update ALB**: Remove sticky sessions from `nginx.conf`:
```nginx
upstream websocket_backend {
  # NO ip_hash; — remove sticky sessions
  server ws1.metaverse.com:3001;
  server ws2.metaverse.com:3002;
  server ws3.metaverse.com:3003;
}
```

---

### 2. Replace Redis Pub/Sub with Redis Streams

**Problem**: Pub/Sub is fire-and-forget, not replayable, loses messages.

**Solution**: Redis Streams for durability + consumer groups

```typescript
// packages/redis-client/src/StreamService.ts
import { Redis } from 'ioredis';

export interface StreamMessage {
  type: string;
  payload: any;
  serverId: string;
  timestamp: number;
}

export class StreamService {
  constructor(private redis: Redis) {}

  // Publish event to stream (replaces Pub/Sub)
  async publishEvent(spaceId: string, event: StreamMessage): Promise<void> {
    await this.redis.xadd(
      `room:${spaceId}:stream`,
      'MAXLEN', '~', '10000', // Keep last 10k events
      '*',
      'data', JSON.stringify(event)
    );
  }

  // Subscribe to stream with consumer group
  async subscribeToRoom(
    spaceId: string, 
    serverId: string,
    onMessage: (message: StreamMessage) => void
  ): Promise<void> {
    const groupName = 'room-consumers';
    const streamKey = `room:${spaceId}:stream`;
    const consumerName = `server:${serverId}`;

    // Create consumer group if not exists
    try {
      await this.redis.xgroup(
        'CREATE', 
        streamKey, 
        groupName, 
        '0', 
        'MKSTREAM'
      );
    } catch (err) {
      // Group already exists
    }

    // Poll for new messages
    while (true) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', groupName, consumerName,
          'COUNT', '100',
          'BLOCK', '1000', // 1 second block
          'STREAMS', streamKey, '>'
        );

        if (results && results.length > 0) {
          const [_key, messages] = results[0];
          
          for (const [id, fields] of messages) {
            const data = JSON.parse((fields as string[])[1]);
            
            // Skip our own messages
            if (data.serverId !== serverId) {
              onMessage(data);
            }

            // Acknowledge message
            await this.redis.xack(streamKey, groupName, id);
          }
        }
      } catch (error) {
        console.error('Stream read error:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  // Get recent events (for reconnection/sync)
  async getRecentEvents(spaceId: string, count: number = 100): Promise<StreamMessage[]> {
    const results = await this.redis.xrevrange(
      `room:${spaceId}:stream`,
      '+',
      '-',
      'COUNT',
      count
    );

    return results.map(([_id, fields]) => 
      JSON.parse((fields as string[])[1])
    );
  }

  // Trim old events
  async trimStream(spaceId: string, maxLength: number = 10000): Promise<void> {
    await this.redis.xtrim(
      `room:${spaceId}:stream`,
      'MAXLEN',
      '~',
      maxLength
    );
  }
}
```

**Update RoomManager**:
```typescript
export class RoomManager {
  private streamService: StreamService;
  
  async moveUser(spaceId: string, userId: string, x: number, y: number): Promise<void> {
    await this.redis.updateUserPosition(spaceId, userId, x, y);
    
    // Use Stream instead of Pub/Sub
    await this.streamService.publishEvent(spaceId, {
      type: 'user-moved',
      payload: { userId, x, y },
      serverId: this.serverId,
      timestamp: Date.now(),
    });
  }
}
```

---

### 3. Hot Key Sharding for Large Rooms

**Problem**: Rooms with many users become Redis hot keys.

**Solution**: Shard room state across multiple keys

```typescript
export class ShardedRoomState {
  private readonly SHARD_SIZE = 50; // 50 users per shard
  
  constructor(private redis: Redis) {}

  private getShardId(userId: string): number {
    // Consistent hashing
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % this.SHARD_SIZE;
  }

  async addUserToRoom(spaceId: string, userId: string, userData: UserData): Promise<void> {
    const shardId = this.getShardId(userId);
    await this.redis.hset(
      `room:${spaceId}:shard:${shardId}`,
      userId,
      JSON.stringify(userData)
    );
  }

  async getUsersInRoom(spaceId: string): Promise<UserData[]> {
    const shardCount = Math.ceil(2000 / this.SHARD_SIZE); // Max 40 shards
    const pipeline = this.redis.pipeline();
    
    for (let i = 0; i < shardCount; i++) {
      pipeline.hgetall(`room:${spaceId}:shard:${i}`);
    }
    
    const results = await pipeline.exec();
    const allUsers: UserData[] = [];
    
    for (const [err, users] of results || []) {
      if (!err && users) {
        Object.entries(users as Record<string, string>).forEach(([id, data]) => {
          allUsers.push({ id, ...JSON.parse(data) });
        });
      }
    }
    
    return allUsers;
  }

  async removeUserFromRoom(spaceId: string, userId: string): Promise<void> {
    const shardId = this.getShardId(userId);
    await this.redis.hdel(`room:${spaceId}:shard:${shardId}`, userId);
  }
}
```

---

### 4. Async DB Writes with Queue

**Problem**: Hitting Postgres for every movement kills performance.

**Solution**: Kafka/Kinesis queue + async workers

```typescript
// packages/kafka-client/src/PositionWriter.ts
export class PositionWriter {
  private kafka: Kafka;
  private producer: Producer;
  private batchBuffer: Map<string, any[]> = new Map();
  
  constructor() {
    this.kafka = new Kafka({
      clientId: 'position-writer',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    this.producer = this.kafka.producer();
    
    this.startBatchFlusher();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  // Queue position update (non-blocking)
  async queuePositionUpdate(userId: string, spaceId: string, x: number, y: number): Promise<void> {
    const key = `${spaceId}:${userId}`;
    
    if (!this.batchBuffer.has(key)) {
      this.batchBuffer.set(key, []);
    }
    
    this.batchBuffer.get(key)!.push({ userId, spaceId, x, y, timestamp: Date.now() });
    
    // Send immediately if buffer too large
    if (this.batchBuffer.get(key)!.length >= 10) {
      await this.flushKey(key);
    }
  }

  private startBatchFlusher(): void {
    setInterval(() => {
      this.flushAll();
    }, 5000); // Flush every 5 seconds
  }

  private async flushKey(key: string): Promise<void> {
    const updates = this.batchBuffer.get(key);
    if (!updates || updates.length === 0) return;
    
    // Take only the latest position (others are stale)
    const latestUpdate = updates[updates.length - 1];
    
    await this.producer.send({
      topic: 'position-updates',
      messages: [{
        key: key,
        value: JSON.stringify(latestUpdate),
      }],
    });
    
    this.batchBuffer.delete(key);
  }

  private async flushAll(): Promise<void> {
    for (const key of this.batchBuffer.keys()) {
      await this.flushKey(key);
    }
  }
}

// Worker that reads from Kafka and writes to Postgres
export class PositionConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  
  constructor(private prisma: PrismaClient) {
    this.kafka = new Kafka({
      clientId: 'position-consumer',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    this.consumer = this.kafka.consumer({ groupId: 'position-writers' });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'position-updates' });
    
    await this.consumer.run({
      eachBatch: async ({ batch }) => {
        const updates = batch.messages.map(msg => JSON.parse(msg.value!.toString()));
        
        // Batch write to Postgres
        await this.prisma.user.updateMany({
          where: {
            id: { in: updates.map(u => u.userId) }
          },
          data: updates.map(u => ({
            x: u.x,
            y: u.y,
            lastSeen: new Date(u.timestamp),
          })),
        });
      },
    });
  }
}
```

---

### 5. Reconnection Backoff + Rate Limiting

**Problem**: Reconnection storms crash servers.

**Solution**: Exponential backoff + jitter + server-side rate limiting

**Client-side** (`frontend/src/hooks/useWebSocket.ts`):
```typescript
export function useReconnectingWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000; // 30 seconds

  const connect = useCallback(() => {
    const socket = new WebSocket(url);
    
    socket.onopen = () => {
      console.log('✅ Connected');
      reconnectAttempts.current = 0; // Reset on success
      setWs(socket);
    };
    
    socket.onclose = () => {
      console.log('❌ Disconnected');
      
      // Exponential backoff with jitter
      const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
      const jitter = Math.random() * 1000; // 0-1 second jitter
      const delay = baseDelay + jitter;
      
      reconnectAttempts.current++;
      
      console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts.current})`);
      
      setTimeout(() => {
        connect();
      }, delay);
    };
    
    return socket;
  }, [url]);

  useEffect(() => {
    const socket = connect();
    return () => socket.close();
  }, [connect]);

  return ws;
}
```

**Server-side** rate limiting (`apps/ws/src/RateLimiter.ts`):
```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

export class ConnectionRateLimiter {
  private limiter: RateLimiterRedis;
  
  constructor(redis: Redis) {
    this.limiter = new RateLimiterRedis({
      storeClient: redis,
      points: 10, // 10 connections
      duration: 60, // per 60 seconds
      blockDuration: 120, // block for 2 minutes if exceeded
    });
  }

  async checkConnectionAllowed(ip: string): Promise<boolean> {
    try {
      await this.limiter.consume(ip);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// In index.ts
wss.on('connection', async (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown';
  
  if (!await rateLimiter.checkConnectionAllowed(ip)) {
    ws.close(1008, 'Rate limit exceeded');
    return;
  }
  
  const user = new User(ws, roomManager);
});
```

---

### 6. Monitoring & Metrics (Prometheus)

**Install dependencies**:
```bash
cd metaverse/apps/ws
pnpm add prom-client
```

**Create metrics** (`apps/ws/src/metrics.ts`):
```typescript
import { Registry, Counter, Gauge, Histogram } from 'prom-client';

export const registry = new Registry();

// Connection metrics
export const activeConnections = new Gauge({
  name: 'ws_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [registry],
});

export const connectionErrors = new Counter({
  name: 'ws_connection_errors_total',
  help: 'Total connection errors',
  registers: [registry],
});

// Message metrics
export const messageLatency = new Histogram({
  name: 'ws_message_latency_ms',
  help: 'WebSocket message latency in milliseconds',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [registry],
});

export const messagesReceived = new Counter({
  name: 'ws_messages_received_total',
  help: 'Total messages received',
  labelNames: ['type'],
  registers: [registry],
});

// Redis metrics
export const redisLatency = new Histogram({
  name: 'redis_operation_latency_ms',
  help: 'Redis operation latency',
  buckets: [1, 5, 10, 25, 50, 100],
  labelNames: ['operation'],
  registers: [registry],
});

// Room metrics
export const roomSize = new Gauge({
  name: 'room_user_count',
  help: 'Number of users in each room',
  labelNames: ['spaceId'],
  registers: [registry],
});
```

**Expose metrics endpoint**:
```typescript
// In apps/ws/src/index.ts
import { registry } from './metrics';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

**Instrument code**:
```typescript
// In RoomManager.ts
import { activeConnections, roomSize, redisLatency } from './metrics';

export class RoomManager {
  async addUser(...): Promise<void> {
    activeConnections.inc();
    
    const start = Date.now();
    await this.redis.addUserToRoom(...);
    redisLatency.labels('addUser').observe(Date.now() - start);
    
    const userCount = await this.redis.getUsersInRoom(spaceId);
    roomSize.labels(spaceId).set(userCount.length);
  }
}
```

---

## 📊 Checklist (Apply in Order)

- [ ] **Day 1-2**: Implement Connection Registry (no sticky sessions)
- [ ] **Day 3-4**: Replace Pub/Sub with Redis Streams
- [ ] **Day 5**: Add hot key sharding for large rooms
- [ ] **Day 6-7**: Set up Kafka + async DB writes
- [ ] **Day 8**: Add reconnection backoff + rate limiting
- [ ] **Day 9-10**: Add Prometheus metrics + Grafana dashboards
- [ ] **Day 11-14**: Load test to 2500 users with simulated failures

---

## 🎯 Success Criteria

After implementing these fixes, you should achieve:

- ✅ **Zero sticky sessions** - ALB routes freely, failover works
- ✅ **Message durability** - Redis Streams replay events on reconnect
- ✅ **No hot keys** - Rooms scale to 500+ users per room
- ✅ **Low DB load** - 95% fewer Postgres writes
- ✅ **No reconnection storms** - Exponential backoff prevents thundering herd
- ✅ **Observable** - p95/p99 latency metrics, alerts on anomalies

---

## 🚀 After These Fixes

You'll be ready for:
1. Multi-AZ deployment
2. Auto-scaling policies
3. Global CDN + regional WebSocket servers
4. AI features (next document)
5. VR support (next document)

**Next Steps**: I can implement any of these improvements. Which should we start with?
