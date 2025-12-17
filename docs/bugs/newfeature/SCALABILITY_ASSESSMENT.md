# AWS Scalability Assessment for 100K Users

## Executive Summary

**Current State**: Single-server monolithic architecture  
**Target**: 100,000 concurrent users on AWS  
**Estimated Monthly Cost**: $8,000 - $15,000 (production-ready setup)  
**Critical Changes Required**: Redis Pub/Sub, Horizontal scaling, Load balancing, Database optimization  
**Timeline**: 4-8 weeks for full migration

---

## Current Architecture Analysis

### What You Have Now

#### 1. **HTTP Server** (`apps/http`)
- **Technology**: Express.js, single Node.js process
- **Port**: 3000
- **Features**: REST API, cookie authentication, rate limiting (IP-based), username bloom filter
- **Current Capacity**: ~1,000-2,000 concurrent connections
- **Bottleneck**: Single process, no horizontal scaling

#### 2. **WebSocket Server** (`apps/ws`)
- **Technology**: ws library, single Node.js process
- **Port**: 3001
- **Features**: Real-time position updates, proximity detection, video signaling
- **Current Capacity**: ~5,000-10,000 concurrent WebSocket connections (per instance)
- **Critical Issues**:
  - No sticky session support
  - Users in same room must connect to same server instance
  - Cannot scale horizontally without Redis Pub/Sub coordination

#### 3. **Database Layer**
- **PostgreSQL**: Single instance (localhost)
- **Redis**: Single instance for room state caching
- **Prisma ORM**: Connection pooling not optimized for high concurrency
- **Issues**:
  - Single point of failure
  - No read replicas
  - Connection pool will exhaust at ~500-1000 concurrent requests

#### 4. **Video Calling**
- **Technology**: WebRTC peer-to-peer
- **Signaling**: Through WebSocket server
- **Bandwidth**: Client-to-client (good for scaling)
- **Issue**: Signaling server must coordinate all peers (single server bottleneck)

### Current Performance Limits

| Component | Current Limit | Bottleneck |
|-----------|---------------|------------|
| HTTP API | 2,000 concurrent | Single process CPU |
| WebSocket | 10,000 connections | Memory + event loop |
| PostgreSQL | 500 concurrent queries | Connection pool |
| Redis | 50,000 ops/sec | Single instance |
| **TOTAL SYSTEM** | **~500-1,000 users** | WebSocket coordination |

---

## Target Architecture for 100K Users

### AWS Service Recommendations

#### 1. **Compute Layer**
```
┌─────────────────────────────────────────────────┐
│  Application Load Balancer (ALB)                │
│  - Sticky sessions (WebSocket routing)          │
│  - SSL termination                              │
│  - Health checks                                │
└────────────────┬────────────────────────────────┘
                 │
    ┌────────────┴──────────────┐
    │                           │
┌───▼────────────┐   ┌─────────▼──────────┐
│ HTTP Service   │   │ WebSocket Service  │
│ ECS Fargate    │   │ ECS Fargate        │
│ 10-20 tasks    │   │ 20-50 tasks        │
│ 2 vCPU, 4GB    │   │ 4 vCPU, 8GB        │
└────────────────┘   └────────────────────┘
```

**Service**: AWS ECS with Fargate (serverless containers)  
**Why**: Auto-scaling, no server management, pay-per-use  
**Alternative**: EKS (Kubernetes) if you need more control

**HTTP Service Scaling**:
- **Target**: 10-20 containers (each handles ~5,000 users)
- **Size**: 2 vCPU, 4GB RAM per container
- **Cost**: ~$50-100/month per container = **$1,000-2,000/month**

**WebSocket Service Scaling**:
- **Target**: 20-50 containers (each handles ~2,000-5,000 WebSocket connections)
- **Size**: 4 vCPU, 8GB RAM per container
- **Cost**: ~$100-150/month per container = **$3,000-7,500/month**

#### 2. **Database Layer**

