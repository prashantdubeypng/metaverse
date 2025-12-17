#!/bin/bash

# 🚀 Start Metaverse Services
# This script starts PostgreSQL and Redis using Docker Compose

echo "🐳 Starting Metaverse Services..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install Docker Compose."
    exit 1
fi

# Start services
echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check status
echo ""
echo "📊 Service Status:"
docker-compose ps

# Show connection info
echo ""
echo "✅ Services are running!"
echo ""
echo "📝 Connection Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PostgreSQL:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  User: postgres"
echo "  Password: password"
echo "  Database: metaverse_db"
echo "  URL: postgresql://postgres:password@localhost:5432/metaverse_db"
echo ""
echo "Redis:"
echo "  Host: localhost"
echo "  Port: 6379"
echo "  URL: redis://localhost:6379"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Next Steps:"
echo "  1. Update your .env file with the connection URLs above"
echo "  2. Run database migrations: cd packages/db && npx prisma migrate dev"
echo "  3. Start your application: cd apps/http && npm run dev"
echo ""
echo "📚 For more info, see DOCKER_SETUP.md"
