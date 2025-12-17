# System Design for 2000 Concurrent Users

## Executive Summary

This document outlines the architecture changes needed to scale the Metaverse platform from ~500 users to **2000 concurrent users** with stable performance.

**Current State**: Single-instance services, in-memory state  
**Target State**: Horizontally scalable, Redis-backed, load-balanced architecture  
**Timeline**: 4 weeks implementation  
**Estimated Cost**: $200-300/month on AWS/Azure

---

## Architecture Overview

### Current Architecture (Single Instance)
```
┌─────────────┐
│  Frontend   │ ──────┐
│  (Next.js)  │       │
└─────────────┘       │
                      ▼
                ┌─────────────┐     ┌──────────────┐
                │ WebSocket   │────►│  PostgreSQL  │
                │  Server     │     │   Database   │
                │  (Port      │     └──────────────┘
                │   3001)     │
                └─────────────┘
                      ▲
                      │
                ┌─────────────┐
                │  HTTP API   │
                │  (Port      │
                │   3000)     │
                └─────────────┘
```
**Limitations:**
- ❌ Single WebSocket server → ~500 connection limit
- ❌ In-memory room state → doesn't scale
- ❌ No failover → single point of failure
- ❌ No load distribution

---

### Target Architecture (Scalable)

```
                        ┌────────────────────┐
                        │   Load Balancer    │
                        │  (Nginx/AWS ALB)   │
                        │  Sticky Sessions   │
                        └─────────┬──────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
         ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
         │ WebSocket    │ │ WebSocket   │ │ WebSocket   │
         │ Instance 1   │ │ Instance 2  │ │ Instance 3  │
         │ (500 users)  │ │ (500 users) │ │ (500 users) │
         └──────┬───────┘ └──────┬──────┘ └──────┬──────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                ┌────────────────▼──────────────┐
                │      Redis Cluster            │
                │  ┌─────────┐   ┌─────────┐   │
                │  │ Pub/Sub │   │  Cache  │   │
                │  └─────────┘   └─────────┘   │
                └────────────────┬──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼──────┐ ┌──▼─────┐ ┌───▼────────┐
            │  PostgreSQL  │ │ Kafka  │ │  HTTP API  │
            │   (Primary)  │ │ Queue  │ │  Cluster   │
            └──────────────┘ └────────┘ └────────────┘
```

**Capabilities:**
- ✅ 3+ WebSocket instances → 1500-2000 connections
- ✅ Redis shared state → cross-instance sync
- ✅ Redis Pub/Sub → real-time events
- ✅ Load balancer → traffic distribution
- ✅ Horizontal scaling → add more instances as needed

---

## Critical Components

### 1. Redis Cluster (Core Infrastructure)

**Purpose**: Shared state and real-time communication between WebSocket instances

#### Redis Data Structure

```redis
# Room State
HSET room:{spaceId}:users {userId} {"x":5,"y":3,"name":"Alice","serverId":"ws1"}
EXPIRE room:{spaceId}:users 3600

# User Sessions
SET user:{userId}:session {"spaceId":"space1","serverId":"ws1","connectedAt":1234567890}
EXPIRE user:{userId}:session 7200

# Active Connections (for cleanup)
SADD server:{serverId}:connections {userId}
EXPIRE server:{serverId}:connections 300

# Server Heartbeat (for failover detection)
SET server:{serverId}:alive 1 EX 30

# Video Call State
HSET room:{spaceId}:calls {callId} {"participants":["user1","user2"],"startedAt":1234567890}
```

#### Redis Pub/Sub Channels

```redis
# Room-specific events
SUBSCRIBE room:{spaceId}:events
# Messages: user-joined, user-left, user-moved, chat-message

# Video call events  
SUBSCRIBE room:{spaceId}:video
# Messages: call-start, call-end, ice-candidate, offer, answer

# Global events
SUBSCRIBE global:admin
# Messages: server-shutdown, maintenance-mode
```

