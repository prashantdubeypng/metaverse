# Bug Fixes Session - December 2, 2025

This document summarizes all bug fixes and changes made during the debugging session.

## Summary of Issues Resolved

### 1. Monorepo Build Errors

#### 1.1 `apps/http` - Logger Configuration ESM Issue
**File:** `apps/http/src/config/logger.config.ts`
**Problem:** The code used `import.meta.url` for ESM module resolution which caused TypeScript compilation errors.
**Solution:** Simplified the logger configuration to use `pino-pretty` directly in development mode without relying on `import.meta.url`.

#### 1.2 `apps/http` - JWT Sign Type Mismatch
**File:** `apps/http/src/utils/tokens.ts`
**Problem:** `jwt.sign()` was receiving a `StringValue` type from the `ms` package but expected `string | number | undefined`.
**Solution:** Added `@types/ms` as a dev dependency and ensured proper type handling.

#### 1.3 `apps/http` - Email Template Type Missing
**File:** `apps/http/src/templates/emailTemplates.ts`  
**Problem:** The `getEmailTemplate` function's type signature didn't include 'welcome' as a valid template type.
**Solution:** Added 'welcome' to the EmailTemplateName union type.

#### 1.4 `packages/redis-client` - Missing tsconfig Extend
**File:** `packages/redis-client/tsconfig.json`
**Problem:** The tsconfig was trying to extend a non-existent base configuration.
**Solution:** Updated to a standalone configuration with all necessary compiler options.

#### 1.5 `packages/redis-client` - BloomFilter Crypto Import
**File:** `packages/redis-client/src/BloomFilter.ts`
**Problem:** Crypto import was failing in Node.js environment.
**Solution:** Updated to use `import { createHash } from 'crypto'` which is the standard Node.js approach.

#### 1.6 TypeScript Deprecation Warnings
**Files:** `apps/ws/tsconfig.json`, `apps/http/tsconfig.json`
**Problem:** TypeScript 5.x deprecation warnings.
**Solution:** Added `"ignoreDeprecations": "5.0"` to suppress warnings.

### 2. HTTP Backend Startup Issues

#### 2.1 Rotating File Stream Import
**File:** `apps/http/src/config/logger.config.ts`
**Problem:** `rotating-file-stream` ESM/CommonJS compatibility issues.
**Solution:** Simplified to use `pino-pretty` only for development, avoiding file stream complexity.

#### 2.2 Redis Connection Crash
**File:** `apps/http/src/services/redis.ts`
**Problem:** Redis connection failures caused the HTTP server to crash on startup.
**Solution:** Made Redis connection lazy-loaded and graceful with proper error handling.

#### 2.3 Database Credentials Mismatch
**File:** `packages/db/prisma/.env`
**Problem:** Database credentials didn't match the Docker PostgreSQL container.
**Solution:** Updated to `postgresql://postgres:postgres@localhost:5432/metaverse?schema=public`.

### 3. Authentication Flow Fixes

#### 3.1 Login Response Format
**File:** `frontend/src/app/login/page.tsx`
**Problem:** Frontend was looking for `data.token` but backend returns `data.accessToken`.
**Solution:** Updated frontend to use `data.accessToken` and `data.user`.

#### 3.2 Signup Email Uniqueness
**File:** `apps/http/src/services/authService.ts`
**Problem:** Email uniqueness constraint was causing 500 errors instead of proper 409 responses.
**Solution:** Added explicit email uniqueness check before user creation with proper error handling.

### 4. WebSocket Authentication Failure

#### 4.1 Database Credentials for WebSocket Server
**Files:** 
- `apps/ws/.env`
- `apps/http/.env`

**Problem:** WebSocket server was using wrong database credentials (`password` instead of `postgres`).
**Root Cause:** The `.env` files had:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db?schema=public"
```
But the Docker PostgreSQL container was configured with:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/metaverse?schema=public"
```

**Solution:** Updated both `.env` files to use correct credentials:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/metaverse?schema=public"
```

#### 4.2 Prisma Client Regeneration
**Problem:** Even after fixing `.env`, the Prisma client still used old credentials.
**Solution:** Ran `npx prisma generate` in `packages/db` to regenerate the client with correct connection string.

#### 4.3 Improved Error Messages
**File:** `apps/ws/src/User.ts`
**Problem:** Generic "Authentication failed" error message made debugging difficult.
**Solution:** Added detailed error logging including error name, message, and stack trace.

## Environment Configuration

### Docker Services Required
1. **PostgreSQL**: `docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`
2. **Redis**: `docker run -d --name redis -p 6379:6379 redis:alpine`

### Database Setup
```bash
cd packages/db
npx prisma generate
npx prisma db push
```

### Running Services
1. **HTTP Backend**: `cd apps/http && pnpm run dev` (port 8000)
2. **WebSocket Server**: `cd apps/ws && pnpm run dev` (port 3001)
3. **Frontend**: `cd frontend && pnpm run dev` (port 3000)

## Files Modified

### Configuration Files
- `packages/db/prisma/.env` - Database credentials
- `apps/ws/.env` - WebSocket server environment
- `apps/http/.env` - HTTP server environment
- `packages/redis-client/tsconfig.json` - TypeScript config
- `apps/ws/tsconfig.json` - Added ignoreDeprecations
- `apps/http/tsconfig.json` - Added ignoreDeprecations

### Source Code
- `apps/http/src/config/logger.config.ts` - Simplified logger
- `apps/http/src/services/redis.ts` - Lazy Redis connection
- `apps/http/src/services/authService.ts` - Email uniqueness check
- `apps/http/src/utils/tokens.ts` - Type fixes
- `apps/http/src/templates/emailTemplates.ts` - Added welcome type
- `packages/redis-client/src/BloomFilter.ts` - Crypto import fix
- `frontend/src/app/login/page.tsx` - Token format fix
- `apps/ws/src/User.ts` - Improved error logging

## Testing Checklist

- [x] Monorepo builds successfully
- [x] Frontend builds successfully  
- [x] HTTP backend starts and connects to database
- [x] HTTP backend connects to Redis
- [x] Login endpoint returns proper tokens
- [x] Signup handles email uniqueness
- [ ] WebSocket server connects to database
- [ ] User can join space via WebSocket
- [ ] User position updates work
- [ ] Chat messaging works

## Known Limitations

1. **Kafka**: Not connected (cloud service unavailable). Chat persistence is disabled.
2. **Redis**: Required for WebSocket server functionality.
3. **PostgreSQL**: Must be running with correct credentials.

## Next Steps

1. Verify WebSocket connection with frontend
2. Test space joining and movement
3. Test chat functionality
4. Document remaining bugs to fix
