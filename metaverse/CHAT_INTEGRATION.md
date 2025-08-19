# Metaverse Chat System Integration Guide

This guide explains how to integrate and use the scalable chat system in your metaverse application.

## Architecture Overview

The chat system follows a microservices architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   HTTP Service  │    │  Chat Service   │
│   (React)       │◄──►│   (REST API)    │◄──►│   (WebSocket)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │     Redis       │    │     Kafka       │
         │              │   (Caching)     │    │  (Messaging)    │
         │              └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   (Database)    │
                        └─────────────────┘
```

## Services

### 1. HTTP Service (Port 3000)
- **Purpose**: REST API for chatroom management
- **Endpoints**:
  - `POST /api/v1/chatroom/create` - Create chatroom
  - `GET /api/v1/chatroom/rooms` - Get chatrooms in space
  - `POST /api/v1/chatroom/join` - Join chatroom
  - `POST /api/v1/chatroom/leave` - Leave chatroom
  - `GET /api/v1/messages` - Get message history
  - `POST /api/v1/messages/active` - Mark user as active

### 2. Chat Service (Port 3002)
- **Purpose**: Real-time WebSocket communication
- **Events**:
  - `join-room` - Join a chatroom
  - `leave-room` - Leave a chatroom
  - `send-message` - Send a message
  - `typing` / `stop-typing` - Typing indicators

### 3. Kafka Service (Port 3009)
- **Purpose**: Message persistence and event streaming
- **Topics**:
  - `message` - Chat messages for persistence

## Setup Instructions

### 1. Install Dependencies

```bash
# Root dependencies
pnpm install

# Install service-specific dependencies
cd apps/http && pnpm install
cd ../chat-service && pnpm install
cd ../kafka-service && pnpm install
```

### 2. Environment Variables

Create `.env` files in each service:

**apps/http/.env:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db"
JWT_SECRET="your-jwt-secret"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

**apps/chat-service/.env:**
```env
CHAT_SERVICE_PORT=3002
FRONTEND_URL="http://localhost:3000"
JWT_SECRET="your-jwt-secret"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

**apps/kafka-service/.env:**
```env
KAFKA_BROKERS="localhost:9092"
DATABASE_URL="postgresql://postgres:password@localhost:5432/metaverse_db"
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
cd packages/db
docker-compose up -d

# Start Kafka (if using local Kafka)
# Or use your cloud Kafka service
```

### 4. Database Setup

```bash
cd packages/db
npx prisma generate
npx prisma db push
```

### 5. Start Services

```bash
# Terminal 1 - HTTP Service
cd apps/http
pnpm build && pnpm start

# Terminal 2 - Chat Service  
cd apps/chat-service
pnpm build && pnpm start

# Terminal 3 - Kafka Service
cd apps/kafka-service
pnpm build && pnpm start

# Terminal 4 - Frontend
cd frontend
npm start
```

## Frontend Integration

### 1. Install Socket.IO Client

```bash
cd frontend
npm install socket.io-client
```

### 2. Use Chat Service

```javascript
import { chatService, chatAPI } from './services/chatService';

// Connect to chat service
const token = localStorage.getItem('token');
chatService.connect(token);

// Create a chatroom
const chatroom = await chatAPI.createChatroom(
    spaceId, 
    'General Chat', 
    'Main discussion room'
);

// Join and start chatting
chatService.joinRoom(chatroom.chatroom.id);

// Listen for messages
chatService.onMessage((type, data) => {
    if (type === 'message') {
        console.log('New message:', data);
    }
});

// Send a message
chatService.sendMessage('Hello everyone!');
```

### 3. React Component Usage

```jsx
import ChatRoom from './components/Chat/ChatRoom';

function MetaverseSpace({ spaceId }) {
    const [selectedChatroom, setSelectedChatroom] = useState(null);
    
    return (
        <div className="metaverse-space">
            <div className="game-area">
                {/* Your 3D metaverse content */}
            </div>
            
            {selectedChatroom && (
                <div className="chat-panel">
                    <ChatRoom 
                        chatroomId={selectedChatroom}
                        onClose={() => setSelectedChatroom(null)}
                    />
                </div>
            )}
        </div>
    );
}
```