**Implementation:**
```typescript
// metaverse/packages/redis-client/src/index.ts

import Redis from 'ioredis';

export class RedisService {
  private publisher: Redis;
  private subscriber: Redis;
  private cache: Redis;

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    };

    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.cache = new Redis(redisConfig);
  }

  // Room state management
  async addUserToRoom(
    spaceId: string,
    userId: string,
    userData: UserData
  ): Promise<void> {
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
      ...JSON.parse(data),
    }));
  }

  async removeUserFromRoom(spaceId: string, userId: string): Promise<void> {
    await this.cache.hdel(`room:${spaceId}:users`, userId);
  }

  // Pub/Sub
  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        handler(JSON.parse(msg));
      }
    });
  }
}
```

---

### 2. Load Balancer Configuration

**Nginx Configuration** (Recommended for cost efficiency)

```nginx
# /etc/nginx/nginx.conf

upstream websocket_backend {
    # Sticky sessions based on IP (keeps user on same server)
    ip_hash;
    
    server ws1.internal:3001 max_fails=3 fail_timeout=30s;
    server ws2.internal:3001 max_fails=3 fail_timeout=30s;
    server ws3.internal:3001 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

upstream http_backend {
    # Round-robin for HTTP (stateless)
    least_conn;
    
    server api1.internal:3000 max_fails=3 fail_timeout=30s;
    server api2.internal:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name app.metaverse.com;

    # WebSocket endpoint
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Timeouts
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        
        # Buffer settings
        proxy_buffering off;
    }

    # HTTP API endpoint
    location /api {
        proxy_pass http://http_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Frontend (static files)
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}
```

**AWS Application Load Balancer** (Alternative - easier but more expensive)

```yaml
# ALB Target Groups
WebSocketTargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Protocol: HTTP
    Port: 3001
    VpcId: !Ref VPC
    HealthCheckEnabled: true
    HealthCheckPath: /health
    HealthCheckProtocol: HTTP
    HealthCheckIntervalSeconds: 30
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
    TargetGroupAttributes:
      - Key: stickiness.enabled
        Value: true
      - Key: stickiness.type
        Value: lb_cookie
      - Key: stickiness.lb_cookie.duration_seconds
        Value: 86400  # 24 hours
```

---

### 3. WebSocket Server Updates

**Modified RoomManager with Redis Integration**

```typescript
// metaverse/apps/ws/src/RoomManager.ts

import { RedisService } from '@repo/redis-client';

export class RoomManager {
  private redis: RedisService;
  private serverId: string;
  private localConnections: Map<string, WebSocket> = new Map();

  constructor(redis: RedisService) {
    this.redis = redis;
    this.serverId = process.env.SERVER_ID || `ws-${Date.now()}`;
    
    // Subscribe to room events from other servers
    this.setupCrossServerSync();
    
    // Start heartbeat
    this.startHeartbeat();
  }

  private setupCrossServerSync(): void {
    // Subscribe to all room events (pattern subscribe)
    this.redis.psubscribe('room:*:events', async (pattern, channel, message) => {
      const data = JSON.parse(message);
      
      // Ignore events from this server
      if (data.serverId === this.serverId) return;
      
      const spaceId = channel.split(':')[1];
      await this.forwardEventToLocalUsers(spaceId, data);
    });
  }

  private async forwardEventToLocalUsers(spaceId: string, event: any): Promise<void> {
    // Get local users in this room
    const localUsers = Array.from(this.localConnections.entries())
      .filter(([userId]) => this.isUserInRoom(spaceId, userId));
    
    // Forward event to each local user
    for (const [userId, ws] of localUsers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  }

  async addUser(spaceId: string, userId: string, ws: WebSocket, userData: UserData): Promise<void> {
    // Store connection locally
    this.localConnections.set(userId, ws);
    
    // Store user data in Redis (shared state)
    await this.redis.addUserToRoom(spaceId, userId, {
      ...userData,
      serverId: this.serverId,
      connectedAt: Date.now()
    });
    
    // Publish join event to all servers
    await this.redis.publish(`room:${spaceId}:events`, {
      type: 'user-joined',
      payload: { userId, ...userData },
      serverId: this.serverId
    });
  }

  async moveUser(spaceId: string, userId: string, x: number, y: number): Promise<void> {
    // Update Redis
    const userData = await this.redis.cache.hget(`room:${spaceId}:users`, userId);
    if (userData) {
      const parsed = JSON.parse(userData);
      parsed.x = x;
      parsed.y = y;
      await this.redis.cache.hset(`room:${spaceId}:users`, userId, JSON.stringify(parsed));
    }
    
    // Publish move event to all servers
    await this.redis.publish(`room:${spaceId}:events`, {
      type: 'user-moved',
      payload: { userId, x, y },
      serverId: this.serverId
    });
  }

  async removeUser(spaceId: string, userId: string): Promise<void> {
    // Remove local connection
    this.localConnections.delete(userId);
    
    // Remove from Redis
    await this.redis.removeUserFromRoom(spaceId, userId);
    
    // Publish leave event
    await this.redis.publish(`room:${spaceId}:events`, {
      type: 'user-left',
      payload: { userId },
      serverId: this.serverId
    });
  }

  async getUsers(spaceId: string): Promise<UserData[]> {
    // Get from Redis (includes users on all servers)
    return await this.redis.getUsersInRoom(spaceId);
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      // Mark server as alive
      await this.redis.cache.set(`server:${this.serverId}:alive`, '1', 'EX', 30);
      
      // Track local connection count
      await this.redis.cache.set(
        `server:${this.serverId}:connections`,
        this.localConnections.size,
        'EX',
        60
      );
    }, 10000); // Every 10 seconds
  }
}
```

