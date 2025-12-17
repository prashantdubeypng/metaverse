@echo off
REM 🚀 Start Metaverse Services
REM This script starts PostgreSQL and Redis using Docker Compose

echo 🐳 Starting Metaverse Services...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start services
echo 📦 Starting PostgreSQL and Redis...
docker-compose up -d

REM Wait for services to be healthy
echo.
echo ⏳ Waiting for services to be ready...
timeout /t 5 /nobreak >nul

REM Check status
echo.
echo 📊 Service Status:
docker-compose ps

REM Show connection info
echo.
echo ✅ Services are running!
echo.
echo 📝 Connection Information:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo PostgreSQL:
echo   Host: localhost
echo   Port: 5432
echo   User: postgres
echo   Password: password
echo   Database: metaverse_db
echo   URL: postgresql://postgres:password@localhost:5432/metaverse_db
echo.
echo Redis:
echo   Host: localhost
echo   Port: 6379
echo   URL: redis://localhost:6379
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🎯 Next Steps:
echo   1. Update your .env file with the connection URLs above
echo   2. Run database migrations: cd packages\db ^&^& npx prisma migrate dev
echo   3. Start your application: cd apps\http ^&^& npm run dev
echo.
echo 📚 For more info, see DOCKER_SETUP.md
echo.
pause
