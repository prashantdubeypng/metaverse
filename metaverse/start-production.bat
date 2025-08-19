@echo off
REM Production startup script for the metaverse application (Windows)

echo 🚀 Starting Metaverse Application - Production Mode

REM Check if environment variables are set
if not defined DATABASE_URL (
    echo ❌ DATABASE_URL environment variable is not set
    exit /b 1
)

if not defined JWT_SECRET (
    echo ❌ JWT_SECRET environment variable is not set
    exit /b 1
)

if not defined REDIS_URL (
    echo ❌ REDIS_URL environment variable is not set
    exit /b 1
)

echo ✅ Environment variables validated

REM Install dependencies
echo 📦 Installing dependencies...
call pnpm install --frozen-lockfile --prod

REM Build all packages
echo 🔨 Building packages...
call pnpm build

REM Run database migrations
echo 🗃️ Running database migrations...
cd packages\db
call pnpm prisma migrate deploy
call pnpm prisma generate
cd ..\..

echo ✅ Database setup complete

REM Start services
echo 🌐 Starting HTTP service...
start "HTTP Service" cmd /k "cd apps\http && pnpm start"

timeout /t 3 /nobreak >nul

echo 💬 Starting Chat service...
start "Chat Service" cmd /k "cd apps\chat-service && pnpm start"

timeout /t 3 /nobreak >nul

echo 🔌 Starting WebSocket service...
start "WebSocket Service" cmd /k "cd apps\ws && pnpm start"

timeout /t 3 /nobreak >nul

echo 📨 Starting Kafka service...
start "Kafka Service" cmd /k "cd apps\kafka-service && pnpm start"

timeout /t 3 /nobreak >nul

echo 🎨 Building and starting Frontend...
cd frontend
call pnpm build
start "Frontend" cmd /k "serve -s build -l 3000"
cd ..

echo ✅ All services started successfully!
echo 🌍 Application URLs:
echo    Frontend: http://localhost:3000
echo    API: http://localhost:3001/health
echo    WebSocket: ws://localhost:3002
echo    Chat: ws://localhost:3003
echo    Kafka: Internal service (no direct URL)

pause