**PostgreSQL**: AWS RDS Multi-AZ
```
Primary DB (Write)
    ↓
Read Replica 1 ──→ (Read operations)
Read Replica 2 ──→ (Read operations)
Read Replica 3 ──→ (Read operations)
```

- **Instance**: db.r6g.2xlarge (8 vCPU, 64GB RAM)
- **Multi-AZ**: Yes (automatic failover)
- **Read Replicas**: 3 replicas for read scaling
- **Connections**: 2,000+ concurrent connections
- **Storage**: 500GB GP3 SSD with auto-scaling
- **Cost**: **$800-1,200/month** (primary) + **$500-800/month** per replica = **$2,300-3,600/month**

**Redis**: AWS ElastiCache for Redis (Cluster Mode)
```
Cluster Mode Enabled:
- Shard 1: Master + Replica (0-5461 hash slots)
- Shard 2: Master + Replica (5462-10922 hash slots)
- Shard 3: Master + Replica (10923-16383 hash slots)
```

- **Instance**: cache.r6g.xlarge (4 vCPU, 26GB RAM) × 6 nodes
- **Cluster Mode**: Enabled (horizontal scaling)
- **Purpose**: Room state, WebSocket coordination (Pub/Sub), session storage
- **Cost**: **$1,200-1,800/month**

#### 3. **Load Balancing & Networking**

**Application Load Balancer**:
- **Sticky Sessions**: Enabled for WebSocket connections
- **Target Groups**: HTTP service, WebSocket service (separate)
- **Health Checks**: Every 30 seconds
- **Cost**: **$30-50/month** + data transfer costs

**CloudFront CDN**:
- **Purpose**: Static assets (Next.js frontend), avatar images, office space sprites
- **Regions**: Global edge locations
- **Cost**: **$50-200/month** (depending on traffic)

#### 4. **Monitoring & Logging**

**CloudWatch**:
- Metrics: CPU, memory, connection counts, latency
- Alarms: Auto-scaling triggers, error rate alerts
- **Cost**: **$100-200/month**

**CloudWatch Logs**:
- Centralized logging from all containers
- Log retention: 30 days
- **Cost**: **$50-100/month**

#### 5. **Storage**

**S3**:
- Avatar uploads, space thumbnails, static assets
- **Cost**: **$20-50/month**

**EFS** (optional):
- Shared file storage across containers
- **Cost**: **$30-100/month**

---

## Critical Code Changes Required

### 1. Redis Pub/Sub for WebSocket Coordination

**Problem**: Users in the same room can be connected to different WebSocket servers. They won't see each other's movements.

**Solution**: Implement Redis Pub/Sub to broadcast messages across all WebSocket server instances.

**File to modify**: `metaverse/apps/ws/src/RoomManager.ts`

```typescript
import { RedisService } from './RedisService';

export class Roommanager {
  private redisPub: RedisService;
  private redisSub: RedisService;
  
  constructor() {
    this.redisPub = RedisService.getInstance();
    // Create separate connection for pub/sub (Redis requirement)
    this.redisSub = new RedisService();
    this.setupPubSub();
  }
  
  async setupPubSub() {
    await this.redisSub.connect();
    
    // Subscribe to room events from other servers
    this.redisSub.subscribe('room:*', (channel, message) => {
      const data = JSON.parse(message);
      const roomId = channel.split(':')[1];
      
      // Broadcast to local users in this room
      this.broadcastToRoom(roomId, data, data.senderId);
    });
  }
  
  // When broadcasting, publish to Redis so all servers receive it
  broadcast(roomId: string, message: any, senderId?: string) {
    // Broadcast to local users
    this.broadcastToRoom(roomId, message, senderId);
    
    // Publish to Redis for other servers
    this.redisPub.publish(`room:${roomId}`, JSON.stringify({
      ...message,
      senderId,
      serverId: process.env.INSTANCE_ID // Identify which server sent this
    }));
  }
}
```

**Estimated effort**: 2-3 days

