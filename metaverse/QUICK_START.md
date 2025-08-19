# 🚀 Quick Start Guide

This guide will help you get the entire Metaverse application running quickly.

## Prerequisites

- Node.js 16+
- pnpm (install with `npm install -g pnpm`)
- Docker (for PostgreSQL and Redis)

## 1. Install Dependencies

```bash
# Install root dependencies
pnpm install

# Install service dependencies
cd apps/http && pnpm install && cd ../..
cd apps/chat-service && pnpm install && cd ../..
cd apps/kafka-service && pnpm install && cd ../..
cd frontend && npm install && cd ..
```

## 2. Setup Database

```bash
# Start PostgreSQL with Docker
cd packages/db
docker-compose up -d

# Generate Prisma client and run migrations
pnpm run generate
pnpm db:push
cd ../..
```

## 3. Start Services (4 terminals)

### Terminal 1: HTTP Service
```bash
cd apps/http
pnpm build
pnpm start
# Runs on http://localhost:3001
```

### Terminal 2: Chat Service
```bash
cd apps/chat-service
pnpm build
pnpm start
# Runs on http://localhost:3002
```

### Terminal 3: Kafka Service
```bash
cd apps/kafka-service
pnpm build
pnpm start
# Runs on http://localhost:3009
```

### Terminal 4: Frontend
```bash
cd frontend
npm start
# Runs on http://localhost:3000
```

## 4. Access the Application

- **Frontend**: http://localhost:3000
- **API Health**: http://localhost:3001/health
- **Chat Test UI**: http://localhost:3002/test

## 5. Test Login

Use these demo credentials:
- **Admin**: username: `admin`, password: `password123`
- **User**: username: `user`, password: `password123`

Or create a new account on the registration page.

## Environment Variables

Create `.env` files in each service if needed:

### apps/http/.env
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db"
JWT_SECRET="your-jwt-secret"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### apps/chat-service/.env
```env
CHAT_SERVICE_PORT=3002
JWT_SECRET="your-jwt-secret"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### frontend/.env
```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_CHAT_SERVICE_URL=http://localhost:3002
```

## Troubleshooting

### Port Conflicts
If ports are busy, you can change them in the respective service files:
- HTTP service: `apps/http/src/index.ts` (line with `app.listen`)
- Chat service: `apps/chat-service/src/index.ts` (PORT variable)
- Frontend: runs on 3000 by default (React dev server)

### Database Issues
```bash
# Reset database
cd packages/db
docker-compose down -v
docker-compose up -d
pnpm db:push
```

### CORS Issues
Make sure the frontend URL is correctly configured in the backend CORS settings.

### Chat Connection Issues
1. Ensure chat service is running on port 3002
2. Check that JWT token is valid
3. Verify WebSocket connection in browser dev tools

## Features to Test

1. **Authentication**: Register/Login
2. **Spaces**: Create and view spaces (Admin only)
3. **Chat**: Join spaces and use real-time chat
4. **Admin Panel**: Create elements and avatars (Admin only)

## Next Steps

- Read `FRONTEND_SETUP.md` for detailed frontend documentation
- Read `CHAT_INTEGRATION.md` for chat system details
- Check individual service README files for specific configurations

Happy coding! 🎉