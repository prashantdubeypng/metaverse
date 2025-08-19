@echo off
echo 🚀 Starting Metaverse Platform Services
echo =====================================

echo.
echo 📊 Starting database services...
cd packages\db
start "Database" cmd /k "docker-compose up"

timeout /t 5

echo.
echo 💬 Starting chat service...
cd ..\..\apps\chat-service
start "Chat Service" cmd /k "pnpm dev"

timeout /t 2

echo.
echo 🌐 Starting HTTP service...
cd ..\http
start "HTTP Service" cmd /k "pnpm dev"

timeout /t 2

echo.
echo 🔗 Starting WebSocket service...
cd ..\ws
start "WebSocket Service" cmd /k "pnpm dev"

timeout /t 2

echo.
echo 🎨 Starting frontend...
cd ..\..\frontend
start "Frontend" cmd /k "pnpm start"

echo.
echo ✅ All services starting!
echo.
echo 🎯 Access points:
echo   • Frontend: http://localhost:3000
echo   • HTTP API: http://localhost:8080
echo   • WebSocket: ws://localhost:3001
echo   • Chat Service: http://localhost:3002
echo.
echo 👑 Admin credentials:
echo   • Username: admin
echo   • Password: admin123
echo.
echo 📊 Demo spaces available:
echo   • Modern Office Space (200x200 with 53 elements)
echo   • Coworking Hub (200x200 with 68 elements)
echo.
echo Press any key to close this window...
pause > nul
