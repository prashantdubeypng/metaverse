# 🐳 Docker Setup Guide

Complete Docker setup for PostgreSQL and Redis with optional GUI tools.

---

## 📋 Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (included with Docker Desktop)

---

## 🚀 Quick Start

### Option 1: Basic Setup (PostgreSQL + Redis only)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 2: Development Setup (with GUI tools)

```bash
# Start all services including pgAdmin and Redis Commander
docker-compose -f docker-compose.dev.yml up -d

# Check status
docker-compose -f docker-compose.dev.yml ps
```

### Option 3: Production Setup (with password protection)

```bash
# Start with production config
docker-compose -f docker-compose.yml up -d

# Redis will require password: redispassword
```

---

## 📦 Services Included

### Core Services (Always Running)

| Service | Port | Description |
|---------|------|-------------|
| **PostgreSQL** | 5432 | Main database |
| **Redis** | 6379 | Cache, queue, rate limiting |

### Optional Tools (Development Only)

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| **pgAdmin** | 5050 | http://localhost:5050 | admin@metaverse.com / admin |
| **Redis Commander** | 8081 | http://localhost:8081 | - |

---

## 🔧 Configuration

### PostgreSQL

**Connection String:**
```
postgresql://postgres:password@localhost:5432/metaverse_db
```

**Environment Variables:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db"
```

### Redis

**Development (no password):**
```
redis://localhost:6379
```

**Production (with password):**
```
redis://:redispassword@localhost:6379
```

**Environment Variables:**
```env
# Development
REDIS_URL="redis://localhost:6379"

# Production
REDIS_URL="redis://:redispassword@localhost:6379"
```

---

## 📝 Common Commands

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres
docker-compose up -d redis

# Start with logs
docker-compose up
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Stop specific service
docker-compose stop postgres
docker-compose stop redis
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100 redis
```

### Check Status

```bash
# List running containers
docker-compose ps

# Check health
docker-compose ps --format json | jq
```

### Execute Commands

```bash
# PostgreSQL
docker-compose exec postgres psql -U postgres -d metaverse_db

# Redis CLI
docker-compose exec redis redis-cli

# Redis CLI with password (production)
docker-compose exec redis redis-cli -a redispassword
```

---

## 🗄️ Database Management

### Initialize Database

```bash
# Run Prisma migrations
cd packages/db
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database (if you have seed script)
npx prisma db seed
```

### Backup Database

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U postgres metaverse_db > backup.sql

# Restore PostgreSQL
docker-compose exec -T postgres psql -U postgres metaverse_db < backup.sql
```

### Reset Database

```bash
# Stop services
docker-compose down

# Remove volumes (⚠️ deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d

# Run migrations
cd packages/db
npx prisma migrate dev
```

---

## 🔍 Monitoring & Debugging

### Check Container Health

```bash
# Health status
docker-compose ps

# Detailed inspect
docker inspect metaverse_postgres
docker inspect metaverse_redis
```

### View Resource Usage

```bash
# CPU and memory usage
docker stats metaverse_postgres metaverse_redis

# Disk usage
docker system df
```

### Access Container Shell

```bash
# PostgreSQL container
docker-compose exec postgres sh

# Redis container
docker-compose exec redis sh
```

---

## 🛠️ Troubleshooting

### Port Already in Use

**Problem:** Port 5432 or 6379 already in use

**Solution:**
```bash
# Find process using port
# Windows
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# Linux/Mac
lsof -i :5432
lsof -i :6379

# Kill process or change port in docker-compose.yml
ports:
  - "5433:5432"  # Use different host port
```

### Container Won't Start

**Problem:** Container exits immediately

**Solution:**
```bash
# Check logs
docker-compose logs postgres
docker-compose logs redis

# Remove and recreate
docker-compose down -v
docker-compose up -d
```

### Connection Refused

**Problem:** Can't connect to PostgreSQL or Redis

**Solution:**
```bash
# Check if containers are running
docker-compose ps

# Check if ports are exposed
docker-compose port postgres 5432
docker-compose port redis 6379

# Test connection
# PostgreSQL
docker-compose exec postgres pg_isready -U postgres

# Redis
docker-compose exec redis redis-cli ping
```

### Out of Disk Space

**Problem:** Docker volumes taking too much space

**Solution:**
```bash
# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a

# Remove specific volumes
docker volume rm metaverse_postgres_data
docker volume rm metaverse_redis_data
```

---

## 🔐 Security Best Practices

### Production Deployment

1. **Change Default Passwords:**
```yaml
environment:
  POSTGRES_PASSWORD: <strong-password>
  # Redis
command: redis-server --requirepass <strong-password>
```

2. **Use Environment Variables:**
```bash
# Create .env file
POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-secure-password

# Reference in docker-compose.yml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

3. **Restrict Network Access:**
```yaml
# Only expose to localhost
ports:
  - "127.0.0.1:5432:5432"
  - "127.0.0.1:6379:6379"
```

4. **Enable SSL/TLS:**
```yaml
# PostgreSQL with SSL
command: postgres -c ssl=on -c ssl_cert_file=/etc/ssl/certs/server.crt
```

---

## 📊 Performance Tuning

### PostgreSQL

```yaml
# Add to command
command: >
  postgres
  -c shared_buffers=256MB
  -c max_connections=200
  -c effective_cache_size=1GB
```

### Redis

```yaml
# Add to command
command: >
  redis-server
  --maxmemory 512mb
  --maxmemory-policy allkeys-lru
  --appendonly yes
```

---

## 🎯 Environment-Specific Configs

### Development

```bash
# Use dev config (no passwords, with GUI tools)
docker-compose -f docker-compose.dev.yml up -d
```

### Production

```bash
# Use production config (with passwords, no GUI tools)
docker-compose -f docker-compose.yml up -d
```

### Testing

```bash
# Use separate test database
docker-compose -f docker-compose.test.yml up -d
```

---

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [pgAdmin Documentation](https://www.pgadmin.org/docs/)
- [Redis Commander](https://github.com/joeferner/redis-commander)

---

## ✅ Quick Checklist

- [ ] Docker and Docker Compose installed
- [ ] Ports 5432 and 6379 available
- [ ] `.env` file configured
- [ ] Services started: `docker-compose up -d`
- [ ] Health check passed: `docker-compose ps`
- [ ] Database migrated: `npx prisma migrate dev`
- [ ] Connection tested from application

---

## 🎉 You're Ready!

Your PostgreSQL and Redis services are now running. Update your `.env` file:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db"
REDIS_URL="redis://localhost:6379"
```

Then start your application:

```bash
cd apps/http
npm run dev
```

**Happy coding! 🚀**