## API Reference

### REST Endpoints

#### Create Chatroom
```http
POST /api/v1/chatroom/create
Authorization: Bearer <token>
Content-Type: application/json

{
    "roomid": "space-id",
    "name": "General Chat",
    "description": "Main discussion room",
    "isPrivate": false
}
```

#### Get Chatrooms
```http
GET /api/v1/chatroom/rooms?spaceId=space-id
Authorization: Bearer <token>
```

#### Join Chatroom
```http
POST /api/v1/chatroom/join
Authorization: Bearer <token>
Content-Type: application/json

{
    "chatroomId": "chatroom-id"
}
```

### WebSocket Events

#### Client to Server
```javascript
// Join room
socket.emit('join-room', 'chatroom-id');

// Send message
socket.emit('send-message', {
    roomId: 'chatroom-id',
    message: 'Hello world!'
});

// Typing indicators
socket.emit('typing', { roomId: 'chatroom-id' });
socket.emit('stop-typing', { roomId: 'chatroom-id' });
```

#### Server to Client
```javascript
// Receive message
socket.on('receive-message', (data) => {
    console.log(data); // { id, message, userId, username, timestamp }
});

// User events
socket.on('user-joined', (data) => {
    console.log(`${data.username} joined`);
});

socket.on('user-left', (data) => {
    console.log(`${data.username} left`);
});

// Recent messages on join
socket.on('recent-messages', (data) => {
    console.log(data.messages); // Array of recent messages
});
```

## Scaling Considerations

### Horizontal Scaling

1. **Multiple Chat Service Instances**
   - Use Redis for message distribution between instances
   - Load balance WebSocket connections

2. **Database Scaling**
   - Read replicas for message history
   - Partitioning by chatroom or time

3. **Kafka Scaling**
   - Multiple partitions for message topics
   - Consumer groups for parallel processing

### Performance Optimization

1. **Message Caching**
   - Redis caches recent messages (last 100 per room)
   - Reduces database queries for active rooms

2. **Connection Management**
   - Automatic cleanup of inactive connections
   - Heartbeat monitoring

3. **Rate Limiting**
   - Message rate limits per user
   - Anti-spam measures

## Monitoring and Logging

### Health Checks
- `GET /health` on each service
- Monitor WebSocket connection counts
- Track message throughput

### Metrics to Monitor
- Active WebSocket connections
- Messages per second
- Database query performance
- Redis cache hit rates
- Kafka consumer lag

## Security Features

1. **Authentication**
   - JWT token validation on WebSocket connection
   - User verification for all operations

2. **Authorization**
   - Chatroom membership verification
   - Role-based permissions (Owner, Admin, Member)

3. **Input Validation**
   - Message length limits (2000 characters)
   - Content sanitization
   - Rate limiting

## Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**
   - Check JWT token validity
   - Verify CORS settings
   - Check network connectivity

2. **Messages Not Persisting**
   - Verify Kafka service is running
   - Check database connection
   - Monitor consumer errors

3. **High Memory Usage**
   - Check Redis memory usage
   - Monitor active WebSocket connections
   - Review message caching strategy

### Debug Commands

```bash
# Check service health
curl http://localhost:3000/health  # HTTP service
curl http://localhost:3002/health  # Chat service

# Monitor Redis
redis-cli monitor

# Check Kafka topics
kafka-topics --list --bootstrap-server localhost:9092

# Database queries
psql -d metaverse_db -c "SELECT COUNT(*) FROM \"Message\";"
```

## Future Enhancements

1. **File Sharing**
   - Image/file upload support
   - Media message types

2. **Advanced Features**
   - Message reactions/emojis
   - Message threading
   - Voice messages

3. **Moderation**
   - Automated content filtering
   - User reporting system
   - Admin moderation tools

4. **Analytics**
   - Chat activity metrics
   - User engagement tracking
   - Popular chatroom analytics

This chat system provides a solid foundation for real-time communication in your metaverse application with room for future enhancements and scaling.