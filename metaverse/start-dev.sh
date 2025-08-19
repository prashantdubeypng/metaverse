#!/bin/bash

# Metaverse Development Startup Script
echo "🚀 Starting Metaverse Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}Port $1 is already in use${NC}"
        return 1
    else
        return 0
    fi
}

# Function to start a service in the background
start_service() {
    local service_name=$1
    local service_path=$2
    local port=$3
    
    echo -e "${BLUE}Starting $service_name on port $port...${NC}"
    
    if check_port $port; then
        cd $service_path
        pnpm install > /dev/null 2>&1
        pnpm build > /dev/null 2>&1
        pnpm start &
        echo $! > "../.$service_name.pid"
        cd - > /dev/null
        echo -e "${GREEN}✓ $service_name started${NC}"
    else
        echo -e "${RED}✗ Cannot start $service_name - port $port is busy${NC}"
    fi
}

# Function to start frontend
start_frontend() {
    echo -e "${BLUE}Starting Frontend on port 3000...${NC}"
    
    if check_port 3000; then
        cd frontend
        npm install > /dev/null 2>&1
        npm start &
        echo $! > "../.frontend.pid"
        cd - > /dev/null
        echo -e "${GREEN}✓ Frontend started${NC}"
    else
        echo -e "${RED}✗ Cannot start Frontend - port 3000 is busy${NC}"
    fi
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}pnpm is not installed. Please install it first:${NC}"
    echo "npm install -g pnpm"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 16+${NC}"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${YELLOW}PostgreSQL is not running. Starting with Docker...${NC}"
    cd packages/db
    docker-compose up -d
    cd - > /dev/null
    sleep 5
fi

# Install root dependencies
echo -e "${BLUE}Installing root dependencies...${NC}"
pnpm install > /dev/null 2>&1

# Generate Prisma client
echo -e "${BLUE}Setting up database...${NC}"
cd packages/db
pnpm run generate > /dev/null 2>&1
pnpm run build > /dev/null 2>&1
cd - > /dev/null

# Start services
echo -e "\n${BLUE}Starting services...${NC}"

# Start HTTP service (port 3000 -> 3001 to avoid conflict with frontend)
start_service "http-service" "apps/http" 3001

# Start Chat service
start_service "chat-service" "apps/chat-service" 3002

# Start Kafka service
start_service "kafka-service" "apps/kafka-service" 3009

# Wait a moment for services to start
sleep 3

# Start Frontend
start_frontend

# Create stop script
cat > stop-dev.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Metaverse Development Environment..."

# Kill services by PID
for service in http-service chat-service kafka-service frontend; do
    if [ -f ".$service.pid" ]; then
        pid=$(cat ".$service.pid")
        if kill -0 $pid 2>/dev/null; then
            kill $pid
            echo "✓ Stopped $service"
        fi
        rm ".$service.pid"
    fi
done

# Kill any remaining processes on our ports
for port in 3000 3001 3002 3009; do
    pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        kill $pid 2>/dev/null
        echo "✓ Freed port $port"
    fi
done

echo "🏁 All services stopped"
EOF

chmod +x stop-dev.sh

# Display status
echo -e "\n${GREEN}🎉 Metaverse Development Environment Started!${NC}"
echo -e "\n${BLUE}Services:${NC}"
echo -e "  • HTTP API:     http://localhost:3001"
echo -e "  • Chat Service: http://localhost:3002"
echo -e "  • Kafka:        http://localhost:3009"
echo -e "  • Frontend:     http://localhost:3000"
echo -e "\n${BLUE}Useful URLs:${NC}"
echo -e "  • Application:  http://localhost:3000"
echo -e "  • API Health:   http://localhost:3001/health"
echo -e "  • Chat Health:  http://localhost:3002/health"
echo -e "  • Chat Test UI: http://localhost:3002/test"
echo -e "\n${YELLOW}To stop all services, run: ./stop-dev.sh${NC}"
echo -e "\n${BLUE}Logs are running in the background. Check individual terminals for detailed logs.${NC}"

# Keep script running to show logs
echo -e "\n${BLUE}Press Ctrl+C to stop monitoring (services will continue running)${NC}"
echo -e "${BLUE}Or run ./stop-dev.sh to stop all services${NC}\n"

# Monitor services
while true; do
    sleep 5
    
    # Check if services are still running
    services_running=0
    for service in http-service chat-service kafka-service frontend; do
        if [ -f ".$service.pid" ]; then
            pid=$(cat ".$service.pid")
            if kill -0 $pid 2>/dev/null; then
                ((services_running++))
            else
                echo -e "${RED}⚠ $service stopped unexpectedly${NC}"
                rm ".$service.pid"
            fi
        fi
    done
    
    if [ $services_running -eq 0 ]; then
        echo -e "${YELLOW}All services have stopped${NC}"
        break
    fi
done