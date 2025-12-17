# 🔧 Fix Prisma Migration Error (P3014)

## Error Description

```
Error: P3014
Prisma Migrate could not create the shadow database.
Original error: ERROR: template database "template1" has a collation version
```

This happens when PostgreSQL's template database has collation version issues.

---

## ✅ Solution (Choose One)

### Option 1: Fix PostgreSQL Collation (Recommended)

**Step 1: Connect to PostgreSQL**

```bash
# Using Docker
docker-compose exec postgres psql -U postgres

# Or locally
psql -U postgres
```

**Step 2: Run Fix Commands**

```sql
-- Fix template1 collation
ALTER DATABASE template1 REFRESH COLLATION VERSION;

-- Create shadow database
DROP DATABASE IF EXISTS metaverse_shadow;
CREATE DATABASE metaverse_shadow;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE metaverse_shadow TO postgres;

-- Exit
\q
```

**Step 3: Run Migration**

```bash
npx prisma migrate dev --name add-auth-security
```

---

### Option 2: Use Existing Shadow Database

**Step 1: Create Shadow Database Manually**

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres

# Create database
CREATE DATABASE metaverse_shadow;
GRANT ALL PRIVILEGES ON DATABASE metaverse_shadow TO postgres;
\q
```

**Step 2: Update .env**

Already done! Your `.env` now has:
```env
SHADOW_DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_shadow?schema=public"
```

**Step 3: Run Migration**

```bash
npx prisma migrate dev --name add-auth-security
```

---

### Option 3: Disable Shadow Database (Quick but not recommended)

**Step 1: Use migrate deploy instead**

```bash
# Push schema without shadow database
npx prisma db push

# Or use migrate deploy (production mode)
npx prisma migrate deploy
```

**Note:** This skips some safety checks but works for development.

---

## 🚀 Quick Fix Script

Run this PowerShell script:

```powershell
# Fix PostgreSQL and run migration
docker-compose exec -T postgres psql -U postgres -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;"
docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS metaverse_shadow;"
docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE metaverse_shadow;"
docker-compose exec -T postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE metaverse_shadow TO postgres;"

# Now run migration
npx prisma migrate dev --name add-auth-security
```

---

## 🐛 If Still Not Working

### Check 1: PostgreSQL is Running

```bash
docker-compose ps
# Should show postgres as "Up"
```

### Check 2: Can Connect to Database

```bash
docker-compose exec postgres psql -U postgres -c "SELECT version();"
```

### Check 3: Database Exists

```bash
docker-compose exec postgres psql -U postgres -c "\l"
# Should list metaverse_db
```

### Check 4: Permissions

```bash
docker-compose exec postgres psql -U postgres -c "SELECT datname FROM pg_database WHERE datistemplate = false;"
```

---

## 🔄 Alternative: Reset Everything

If nothing works, reset and start fresh:

```bash
# Stop services
docker-compose down -v

# Start fresh
docker-compose up -d

# Wait for PostgreSQL to be ready
timeout /t 5

# Create databases
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE metaverse_db;"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE metaverse_shadow;"

# Run migration
npx prisma migrate dev --name init
```

---

## ✅ Verify It Works

```bash
# Check migration status
npx prisma migrate status

# Generate Prisma client
npx prisma generate

# Test connection
npx prisma db pull
```

---

## 📝 What Changed

1. **schema.prisma** - Added `shadowDatabaseUrl`
2. **prisma/.env** - Added `SHADOW_DATABASE_URL`
3. **PostgreSQL** - Fixed collation version
4. **Shadow DB** - Created `metaverse_shadow` database

---

## 🎯 Next Steps

After migration succeeds:

```bash
# Generate Prisma client
npx prisma generate

# Start your app
cd ../../apps/http
npm run dev
```

---

## 📚 Additional Resources

- [Prisma Shadow Database Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate/shadow-database)
- [PostgreSQL Collation Docs](https://www.postgresql.org/docs/current/collation.html)
- [Prisma Migration Troubleshooting](https://www.prisma.io/docs/guides/database/troubleshooting-orm)

---

## 🎉 Success!

Once migration completes, you'll see:
```
✔ Generated Prisma Client
✔ The migration has been applied successfully
```

Your database is now ready with all security fields! 🚀