### 2. Database Connection Pooling Optimization

**File to modify**: `metaverse/packages/db/src/index.ts`

```typescript
import { PrismaClient } from '@prisma/client';

// Calculate pool size based on instance count
const MAX_CONNECTIONS = 100; // Per instance
const POOL_TIMEOUT = 10; // seconds

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
  errorFormat: 'minimal',
  // Connection pooling configuration
  __internal: {
    engine: {
      connection_limit: MAX_CONNECTIONS,
      pool_timeout: POOL_TIMEOUT,
      // Use read replicas for SELECT queries
      read_replicas: process.env.DATABASE_READ_REPLICAS?.split(',') || [],
    },
  },
});

// Health check with connection pool monitoring
export async function checkDatabaseHealth() {
  const metrics = await prisma.$metrics.json();
  return {
    connected: true,
    poolSize: metrics.counters.find(c => c.key === 'pool_connection_count')?.value || 0,
    activeConnections: metrics.counters.find(c => c.key === 'active_connection_count')?.value || 0,
  };
}
```

**Estimated effort**: 1-2 days

### 3. Sticky Session Implementation

**Problem**: WebSocket connections must stay on the same server for the duration of the session.

**Solution**: ALB sticky sessions + session ID in cookies

**File to modify**: `metaverse/apps/ws/src/index.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

wss.on('connection', function connection(ws, request) {
  // Generate unique session ID for this connection
  const sessionId = uuidv4();
  const instanceId = process.env.INSTANCE_ID || 'unknown';
  
  // Store session info (for debugging/monitoring)
  console.log(`Session ${sessionId} assigned to instance ${instanceId}`);
  
  // Send session confirmation to client
  ws.send(JSON.stringify({
    type: 'session-init',
    payload: {
      sessionId,
      instanceId,
      timestamp: Date.now()
    }
  }));
  
  // ... rest of connection handler
});
```

**Frontend change** (`services/websocket.ts`):
```typescript
// Store session ID from server
this.sessionId = null;

this.ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'session-init') {
    this.sessionId = data.payload.sessionId;
    // Store in cookie for ALB sticky sessions
    document.cookie = `AWSALB=${this.sessionId}; path=/; max-age=86400`;
  }
  
  // ... rest of message handler
};
```

**Estimated effort**: 1 day

### 4. Rate Limiting with Redis (Distributed)

**Problem**: Current rate limiting is per-server, not global.

**File to modify**: `metaverse/apps/http/src/middleware/rateLimiter.ts`

```typescript
import { RedisService } from '../RedisService';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const redis = RedisService.getInstance();

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis.getClient(),
    prefix: 'rl:api:', // Rate limit key prefix
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
});
```

**Estimated effort**: 0.5 day

### 5. Graceful Shutdown for Zero-Downtime Deployments

**File to modify**: `metaverse/apps/ws/src/index.ts`

```typescript
async function gracefulShutdown(): Promise<void> {
  console.log('🔄 Starting graceful shutdown...');
  
  // 1. Stop accepting new connections
  wss.close();
  
  // 2. Notify all users of impending shutdown (30 second warning)
  wss.clients.forEach((ws) => {
    ws.send(JSON.stringify({
      type: 'server-shutdown',
      payload: {
        message: 'Server restarting, you will be reconnected automatically',
        countdown: 30
      }
    }));
  });
  
  // 3. Wait 30 seconds for graceful disconnect
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // 4. Force close remaining connections
  wss.clients.forEach((ws) => {
    ws.close(1001, 'Server restarting');
  });
  
  // 5. Disconnect services
  await RedisService.getInstance().disconnect();
  await KafkaChatService.getInstance().disconnect();
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown); // ECS shutdown signal
process.on('SIGINT', gracefulShutdown);
```

**Frontend auto-reconnect** (`services/websocket.ts`):
```typescript
this.ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'server-shutdown') {
    console.log('Server restarting, will auto-reconnect...');
    this.autoReconnect = true; // Enable auto-reconnect
  }
};

this.ws.onclose = () => {
  if (this.autoReconnect) {
    setTimeout(() => {
      console.log('Reconnecting to server...');
      this.connect();
    }, 2000);
  }
};
```

