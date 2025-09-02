#!/bin/bash

echo "🚀 Starting Kafka Consumer Service..."
echo "📋 Building TypeScript..."

# Build the project
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    echo "🎯 Starting consumer service..."
    
    # Start the service
    npm start
else
    echo "❌ Build failed"
    exit 1
fi