---

### 4. Database Optimization

**Connection Pooling Configuration**

```typescript
// metaverse/packages/db/src/index.ts

import { PrismaClient } from '@prisma/client';

// Singleton with connection pooling
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Prisma connection pool configuration
    // Add to DATABASE_URL: ?connection_limit=20&pool_timeout=10
  }
  return prisma;
}

// For 2000 users with 3 WebSocket servers:
// Each server: connection_limit=20 (20 concurrent queries)
// Total: 60 connections to PostgreSQL
```

**Database URL with Pool Settings:**
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10&connect_timeout=5"
```

**Add Read Replicas for Scaling:**
```typescript
// Read from replica for non-critical queries
const replicaUrl = process.env.DATABASE_REPLICA_URL;

// Write to primary
await prisma.user.create({ data: userData });

// Read from replica
const users = await prisma.$queryRawUnsafe(
  'SELECT * FROM users WHERE space_id = $1',
  spaceId
);
```

---

### 5. Monitoring & Health Checks

**Health Check Endpoint**

```typescript
// metaverse/apps/ws/src/health.ts

export class HealthCheck {
  async getStatus(): Promise<HealthStatus> {
    return {
      server: {
        id: this.serverId,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      connections: {
        active: this.localConnections.size,
        max: 500,
        percentage: (this.localConnections.size / 500) * 100,
      },
      redis: {
        connected: await this.checkRedis(),
        latency: await this.measureRedisLatency(),
      },
      database: {
        connected: await this.checkDatabase(),
        pool: await this.getDatabasePoolStats(),
      },
    };
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.cache.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

// Endpoint
app.get('/health', async (req, res) => {
  const health = await healthCheck.getStatus();
  res.json(health);
});
```

**Prometheus Metrics** (Recommended)

```typescript
// metaverse/apps/ws/src/metrics.ts

import client from 'prom-client';

// Create metrics
const wsConnections = new client.Gauge({
  name: 'websocket_connections_total',
  help: 'Total WebSocket connections',
  labelNames: ['server_id'],
});

const roomUsers = new client.Gauge({
  name: 'room_users_total',
  help: 'Total users in rooms',
  labelNames: ['space_id'],
});

const videoCalls = new client.Gauge({
  name: 'video_calls_active',
  help: 'Active video calls',
});

// Update metrics
setInterval(() => {
  wsConnections.set({ server_id: serverId }, localConnections.size);
}, 5000);

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

---

## Deployment Strategy

### Phase 1: Infrastructure Setup (Week 1)

1. **Set up Redis Cluster**
   ```bash
   # AWS ElastiCache or self-hosted
   docker run -d --name redis-1 -p 6379:6379 redis:7-alpine
   docker run -d --name redis-2 -p 6380:6379 redis:7-alpine
   docker run -d --name redis-3 -p 6381:6379 redis:7-alpine
   ```

2. **Set up Load Balancer**
   - Option A: Nginx (cheaper, self-managed)
   - Option B: AWS ALB (easier, managed)

3. **Configure PostgreSQL Connection Pooling**
   - Update DATABASE_URL with pool settings
   - Test with 60 concurrent connections

### Phase 2: Code Changes (Week 2)

1. **Update RoomManager** with Redis integration
2. **Add Pub/Sub handlers** for cross-server events
3. **Implement server heartbeat** and stale cleanup
4. **Add health check endpoints**

### Phase 3: Testing (Week 3)

1. **Load Testing**
   ```bash
   # Artillery load test
   artillery run --target wss://app.metaverse.com/ws load-test.yml
   ```

2. **Multi-Server Testing**
   - Start 3 WebSocket instances
   - Connect 500 users to each
   - Verify cross-server communication

3. **Failover Testing**
   - Kill one server instance
   - Verify users reconnect to other instances
   - Verify no data loss

### Phase 4: Bug Fixes (Week 4)

Now fix bugs in priority order:
1. BUG-032: Page refresh (CRITICAL)
2. BUG-011: Coordinate system (CRITICAL)
3. BUG-015: WebSocket disconnection (CRITICAL)
4. Others from FIX_PRIORITY_GUIDE.md

---

## Resource Requirements

### Development Environment
```yaml
Services:
  - Redis: 1 instance (512MB RAM)
  - PostgreSQL: 1 instance (2GB RAM)
  - WebSocket: 2 instances (512MB each)
  - HTTP API: 1 instance (512MB RAM)
  - Frontend: 1 instance (512MB RAM)

Total: ~4.5GB RAM, 4 vCPUs
Cost: Free tier or $0
```

### Production Environment (2000 users)
```yaml
Load Balancer:
  - Nginx on t3.small: $15/month
  - OR AWS ALB: $25/month

WebSocket Servers (3x):
  - EC2 t3.medium (2 vCPU, 4GB): $100/month
  - OR DigitalOcean droplets: $72/month

Redis Cluster:
  - ElastiCache (3 nodes): $50/month
  - OR Self-hosted on t3.small: $15/month

PostgreSQL:
  - RDS db.t3.medium (2 vCPU, 4GB): $65/month
  - OR Self-hosted on t3.medium: $35/month

HTTP API (2x):
  - EC2 t3.small: $30/month

Total: $200-300/month
```

---

## Performance Targets

| Metric | Target | Monitoring |
|--------|--------|------------|
| WebSocket Connections | 2000 concurrent | Prometheus gauge |
| Message Latency | < 100ms | Redis pub/sub timing |
| Database Query Time | < 50ms | Prisma metrics |
| Redis Latency | < 5ms | Health check |
| CPU Usage | < 70% | CloudWatch/DataDog |
| Memory Usage | < 80% | CloudWatch/DataDog |
| Uptime | 99.9% | UptimeRobot |

---

## Migration Checklist

- [ ] Set up Redis cluster (ElastiCache or self-hosted)
- [ ] Update RoomManager to use Redis for state
- [ ] Implement Redis Pub/Sub for events
- [ ] Add server ID to all instances
- [ ] Set up load balancer with sticky sessions
- [ ] Configure PostgreSQL connection pooling
- [ ] Add health check endpoints
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Deploy 3 WebSocket instances
- [ ] Load test with 2000 connections
- [ ] Fix BUG-032 (page refresh)
- [ ] Fix remaining critical bugs

---

## Next Steps

1. **This Week**: Set up Redis + Load Balancer infrastructure
2. **Week 2**: Implement code changes (RoomManager, Pub/Sub)
3. **Week 3**: Load testing + optimization
4. **Week 4**: Bug fixes from priority list

Would you like me to start with:
- **Option A**: Set up Redis integration code first?
- **Option B**: Create deployment scripts (Docker Compose)?
- **Option C**: Start fixing BUG-032 with scalability in mind?
