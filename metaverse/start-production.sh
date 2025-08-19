#!/bin/bash
# Production startup script for the metaverse application

set -e

echo "🚀 Starting Metaverse Application - Production Mode"

# Check if environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET environment variable is not set"
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    echo "❌ REDIS_URL environment variable is not set"
    exit 1
fi

echo "✅ Environment variables validated"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile --prod

# Build all packages
echo "🔨 Building packages..."
pnpm build

# Run database migrations
echo "🗃️ Running database migrations..."
cd packages/db
pnpm prisma migrate deploy
pnpm prisma generate
cd ../..

echo "✅ Database setup complete"

# Start services in the background
echo "🌐 Starting HTTP service..."
cd apps/http && pnpm start &
HTTP_PID=$!

echo "💬 Starting Chat service..."
cd ../chat-service && pnpm start &
CHAT_PID=$!

echo "🔌 Starting WebSocket service..."
cd ../ws && pnpm start &
WS_PID=$!

echo "🎨 Starting Frontend..."
cd ../../frontend && pnpm build && serve -s build -l 3000 &
FRONTEND_PID=$!

cd ..

echo "✅ All services started successfully!"
echo "📋 Service PIDs:"
echo "   HTTP Service: $HTTP_PID"
echo "   Chat Service: $CHAT_PID"
echo "   WebSocket Service: $WS_PID" 
echo "   Frontend: $FRONTEND_PID"

echo "🌍 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:3001/health"
echo "   WebSocket: ws://localhost:3002"
echo "   Chat: ws://localhost:3003"

# Create a cleanup function
cleanup() {
    echo "🛑 Shutting down services..."
    kill $HTTP_PID $CHAT_PID $WS_PID $FRONTEND_PID 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for any service to exit
wait
