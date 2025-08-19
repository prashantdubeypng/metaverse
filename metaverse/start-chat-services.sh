#!/bin/bash

echo "Starting Metaverse Chat Services..."
echo

echo "Building all services..."
pnpm build
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo
echo "Starting services..."

# Start HTTP Service
echo "Starting HTTP Service (port 3000)..."
cd apps/http
pnpm start &
HTTP_PID=$!
cd ../..

sleep 2

# Start Chat Service
echo "Starting Chat Service (port 3002)..."
cd apps/chat-service
pnpm start &
CHAT_PID=$!
cd ../..

sleep 2

# Start Kafka Service
echo "Starting Kafka Service (port 3009)..."
cd apps/kafka-service
pnpm start &
KAFKA_PID=$!
cd ../..

echo
echo "All services started!"
echo
echo "Services running:"
echo "- HTTP Service: http://localhost:3000"
echo "- Chat Service: http://localhost:3002"
echo "- Chat Test UI: http://localhost:3002/test"
echo
echo "PIDs: HTTP=$HTTP_PID, Chat=$CHAT_PID, Kafka=$KAFKA_PID"
echo
echo "Press Ctrl+C to stop all services..."

# Wait for interrupt
trap 'echo "Stopping services..."; kill $HTTP_PID $CHAT_PID $KAFKA_PID; exit' INT
wait