**Estimated effort**: 1 day

---

## AWS Infrastructure Setup

### 1. VPC Configuration

```
VPC: 10.0.0.0/16
├── Public Subnets (ALB, NAT Gateways)
│   ├── us-east-1a: 10.0.1.0/24
│   ├── us-east-1b: 10.0.2.0/24
│   └── us-east-1c: 10.0.3.0/24
│
├── Private Subnets (ECS, RDS, ElastiCache)
│   ├── us-east-1a: 10.0.11.0/24
│   ├── us-east-1b: 10.0.12.0/24
│   └── us-east-1c: 10.0.13.0/24
│
└── Database Subnets (RDS only)
    ├── us-east-1a: 10.0.21.0/24
    ├── us-east-1b: 10.0.22.0/24
    └── us-east-1c: 10.0.23.0/24
```

### 2. ECS Cluster Configuration

**HTTP Service Task Definition**:
```json
{
  "family": "metaverse-http",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "http-service",
      "image": "<ECR_REGISTRY>/metaverse-http:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "REDIS_HOST", "value": "metaverse-redis.cache.amazonaws.com" },
        { "name": "DATABASE_URL", "value": "postgres://..." }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/metaverse-http",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

**WebSocket Service Task Definition**:
```json
{
  "family": "metaverse-websocket",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "4096",
  "memory": "8192",
  "containerDefinitions": [
    {
      "name": "websocket-service",
      "image": "<ECR_REGISTRY>/metaverse-websocket:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "WS_PORT", "value": "3001" },
        { "name": "REDIS_HOST", "value": "metaverse-redis.cache.amazonaws.com" },
        { "name": "INSTANCE_ID", "value": "${INSTANCE_ID}" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/metaverse-websocket",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Auto-Scaling Configuration**:
```json
{
  "ServiceName": "metaverse-websocket",
  "ScalingPolicies": [
    {
      "PolicyName": "websocket-cpu-scaling",
      "TargetTrackingScalingPolicyConfiguration": {
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
          "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
        },
        "ScaleInCooldown": 300,
        "ScaleOutCooldown": 60
      }
    },
    {
      "PolicyName": "websocket-memory-scaling",
      "TargetTrackingScalingPolicyConfiguration": {
        "TargetValue": 80.0,
        "PredefinedMetricSpecification": {
          "PredefinedMetricType": "ECSServiceAverageMemoryUtilization"
        }
      }
    }
  ],
  "MinCapacity": 20,
  "MaxCapacity": 50
}
```

### 3. Application Load Balancer

**Target Groups**:
```
1. metaverse-http-tg
   - Protocol: HTTP
   - Port: 3000
   - Health Check: /health
   - Stickiness: Disabled

2. metaverse-websocket-tg
   - Protocol: HTTP
   - Port: 3001
   - Health Check: /health
   - Stickiness: ENABLED (duration: 24 hours)
   - Sticky Cookie: AWSALB
```

**Listener Rules**:
```
Listener 1 (HTTP:80)
└── Redirect to HTTPS

Listener 2 (HTTPS:443)
├── Path: /ws/* → metaverse-websocket-tg
└── Path: /* → metaverse-http-tg
```

### 4. RDS Configuration

**Primary Instance**:
```
Engine: PostgreSQL 16
Instance: db.r6g.2xlarge
- 8 vCPU
- 64 GB RAM
- 500 GB GP3 SSD (10,000 IOPS)
Multi-AZ: Enabled
Backup: Automated daily snapshots (7 day retention)
Encryption: Enabled (AES-256)

Connection Pool:
- Max Connections: 2000
- Connection Timeout: 10s
- Idle Connection Timeout: 300s
```

**Read Replicas** (3 instances):
```
Same specs as primary
Regions: us-east-1a, us-east-1b, us-east-1c
Use Cases:
- Read Replica 1: User queries (profile, auth)
- Read Replica 2: Space/element queries
- Read Replica 3: Chat history queries
```

**Parameter Group Optimizations**:
```
max_connections = 2000
shared_buffers = 16GB
effective_cache_size = 48GB
maintenance_work_mem = 2GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1 (for SSD)
effective_io_concurrency = 200
work_mem = 32MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### 5. ElastiCache Redis Cluster

**Cluster Configuration**:
```
Node Type: cache.r6g.xlarge
- 4 vCPU
- 26 GB RAM
Cluster Mode: Enabled
Shards: 3
Replicas per Shard: 1 (total 6 nodes)

Shard 1: Room state (spaceId:* keys)
Shard 2: User sessions (user:* keys)
Shard 3: Rate limiting (rl:* keys)

Parameter Group:
- maxmemory-policy: allkeys-lru
- timeout: 300 (client timeout)
- tcp-keepalive: 60
- notify-keyspace-events: Ex (for pub/sub)
```

**Redis Pub/Sub Channels**:
```
room:<spaceId>         - User movements and events
video:<callId>         - WebRTC signaling
presence:<spaceId>     - User join/leave events
chat:<chatroomId>      - Chat messages (backup to Kafka)
```

---

## Cost Breakdown (Monthly)

| Service | Configuration | Cost Range |
|---------|---------------|------------|
| **Compute** | | |
| ECS Fargate (HTTP) | 10-20 tasks, 2 vCPU, 4GB | $1,000 - $2,000 |
| ECS Fargate (WebSocket) | 20-50 tasks, 4 vCPU, 8GB | $3,000 - $7,500 |
| **Database** | | |
| RDS PostgreSQL (Primary) | db.r6g.2xlarge, Multi-AZ | $800 - $1,200 |
| RDS Read Replicas (3x) | db.r6g.2xlarge | $1,500 - $2,400 |
| ElastiCache Redis Cluster | cache.r6g.xlarge × 6 | $1,200 - $1,800 |
| **Networking** | | |
| Application Load Balancer | 2 load balancers | $30 - $50 |
| CloudFront CDN | Static assets | $50 - $200 |
| Data Transfer | ~10TB outbound | $500 - $900 |
| **Storage** | | |
| S3 | 1TB storage + requests | $20 - $50 |
| EBS Volumes | ECS task storage | $100 - $200 |
| **Monitoring** | | |
| CloudWatch Metrics | Custom metrics + logs | $100 - $200 |
| CloudWatch Logs | 500GB/month | $50 - $100 |
| **Backups** | | |
| RDS Snapshots | 7 days retention | $50 - $100 |
| **Total** | | **$8,400 - $16,700** |

**Realistic Production Estimate**: **$10,000 - $12,000/month** for 100K concurrent users

**Cost Optimization Tips**:
1. Use **Savings Plans** (1-year commitment) → Save 30-40%
2. Use **Spot Instances** for non-critical HTTP tasks → Save 50-70%
3. Enable **S3 Intelligent Tiering** → Save 30-50% on storage
4. Use **CloudFront Regional Edge Caches** → Reduce origin requests by 80%
5. Optimize **RDS storage** with auto-scaling → Only pay for what you use

**Cost with Optimizations**: **$6,000 - $8,000/month**

---

## Performance Metrics & SLAs

### Target Metrics for 100K Users

| Metric | Target | Monitoring |
|--------|--------|------------|
| **WebSocket Latency** | < 50ms (p95) | CloudWatch custom metric |
| **API Response Time** | < 100ms (p95) | ALB metrics |
| **Database Query Time** | < 20ms (p95) | RDS Performance Insights |
| **Redis Operations** | < 5ms (p99) | ElastiCache metrics |
| **Video Call Setup** | < 2s | Custom metric |
| **User Movement Update** | < 50ms | Custom metric |
| **Connection Success Rate** | > 99.5% | CloudWatch alarm |
| **System Uptime** | > 99.9% | Composite alarm |

### Auto-Scaling Triggers

**WebSocket Service**:
- Scale OUT when: CPU > 70% OR Memory > 80% OR Active Connections > 4000
- Scale IN when: CPU < 40% AND Memory < 50% AND Active Connections < 2000
- Cooldown: 60s scale out, 300s scale in

**HTTP Service**:
- Scale OUT when: CPU > 70% OR Request Count > 5000/min
- Scale IN when: CPU < 40% AND Request Count < 2000/min
- Cooldown: 60s scale out, 300s scale in

**Database**:
- Read Replica promotion: When primary fails (automatic)
- Add read replica: When read CPU > 80% for 15 minutes (manual)

---

## Deployment Strategy

### Phase 1: Infrastructure Setup (Week 1-2)

1. **Day 1-3**: AWS Account setup
   - Create VPC, subnets, security groups
   - Provision RDS PostgreSQL (primary)
   - Provision ElastiCache Redis cluster
   - Configure S3 buckets

2. **Day 4-7**: Container setup
   - Create ECR repositories
   - Dockerize HTTP and WebSocket services
   - Test containers locally
   - Push images to ECR

3. **Day 8-10**: ECS setup
   - Create ECS cluster
   - Define task definitions
   - Create services (HTTP and WebSocket)
   - Configure auto-scaling

4. **Day 11-14**: Load balancer & DNS
   - Provision ALB
   - Configure target groups
   - Set up Route 53 DNS
   - Configure SSL certificates

### Phase 2: Code Migration (Week 3-4)

1. **Day 15-17**: Redis Pub/Sub implementation
   - Modify RoomManager.ts
   - Test cross-server message broadcasting
   - Verify user presence across instances

2. **Day 18-20**: Database optimization
   - Configure read replicas
   - Implement connection pooling
   - Add query caching
   - Test failover

3. **Day 21-22**: Rate limiting
   - Implement distributed rate limiting with Redis
   - Test across multiple instances

4. **Day 23-24**: Graceful shutdown
   - Implement shutdown handlers
   - Test zero-downtime deployments
   - Verify auto-reconnect

5. **Day 25-28**: Monitoring & alerting
   - Set up CloudWatch dashboards
   - Configure alarms
   - Test incident response

### Phase 3: Testing & Optimization (Week 5-6)

1. **Load Testing**:
   - Simulate 10K users (Artillery, k6)
   - Simulate 50K users
   - Simulate 100K users
   - Identify bottlenecks

2. **Chaos Engineering**:
   - Kill random ECS tasks (verify auto-healing)
   - Simulate database failover
   - Simulate Redis cluster node failure
   - Network latency injection

3. **Performance Tuning**:
   - Optimize WebSocket message batching
   - Tune database queries
   - Adjust auto-scaling thresholds
   - Cache optimization

### Phase 4: Production Cutover (Week 7-8)

1. **Blue-Green Deployment**:
   - Deploy new infrastructure (green)
   - Migrate 10% of traffic
   - Monitor for 48 hours
   - Gradually increase to 100%

2. **Rollback Plan**:
   - Keep old infrastructure running for 1 week
   - Instant rollback via DNS change
   - Database replication back to old system

---

## Risk Mitigation

### High-Risk Areas

1. **WebSocket Connection Stability**
   - **Risk**: User disconnects during deployment
   - **Mitigation**: Graceful shutdown with 30s warning, auto-reconnect
   - **Recovery**: Redis state persistence ensures user position is restored

2. **Database Connection Exhaustion**
   - **Risk**: 100K users × 5 queries/sec = 500K qps
   - **Mitigation**: Connection pooling, read replicas, query caching
   - **Recovery**: Auto-scaling read replicas, circuit breakers

3. **Redis Memory Overflow**
   - **Risk**: 100K users × 2KB state = 200MB, but pub/sub can spike
   - **Mitigation**: LRU eviction policy, cluster mode sharding
   - **Recovery**: Add shards dynamically, increase node size

4. **Video Call Signaling Bottleneck**
   - **Risk**: 10K simultaneous video calls × 2 users = 20K WebRTC signaling messages
   - **Mitigation**: Dedicated WebSocket service for video, separate from movement
   - **Recovery**: Scale WebSocket service independently

### Disaster Recovery Plan

**RTO (Recovery Time Objective)**: 15 minutes  
**RPO (Recovery Point Objective)**: 5 minutes

**Backup Strategy**:
1. RDS automated snapshots every 6 hours
2. Redis cluster automatic failover (< 1 minute)
3. ECS tasks auto-replace failed instances (< 2 minutes)
4. Multi-AZ deployment for all services

**Failover Procedure**:
1. Detect outage (CloudWatch alarm)
2. Trigger incident response (PagerDuty)
3. Promote read replica to primary (automatic)
4. Route traffic to backup ALB (Route 53 health checks)
5. Notify users via in-app message

---

## Monitoring Dashboard

### Key CloudWatch Metrics

**WebSocket Service**:
```
- ws.connections.active (gauge)
- ws.connections.new (counter)
- ws.connections.closed (counter)
- ws.messages.sent (counter)
- ws.messages.received (counter)
- ws.latency.p50 (histogram)
- ws.latency.p95 (histogram)
- ws.latency.p99 (histogram)
- ws.errors.rate (counter)
```

**HTTP Service**:
```
- http.requests.total (counter)
- http.requests.rate (gauge)
- http.response_time.p50 (histogram)
- http.response_time.p95 (histogram)
- http.errors.4xx (counter)
- http.errors.5xx (counter)
```

**Database**:
```
- db.connections.active (gauge)
- db.connections.waiting (gauge)
- db.query_time.p95 (histogram)
- db.deadlocks (counter)
- db.cache_hit_ratio (gauge)
```

**Redis**:
```
- redis.ops_per_sec (gauge)
- redis.memory_used (gauge)
- redis.memory_fragmentation (gauge)
- redis.keyspace_misses (counter)
- redis.pubsub_channels (gauge)
```

**Business Metrics**:
```
- users.online (gauge)
- users.in_spaces (gauge)
- video_calls.active (gauge)
- video_calls.setup_time (histogram)
- spaces.active (gauge)
```

### Alarms

**Critical** (wake up on-call engineer):
- HTTP 5xx error rate > 5% for 5 minutes
- WebSocket connection failure rate > 10% for 2 minutes
- Database CPU > 90% for 10 minutes
- Redis memory > 95% for 5 minutes

**Warning** (send Slack notification):
- HTTP latency p95 > 500ms for 10 minutes
- WebSocket latency p95 > 200ms for 10 minutes
- Database connection pool > 80% for 15 minutes
- ECS task count at max capacity for 30 minutes

---

## Security Considerations

### Network Security

1. **VPC Security Groups**:
   ```
   ALB Security Group:
   - Inbound: 443 (HTTPS) from 0.0.0.0/0
   - Outbound: 3000-3001 to ECS security group
   
   ECS Security Group:
   - Inbound: 3000-3001 from ALB security group
   - Outbound: 5432 to RDS security group, 6379 to Redis security group
   
   RDS Security Group:
   - Inbound: 5432 from ECS security group
   - Outbound: None
   
   Redis Security Group:
   - Inbound: 6379 from ECS security group
   - Outbound: None
   ```

2. **Network ACLs**: Default deny-all, explicitly allow required traffic

3. **VPC Endpoints**: S3 and ECR access without internet gateway

### Application Security

1. **Secrets Management**: AWS Secrets Manager for database passwords, API keys
2. **IAM Roles**: Least-privilege ECS task roles
3. **Encryption**:
   - TLS 1.3 for all connections (ALB → ECS, ECS → RDS, ECS → Redis)
   - RDS encryption at rest (AES-256)
   - S3 bucket encryption (AES-256)
4. **Rate Limiting**: Distributed rate limiting with Redis (100 req/15min per IP)
5. **WAF**: AWS WAF rules to block SQL injection, XSS attacks

### Compliance

- **GDPR**: User data encryption, right to deletion (implement user data export API)
- **SOC 2**: Audit logging with CloudTrail, access controls with IAM
- **Data Residency**: Deploy in user's region (multi-region support)

---

## Next Steps

### Immediate Actions (This Week)

1. ✅ Review this document with your team
2. 📋 Create AWS account and enable billing alerts
3. 💰 Get budget approval ($10K-12K/month)
4. 👥 Assign team roles (DevOps engineer, backend engineer)
5. 📅 Schedule Phase 1 kickoff meeting

### Week 1 Tasks

1. Provision AWS infrastructure (VPC, RDS, Redis)
2. Dockerize HTTP and WebSocket services
3. Set up CI/CD pipeline (GitHub Actions → ECR)
4. Create ECS cluster and task definitions
5. Deploy to staging environment

### Week 2 Tasks

1. Implement Redis Pub/Sub for WebSocket coordination
2. Optimize database connection pooling
3. Implement sticky sessions
4. Set up monitoring and alerting
5. Load test with 10K simulated users

### Week 3-4 Tasks

1. Implement graceful shutdown and auto-reconnect
2. Optimize query performance with read replicas
3. Implement distributed rate limiting
4. Load test with 50K simulated users
5. Tune auto-scaling policies

### Week 5-6 Tasks

1. Load test with 100K simulated users
2. Chaos engineering tests
3. Performance tuning
4. Security audit
5. Documentation and runbooks

### Week 7-8 Tasks

1. Blue-green deployment preparation
2. Migrate 10% of traffic to new infrastructure
3. Monitor for 48 hours
4. Gradually increase to 100%
5. Decommission old infrastructure

---

## Questions to Answer Before Starting

1. **What is your target go-live date?**
   - This determines whether you need 4 weeks (aggressive) or 8 weeks (comfortable)

2. **Do you have DevOps expertise in-house?**
   - If no, consider hiring AWS consulting partner or contractor

3. **What is your current user count?**
   - Helps determine if you need intermediate scaling step (10K users first)

4. **Do you have a staging environment?**
   - Essential for testing before production deployment

5. **What are your peak hours?**
   - Determines auto-scaling schedule (e.g., scale up 9am-5pm, scale down nights)

6. **Do you need multi-region deployment?**
   - Affects cost (2x-3x) and complexity (data replication, latency)

7. **What is your incident response plan?**
   - Need on-call rotation? PagerDuty integration?

---

## Conclusion

Your current architecture can handle **~500-1,000 concurrent users**. To scale to **100,000 users**, you need:

✅ **Critical Changes**:
1. Redis Pub/Sub for WebSocket coordination (2-3 days)
2. Horizontal scaling with ECS Fargate (1 week)
3. Database read replicas and connection pooling (1 week)
4. Sticky session support for WebSockets (1 day)
5. Distributed rate limiting (1 day)
6. Graceful shutdown and auto-reconnect (1 day)

✅ **AWS Services**:
- ECS Fargate for compute (30-70 containers)
- RDS PostgreSQL Multi-AZ with 3 read replicas
- ElastiCache Redis Cluster (6 nodes)
- Application Load Balancer with sticky sessions
- CloudFront CDN for static assets
- CloudWatch for monitoring and alerting

✅ **Estimated Cost**: $10,000-12,000/month (can be reduced to $6,000-8,000 with optimizations)

✅ **Timeline**: 4-8 weeks from start to production

**Good news**: Your current codebase is well-structured. The WebSocket architecture, Prisma ORM, and Redis integration provide a solid foundation. With the changes outlined above, you can scale to 100K users without a complete rewrite.

**Start with Phase 1** (infrastructure setup) and we can provide code examples for each change as you progress through the phases.

Let me know which phase you'd like detailed code examples for!
