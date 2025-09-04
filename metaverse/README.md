# 🌐 Metaverse Platform

A comprehensive real-time metaverse platform built with modern web technologies, featuring spatial chat, WebRTC communication, and scalable microservices architecture.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   HTTP API      │    │   WebSocket     │
│   (React      ) │◄──►│   Service       │◄──►│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Redis Cache   │    │   Kafka Queue   │
│   Database      │    │   & PubSub      │    │   & Analytics   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────┐
                    │   Kafka         │
                    │   Consumer      │
                    │   Service       │
                    └─────────────────┘
```

## 🚀 Features

### Core Platform
- **🏢 Virtual Spaces**: Create and manage 2D virtual environments
- **👥 User Management**: Authentication, avatars, and profiles
- **🎮 Real-time Movement**: Grid-based movement system with collision detection
- **💬 Spatial Chat**: Location-aware chat with multiple chatrooms per space

### Communication
- **📡 WebSocket Integration**: Real-time bidirectional communication
- **🎥 WebRTC Support**: Voice and video calling capabilities
- **📱 Media Services**: File upload and media management
- **🔄 Event-Driven Architecture**: Kafka-based message queuing

### Infrastructure
- **📊 Analytics**: Real-time user activity and chat analytics
- **🔒 Security**: JWT authentication, SSL/TLS encryption
- **⚡ Performance**: Redis caching, connection pooling
- **🐳 Containerization**: Docker support for easy deployment

## 📁 Project Structure

```
metaverse/
├── apps/                          # Microservices
│   ├── http/                      # REST API service
│   │   ├── src/
│   │   │   ├── routes/v1/         # API endpoints
│   │   │   │   ├── chatroom.ts    # Chat management
│   │   │   │   ├── space.ts       # Virtual spaces
│   │   │   │   ├── user.ts        # User management
│   │   │   │   └── chats_route/   # Chat controllers
│   │   │   ├── middleware/        # Auth & validation
│   │   │   ├── services/          # Business logic
│   │   │   └── types/             # TypeScript definitions
│   │   └── package.json
│   │
│   ├── ws/                        # WebSocket service
│   │   ├── src/
│   │   │   ├── User.ts            # User connection handling
│   │   │   ├── Roommanager.ts     # Space management
│   │   │   ├── KafkaChatService.ts # Chat messaging
│   │   │   ├── RedisService.ts    # Real-time pub/sub
│   │   │   └── types.ts           # WebSocket types
│   │   └── package.json
│   │
│   ├── kafka-service/             # Message processing
│   │   ├── src/index.ts           # Kafka consumer
│   │   └── package.json
│   │
│   ├── media-service/             # File & media handling
│   └── signaling-service/         # WebRTC signaling
│
├── packages/                      # Shared libraries
│   ├── db/                        # Database schema & client
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Database models
│   │   │   └── migrations/        # DB migrations
│   │   └── package.json
│   │
│   ├── shared-types/              # Common TypeScript types
│   ├── kafka-client/              # Kafka utilities
│   ├── redis-client/              # Redis utilities
│   ├── webrtc-client/             # WebRTC utilities
│   └── ui/                        # Shared UI components
│
├── tests/                         # Test suites
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
│
├── docker-compose.prod.yml        # Production deployment
├── start-platform.bat             # Windows startup script
├── start-production.sh            # Linux startup script
└── package.json                   # Root package configuration
```

## 🛠️ Technology Stack

### Backend Services
- **Node.js** + **TypeScript** - Runtime and language
- **Express.js** - HTTP API framework
- **WebSocket (ws)** - Real-time communication
- **Prisma** - Database ORM and migrations
- **PostgreSQL** - Primary database
- **Redis** - Caching and pub/sub
- **Kafka** - Message queuing and analytics

### Infrastructure
- **Turborepo** - Monorepo build system
- **pnpm** - Package manager
- **Docker** - Containerization
- **Aiven Cloud** - Managed Kafka service
- **JWT** - Authentication tokens

### Development Tools
- **ESLint** + **Prettier** - Code quality
- **Jest** - Testing framework
- **TypeScript** - Type safety
- **Turbo** - Build optimization

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18
- **pnpm** >= 9.0.0
- **PostgreSQL** database
- **Redis** server
- **Kafka** cluster (or Aiven Cloud account)

### 1. Clone and Install
```bash
git clone <repository-url>
cd metaverse
pnpm install
```

### 2. Environment Setup
```bash
# Copy environment templates
cp apps/http/.env.example apps/http/.env
cp apps/ws/.env.example apps/ws/.env
cp apps/kafka-service/.env.example apps/kafka-service/.env

