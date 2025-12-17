# 🗄️ Database Setup - metaverse_db

## ✅ What Changed

Your Docker Compose configuration now:
- ✅ Automatically creates `metaverse_db` database
- ✅ Uses proper collation settings (C locale) to avoid version issues
- ✅ Includes initialization script
- ✅ Health check for `metaverse_db`

---

## 🚀 Quick Start

### Option 1: Fresh Start (Recommended)

```powershell
# Stop and remove old container
docker-compose down -v

# Start with new configuration
docker-compose up -d

# Wait for PostgreSQL to be ready
timeout /t 5

# Apply schema
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### Option 2: Keep Existing Data

```powershell
# Just restart the container
docker-compose restart postgres

# Wait for it to be ready
timeout /t 5

# Your data is preserved!
```

### Option 3: Use the Script

```powershell
.\restart-db.ps1
```

---

## 📊 Verify Database

```powershell
# Check if database exists
docker exec metaverse_postgres psql -U postgres -c "\l"

# Should show:
# metaverse_db | postgres | UTF8 | C | C | postgres
```

---

## 🔧 Configuration Details

### Environment Variables

```yaml
POSTGRES_USER: postgres
POSTGRES_PASSWORD: password
POSTGRES_DB: metaverse_db
POSTGRES_INITDB_ARGS: "--encoding=UTF8 --lc-collate=C --lc-ctype=C"
```

**Why C locale?**
- Avoids collation version mismatch errors
- Works consistently across platforms
- No version conflicts on Windows

### Initialization Script

`init-db.sh` runs on first container start:
- Creates `metaverse_db` if it doesn't exist
- Grants all privileges to postgres user
- Logs success message

---

## 🎯 Database URL

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db?schema=public"
```

---

## 📝 Using Prisma

### Apply Schema Changes

```powershell
# Push schema to database (no migration files)
npx prisma db push

# Or create migration (if collation is fixed)
npx prisma migrate dev --name your_migration_name
```

### Generate Client

```powershell
npx prisma generate
```

### View Database

```powershell
# Open Prisma Studio
npx prisma studio

# Or use psql
docker exec -it metaverse_postgres psql -U postgres -d metaverse_db
```

---

## 🐛 Troubleshooting

### Database doesn't exist

```powershell
# Create manually
docker exec metaverse_postgres psql -U postgres -c "CREATE DATABASE metaverse_db;"
```

### Can't connect

```powershell
# Check if container is running
docker ps | findstr metaverse_postgres

# Check logs
docker logs metaverse_postgres

# Restart container
docker-compose restart postgres
```

### Collation errors

The new configuration uses C locale which avoids collation issues. If you still get errors:

```powershell
# Recreate with new settings
docker-compose down -v
docker-compose up -d
```

---

## 📚 Files

- `docker-compose.yml` - PostgreSQL configuration
- `init-db.sh` - Database initialization script
- `restart-db.ps1` - Helper script to restart with new config
- `prisma/.env` - Database connection URL

---

## ✅ Success Checklist

- [ ] PostgreSQL container running
- [ ] `metaverse_db` database exists
- [ ] Can connect: `psql -U postgres -d metaverse_db`
- [ ] Schema applied: `npx prisma db push`
- [ ] Client generated: `npx prisma generate`
- [ ] Tables exist: Check with `\dt` in psql

---

## 🎉 You're Ready!

Your database is now properly configured and ready to use!

**Connection String:**
```
postgresql://postgres:password@localhost:5432/metaverse_db
```

**Next Steps:**
1. Apply schema: `npx prisma db push`
2. Start your app: `cd ../../apps/http && npm run dev`
