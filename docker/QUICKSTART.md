# Quick Start Guide

## 🚀 Start the Entire System (5 Minutes)

### Prerequisites
- Docker Desktop installed and running
- Git
- Node.js 18+ (for local development)

---

## Step 1: Clone & Setup (1 minute)

```powershell
# Navigate to project
cd c:\dev\metaverse

# Copy environment file
Copy-Item docker\.env.example docker\.env

# Edit .env if needed (optional)
notepad docker\.env
```

---

## Step 2: Start Infrastructure (2 minutes)

```powershell
# Start all services (Redis, Postgres, 3 WebSocket servers, Nginx, Prometheus, Grafana)
cd docker
docker-compose up -d

# Check status
docker-compose ps

# Expected output:
# NAME                   STATUS              PORTS
# metaverse-redis        Up (healthy)        0.0.0.0:6379->6379/tcp
# metaverse-postgres     Up (healthy)        0.0.0.0:5432->5432/tcp
# metaverse-ws1          Up                  0.0.0.0:3001->3001/tcp
# metaverse-ws2          Up                  0.0.0.0:3002->3001/tcp
# metaverse-ws3          Up                  0.0.0.0:3003->3001/tcp
# metaverse-nginx        Up (healthy)        0.0.0.0:80->80/tcp
# metaverse-prometheus   Up                  0.0.0.0:9090->9090/tcp
# metaverse-grafana      Up                  0.0.0.0:3000->3000/tcp
```

---

## Step 3: Initialize Database (1 minute)

```powershell
# Run Prisma migrations
cd ..
cd metaverse/packages/db
pnpm install
pnpm prisma migrate deploy

# Seed data (optional)
node seed-avatars.js
node seed-elements.js
```

---

## Step 4: Build Bloom Filter (1 minute)

```powershell
# Rebuild username Bloom filter from database
cd ../../apps/ws
node -e "
const { getRedisService } = require('@repo/redis-client');
const { getBloomFilter } = require('@repo/redis-client/BloomFilter');
const { PrismaClient } = require('@prisma/client');

const redis = getRedisService();
const bloom = getBloomFilter(redis.cache);
const prisma = new PrismaClient();

async function rebuild() {
  const usernames = await prisma.user.findMany({ select: { username: true } });
  await bloom.rebuild(() => Promise.resolve(usernames.map(u => u.username)));
  console.log('✅ Bloom filter ready!');
  process.exit(0);
}

rebuild().catch(console.error);
"
```

---

## Step 5: Verify Everything Works

### Check Health Endpoints

```powershell
# Nginx load balancer
curl http://localhost:8080/health
# Expected: "healthy"

# WebSocket server 1
curl http://localhost:3011/health
# Expected: {"status":"healthy","connections":0,"serverId":"ws1"}

# WebSocket server 2
curl http://localhost:3012/health

# WebSocket server 3
curl http://localhost:3013/health

# Redis
docker exec -it metaverse-redis redis-cli ping
# Expected: PONG

# PostgreSQL
docker exec -it metaverse-postgres pg_isready -U metaverse
# Expected: /var/run/postgresql:5432 - accepting connections
```

### Access Monitoring Dashboards

1. **Prometheus**: http://localhost:9090
   - Check targets: http://localhost:9090/targets
   - All should be "UP"

2. **Grafana**: http://localhost:3000
   - Username: `admin`
   - Password: `admin` (change on first login)
   - Import dashboard: `docker/grafana-dashboards/metaverse.json`

3. **Redis Commander** (optional):
   ```powershell
   docker run -d --name redis-commander --network metaverse-network -p 8081:8081 rediscommander/redis-commander:latest --redis-host=redis
   ```
   - Access: http://localhost:8081

---

## Step 6: Test with Client

### Connect via wscat (CLI testing)

```powershell
# Install wscat
npm install -g wscat

# Connect through load balancer
wscat -c ws://localhost/

# Send join message
> {"type":"join","payload":{"spaceId":"office-1","userId":"test-user-1","x":5,"y":5,"name":"Test User","avatar":"default"}}

# Expected response:
< {"type":"joined","payload":{"success":true,"spaceId":"office-1","userId":"test-user-1"}}

# Send move message
> {"type":"move","payload":{"x":6,"y":6}}

# Expected broadcast:
< {"type":"user-moved","payload":{"userId":"test-user-1","x":6,"y":6}}
```

### Test Username Bloom Filter

```powershell
# Start HTTP server (if not already running)
cd metaverse/apps/http
pnpm dev

# Test signup endpoint
curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" -d '{
  "username": "testuser123",
  "email": "test@example.com",
  "password": "SecurePass123!"
}'

# Expected (first time):
# {"success":true,"user":{...}}

# Try same username again
curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" -d '{
  "username": "testuser123",
  "email": "test2@example.com",
  "password": "SecurePass123!"
}'

# Expected:
# {"error":"Username already taken","suggestions":["testuser12342","testuser123_2025","testuser123_official"]}
```