# Configure your environment variables
# - Database URLs
# - Kafka credentials
# - Redis connection
# - JWT secrets
```

### 3. Database Setup
```bash
cd packages/db
pnpm prisma migrate dev
pnpm prisma generate
```

### 4. Start Development Services

#### Option A: All Services (Recommended)
```bash
# Windows
start-platform.bat

# Linux/Mac
chmod +x start-dev.sh
./start-dev.sh
```

#### Option B: Individual Services
```bash
# Terminal 1: HTTP API
cd apps/http
pnpm dev

# Terminal 2: WebSocket Service
cd apps/ws
pnpm dev

# Terminal 3: Kafka Consumer
cd apps/kafka-service
pnpm dev
```

### 5. Verify Setup
- **HTTP API**: http://localhost:3000
- **WebSocket**: ws://localhost:3001
- **Health Check**: http://localhost:3002

## 📡 API Documentation

### Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt-token>
```

### Core Endpoints

#### User Management
```http
POST /api/v1/signup          # Create account
POST /api/v1/signin          # Login
GET  /api/v1/user/metadata   # Get user profile
POST /api/v1/user/metadata   # Update profile
```

#### Space Management
```http
GET    /api/v1/spaces        # List spaces
POST   /api/v1/spaces        # Create space
GET    /api/v1/spaces/:id    # Get space details
PUT    /api/v1/spaces/:id    # Update space
DELETE /api/v1/spaces/:id    # Delete space
```

#### Chat System
```http
GET    /api/v1/chatroom/space/:id     # Get chatrooms in space
POST   /api/v1/chatroom/create        # Create chatroom
POST   /api/v1/chatroom/join/:id      # Join chatroom
GET    /api/v1/chatroom/:id/messages  # Get chat history
POST   /api/v1/chatroom/:id/send      # Send message (HTTP)
```

### WebSocket Events

#### Connection & Movement
```javascript
// Join space
ws.send(JSON.stringify({
  type: 'join',
  payload: { spaceId: 'space-id', token: 'jwt-token' }
}))

// Move user
ws.send(JSON.stringify({
  type: 'move',
  payload: { x: 5, y: 3 }
}))
```

#### Chat System
```javascript
// Join chatroom
ws.send(JSON.stringify({
  type: 'chat-join',
  payload: { chatroomId: 'room-id' }
}))

// Send message
ws.send(JSON.stringify({
  type: 'chat-message',
  payload: { 
    chatroomId: 'room-id', 
    content: 'Hello world!',
    type: 'text'
  }
}))

// Leave chatroom
ws.send(JSON.stringify({
  type: 'chat-leave',
  payload: { chatroomId: 'room-id' }
}))
```

## 🗄️ Database Schema

### Core Models
- **User** - User accounts and profiles
- **Space** - Virtual environments
- **SpaceMember** - Space membership tracking
- **Avatar** - User avatar configurations
- **Element** - Interactive space objects
- **Map** - Predefined space templates

### Chat Models
- **Chatroom** - Chat room configurations
- **ChatroomMember** - Room membership with roles
- **Message** - Chat messages with metadata

### Key Relationships
```sql
User 1:N Space (creator)
User N:M Space (members via SpaceMember)
Space 1:N Chatroom
User N:M Chatroom (members via ChatroomMember)
User 1:N Message
Chatroom 1:N Message
```

