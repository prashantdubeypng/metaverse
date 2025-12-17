# 🐳 Docker Quick Start - PostgreSQL + Redis

## ✅ What's Included

Your Docker setup now includes:
- ✅ **PostgreSQL 15** - Main database
- ✅ **Redis 7** - Cache, queue, rate limiting
- ✅ **pgAdmin** (optional) - PostgreSQL GUI
- ✅ **Redis Commander** (optional) - Redis GUI

---

## 🚀 Quick Start (3 Steps)

### Step 1: Start Services

**Windows:**
```bash
# Double-click or run:
start-services.bat
```

**Linux/Mac:**
```bash
# Make executable (first time only)
chmod +x start-services.sh

# Run
./start-services.sh
```

**Or manually:**
```bash
docker-compose up -d
```

### Step 2: Update .env File

```env
# Add to apps/http/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db"
REDIS_URL="redis://localhost:6379"
```

### Step 3: Run Migrations

```bash
cd packages/db
npx prisma migrate dev --name init
npx prisma generate
```

---

## 🎯 Verify Everything Works

### Test PostgreSQL

```bash
# Check if running
docker-compose ps

# Connect to database
docker-compose exec postgres psql -U postgres -d metaverse_db

# Inside psql:
\dt  # List tables
\q   # Quit
```

### Test Redis

```bash
# Check if running
docker-compose exec redis redis-cli ping
# Should return: PONG

# Test set/get
docker-compose exec redis redis-cli
> SET test "Hello Redis"
> GET test
> EXIT
```

---

## 📊 Access GUI Tools (Optional)

### pgAdmin (PostgreSQL GUI)

1. Start with GUI tools:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. Open: http://localhost:5050
3. Login:
   - Email: `admin@metaverse.com`
   - Password: `admin`

4. Add server:
   - Name: `Metaverse DB`
   - Host: `postgres` (or `host.docker.internal` on Windows/Mac)
   - Port: `5432`
   - Username: `postgres`
   - Password: `password`

### Redis Commander (Redis GUI)

1. Open: http://localhost:8081
2. No login required
3. View keys, values, and monitor Redis

---

## 🛠️ Common Commands

### Start/Stop

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Stop and delete data (⚠️ WARNING)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Check Status

```bash
# List containers
docker-compose ps

# Check health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## 🔧 Configuration Files

### docker-compose.yml (Production)
- PostgreSQL with password
- Redis with password
- No GUI tools
- Persistent volumes

### docker-compose.dev.yml (Development)
- PostgreSQL without password
- Redis without password
- Includes pgAdmin and Redis Commander
- Persistent volumes

### packages/db/docker-compose.yml (Simple)
- Just PostgreSQL and Redis
- Minimal configuration
- Good for quick testing

---

## 📝 Connection Strings

### PostgreSQL

**Development:**
```
postgresql://postgres:password@localhost:5432/metaverse_db
```

**From Docker container:**
```
postgresql://postgres:password@postgres:5432/metaverse_db
```

### Redis

**Development:**
```
redis://localhost:6379
```

**Production (with password):**
```
redis://:redispassword@localhost:6379
```

**From Docker container:**
```
redis://redis:6379
```

---

## 🐛 Troubleshooting

### Port Already in Use

**Problem:** Port 5432 or 6379 already in use

**Solution:**
```bash
# Windows - Find process
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# Kill process or change port in docker-compose.yml
ports:
  - "5433:5432"  # Use different port
```

### Can't Connect to Database

**Problem:** Connection refused

**Solution:**
```bash
# Check if container is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart services
docker-compose restart postgres
```

### Redis Connection Error

**Problem:** Can't connect to Redis

**Solution:**
```bash
# Check if Redis is running
docker-compose exec redis redis-cli ping

# Check logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### Out of Disk Space

**Problem:** Docker taking too much space

**Solution:**
```bash
# Check disk usage
docker system df

# Clean up
docker system prune -a

# Remove specific volumes
docker volume ls
docker volume rm metaverse_postgres_data
```

---

## 🔐 Security Notes

### Development
- Default passwords are used
- Services exposed to localhost
- GUI tools included

### Production
- Change all default passwords
- Use environment variables
- Restrict network access
- Enable SSL/TLS
- Remove GUI tools

---

## 📚 Next Steps

1. ✅ Start Docker services
2. ✅ Update .env file
3. ✅ Run Prisma migrations
4. ✅ Start your application
5. ✅ Test authentication endpoints

---

## 🎉 You're Ready!

Your PostgreSQL and Redis are now running. Your application can now use:

- **Database** for user data, tokens, etc.
- **Redis** for rate limiting, caching, email queue

Start your app:
```bash
cd apps/http
npm run dev
```

**Happy coding! 🚀**