---

## Step 7: Monitor Metrics

### Prometheus Queries

Visit http://localhost:9090/graph and try these queries:

```promql
# Active WebSocket connections across all servers
sum(ws_active_connections)

# Message latency p95
histogram_quantile(0.95, rate(ws_message_latency_ms_bucket[5m]))

# Redis operation latency
histogram_quantile(0.95, rate(redis_operation_latency_ms_bucket[5m]))

# Connection errors
rate(ws_connection_errors_total[5m])

# Room sizes
sum by (spaceId) (room_user_count)
```

### View Logs

```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ws1

# Last 100 lines
docker-compose logs --tail=100 ws1

# Follow errors only
docker-compose logs -f ws1 2>&1 | Select-String "ERROR"
```

---

## Common Commands

### Start/Stop Services

```powershell
# Start all
docker-compose up -d

# Stop all
docker-compose down

# Stop and remove volumes (CAUTION: deletes all data)
docker-compose down -v

# Restart specific service
docker-compose restart ws1

# Rebuild and restart
docker-compose up -d --build ws1
```

### Debug

```powershell
# Enter Redis CLI
docker exec -it metaverse-redis redis-cli

# Enter PostgreSQL
docker exec -it metaverse-postgres psql -U metaverse

# View Redis keys
docker exec -it metaverse-redis redis-cli KEYS '*'

# Monitor Redis commands in real-time
docker exec -it metaverse-redis redis-cli MONITOR

# Check Bloom filter stats
docker exec -it metaverse-redis redis-cli BITCOUNT usernames:bloom
```

### Performance Testing

```powershell
# Load test with k6 (install from https://k6.io/)
cd tests
k6 run load-test.js

# Expected output:
# checks.........................: 100.00% ✓ 2000 connections
# iteration_duration.............: avg=1.2s
# http_req_duration..............: avg=50ms p(95)=100ms
```

---

## Troubleshooting

### Issue: "Cannot connect to Docker daemon"
**Solution**: Start Docker Desktop

### Issue: "Port already in use"
**Solution**: 
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
```

### Issue: "Redis connection refused"
**Solution**:
```powershell
# Check Redis health
docker-compose ps redis

# Restart Redis
docker-compose restart redis

# Check logs
docker-compose logs redis
```

### Issue: "Database migration failed"
**Solution**:
```powershell
# Reset database (CAUTION: deletes all data)
cd metaverse/packages/db
pnpm prisma migrate reset

# Rerun migrations
pnpm prisma migrate deploy
```

### Issue: "WebSocket won't connect"
**Solution**:
```powershell
# Check Nginx logs
docker-compose logs nginx

# Test backend directly (bypass load balancer)
wscat -c ws://localhost:3001/

# Check firewall
# Windows Defender Firewall > Allow an app > Docker Desktop
```

---

## Next Steps

✅ System is running! Now you can:

1. **Fix Bugs**: Follow `docs/BUG_FIXING_ROADMAP.md`
2. **Load Test**: Run `k6 run tests/load-test.js`
3. **Monitor**: Set up Grafana alerts
4. **Deploy**: Follow `docs/DEPLOYMENT_GUIDE.md` (coming soon)

---

## Architecture at a Glance

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ ws://localhost
       ▼
┌─────────────┐
│   Nginx LB  │ (Port 80, no sticky sessions)
└──────┬──────┘
       │ least_conn routing
       ├──────┬──────┬──────┐
       ▼      ▼      ▼      │
    [WS1]  [WS2]  [WS3]     │ (3 servers, 500 users each)
       │      │      │       │
       └──────┴──────┴───────┘
              │
              ▼
       ┌─────────────┐
       │    Redis    │ (Shared state, Pub/Sub, Bloom filter)
       └─────────────┘
              │
              ▼
       ┌─────────────┐
       │  PostgreSQL │ (Persistent storage)
       └─────────────┘
```

**Key Features**:
- ✅ **No sticky sessions** - Connection registry in Redis
- ✅ **Horizontal scaling** - 3 WebSocket servers (can add more)
- ✅ **Instant username checks** - Bloom filter (1ms vs 10ms DB query)
- ✅ **Load balancing** - Nginx `least_conn` algorithm
- ✅ **Health checks** - All services monitored
- ✅ **Metrics** - Prometheus + Grafana dashboards
- ✅ **Auto-recovery** - Services restart on failure

---

## Need Help?

- **Bugs**: See `docs/bugs/README.md`
- **System Design**: See `docs/SYSTEM_DESIGN_2000_USERS.md`
- **Critical Fixes**: See `docs/CRITICAL_IMPROVEMENTS.md`
- **Roadmap**: See `docs/BUG_FIXING_ROADMAP.md`

**Ready to fix bugs!** 🚀