## 🔧 Configuration

### Environment Variables

#### HTTP Service (.env)
```env
PORT=3000
DATABASE_URL="postgresql://user:pass@localhost:5432/metaverse"
JWT_SECRET="your-jwt-secret"
REDIS_URL="redis://localhost:6379"
```

#### WebSocket Service (.env)
```env
WS_PORT=3001
DATABASE_URL="postgresql://user:pass@localhost:5432/metaverse"
JWT_SECRET="your-jwt-secret"
REDIS_URL="redis://localhost:6379"
KAFKA_BROKER="your-kafka-broker:9092"
KAFKA_USERNAME="kafka-user"
KAFKA_PASSWORD="kafka-password"
```

#### Kafka Service (.env)
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/metaverse"
KAFKA_BROKER="your-kafka-broker:9092"
KAFKA_USERNAME="kafka-user"
KAFKA_PASSWORD="kafka-password"
SERVICE_ID="kafka-consumer-service"
```

### Kafka Topics
The platform uses these Kafka topics:
- **message** - Chat messages for persistence
- **user-events** - User join/leave events
- **chat-analytics** - Chat activity analytics

## 🧪 Testing

### Run Tests
```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Test Structure
```
tests/
├── unit/                    # Service-specific tests
│   ├── chat-service.test.js
│   ├── http-service.test.js
│   └── websocket-service.test.js
├── integration/             # Cross-service tests
│   ├── chat-integration.test.js
│   └── http-websocket.test.js
└── e2e/                     # Full workflow tests
    └── backend-e2e.test.js
```

## 🚀 Deployment

### Development
```bash
pnpm dev
```

### Production Build
```bash
pnpm build
```

### Docker Deployment
```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### Production Scripts
```bash
# Windows
start-production.bat

# Linux/Mac
chmod +x start-production.sh
./start-production.sh
```

## 📊 Monitoring & Analytics

### Health Checks
- **HTTP API**: `GET /health`
- **WebSocket**: `GET :3002/health`
- **Kafka Consumer**: Built-in health monitoring

### Metrics Tracked
- **User Activity**: Connections, movements, session duration
- **Chat Analytics**: Message counts, active rooms, user engagement
- **System Performance**: Connection counts, message throughput
- **Error Tracking**: Failed connections, message delivery issues

### Logging
All services use structured logging with:
- **Timestamps** and **service identification**
- **Request/response tracking**
- **Error details** with stack traces
- **Performance metrics**

## 🔒 Security

### Authentication
- **JWT tokens** with configurable expiration
- **Password hashing** with bcrypt
- **Token refresh** mechanism

### Data Protection
- **Input validation** on all endpoints
- **SQL injection** prevention via Prisma
- **XSS protection** with sanitization
- **Rate limiting** on API endpoints

### Network Security
- **SSL/TLS** encryption for all connections
- **CORS** configuration for cross-origin requests
- **WebSocket** origin validation
- **Kafka SASL** authentication

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** Pull Request

### Code Standards
- **TypeScript** for all new code
- **ESLint** + **Prettier** for formatting
- **Jest** tests for new features
- **Conventional commits** for commit messages

### Project Structure Guidelines
- **Services** in `apps/` directory
- **Shared code** in `packages/` directory
- **Tests** in `tests/` directory
- **Documentation** in root and service directories

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues
1. **Kafka Connection Errors**: Verify broker URL and credentials
2. **Database Connection**: Check PostgreSQL service and URL
3. **WebSocket Failures**: Ensure ports 3001-3002 are available
4. **Build Errors**: Clear node_modules and reinstall dependencies

### Getting Help
- **Issues**: Create GitHub issue with detailed description
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check service-specific README files

### Useful Commands
```bash
# Reset database
pnpm prisma migrate reset

# View logs
docker-compose logs -f [service-name]

# Check service health
curl http://localhost:3000/health

# Test WebSocket connection
wscat -c ws://localhost:3001
```

---

**Built with ❤️ for the future of virtual collaboration**