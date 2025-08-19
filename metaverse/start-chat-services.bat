@echo off
echo Starting Metaverse Chat Services...
echo.

echo Building all services...
call pnpm build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Starting services in separate windows...

echo Starting HTTP Service (port 3000)...
start "HTTP Service" cmd /k "cd apps\http && pnpm start"

timeout /t 2 /nobreak >nul

echo Starting Chat Service (port 3002)...
start "Chat Service" cmd /k "cd apps\chat-service && pnpm start"

timeout /t 2 /nobreak >nul

echo Starting Kafka Service (port 3009)...
start "Kafka Service" cmd /k "cd apps\kafka-service && pnpm start"

echo.
echo All services started!
echo.
echo Services running:
echo - HTTP Service: http://localhost:3000
echo - Chat Service: http://localhost:3002
echo - Chat Test UI: http://localhost:3002/test
echo.
echo Press any key to exit...
pause >nul