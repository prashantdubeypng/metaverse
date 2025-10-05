# Metaverse Platform: Real-Time Virtual Spaces & Proximity Video Communication

A robust, scalable, and feature-rich metaverse platform engineered for real-time interaction, proximity-based video calls, spatial chat, and seamless cloud-native microservice architecture.

---

## 🚀 Overview

The Metaverse platform connects users in dynamic 2D virtual environments, enabling automatic video communication triggered by spatial proximity, advanced chat systems, and granular user management—all powered by modern web technologies and distributed systems.

---

## 🌟 Feature Highlights

### 🎥 Proximity-Based Video Calling
- **Automatic video/audio calls** initiated when users are within a configurable proximity.
- **WebRTC peer-to-peer streaming** for secure, high-quality real-time communication.
- **Zero manual intervention**: calls start/end as users move in virtual space.
- **Scalable WebSocket signaling** and seamless frontend integration.

### 🏢 Virtual Environments
- Design and manage multiple grid-based 2D spaces.
- Real-time movement with collision detection and synchronized user positions.

### 💬 Spatial Chat & Messaging
- Location-aware chatrooms.
- Kafka-backed persistence and Redis-powered real-time delivery.
- Multi-room support and robust message analytics.

### 👥 User Management & Security
- JWT authentication and authorization.
- Customizable user profiles, avatars, and presence status.
- Membership, roles, and server-side proximity validation.

---

## 🏗️ System Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Frontend    │ ← │ HTTP API    │ ← │ WebSocket   │
│ (WebRTC)    │   │ Service     │   │ Service     │
└─────────────┘   └─────────────┘   └─────────────┘
        │                │                │
        │ P2P Video      ▼                ▼
        ▼          ┌─────────────┐   ┌─────────────┐
                   │ PostgreSQL  │   │ Redis Cache │
                   │ Database    │   │ & PubSub    │
                   └─────────────┘   └─────────────┘
                                      │
                                      ▼
                              ┌─────────────┐
                              │ Kafka Queue │
                              │ & Analytics │
                              └─────────────┘
                                      │
                                      ▼
                              ┌─────────────┐
                              │ Kafka       │
                              │ Consumer    │
                              │ Service     │
                              └─────────────┘
```

- **Microservices**: HTTP API, WebSocket video/call, Kafka consumer, media processing.
- **Databases**: PostgreSQL for persistence, Redis for caching and pub/sub, Kafka for event streaming and analytics.

---

## 📁 Project Structure

```
metaverse/
├── apps/            # Microservices (http, ws, kafka, media)
├── packages/        # Shared libraries (db, webrtc, types, utils)
├── tests/           # Unit, integration, e2e test suites
├── docker-compose/  # Production deployments
├── start-scripts/   # Cross-platform startup scripts
└── package.json     # Root configuration
```

---

## 🛠️ Technology Stack

- **Backend**: Node.js, TypeScript, Express.js, WebSocket (ws), Prisma ORM, PostgreSQL, Redis, Kafka.
- **Frontend**: WebRTC, React integration (see frontend repo).
- **Infrastructure**: Turborepo, pnpm, Docker, JWT, ESLint/Prettier, Jest.
- **Cloud & Scaling**: Kafka/Aiven Cloud, TURN/STUN servers, Redis clustering, load balancing.

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- pnpm >= 9.0.0
- PostgreSQL, Redis, Kafka (local or cloud-managed)

### 1. Clone & Install
```bash
git clone <repository-url>
cd metaverse
pnpm install
```

### 2. Environment Setup
```bash
cp apps/http/.env.example apps/http/.env
cp apps/ws/.env.example apps/ws/.env
cp apps/kafka-service/.env.example apps/kafka-service/.env
# Add your DB, Kafka, Redis, JWT secrets
```

### 3. Database Setup
```bash
cd packages/db
pnpm prisma migrate dev
pnpm prisma generate
```

### 4. Start Services
```bash
# API
cd apps/http && pnpm dev
# WebSocket/Video
cd apps/ws && pnpm dev
# Kafka Consumer
cd apps/kafka-service && pnpm dev
```

### 5. Verify Setup
- API: http://localhost:3000
- WebSocket/Video: http://localhost:3001
- Health: http://localhost:3002

---

## 📡 API & Event Documentation

### Authentication (JWT)
```http
Authorization: Bearer <jwt-token>
```

### Core Endpoints
- User: `/api/v1/signup`, `/api/v1/signin`, `/api/v1/user/metadata`
- Spaces: `/api/v1/spaces`, `/api/v1/spaces/:id`
- Chat: `/api/v1/chatroom/*`, `/api/v1/chatroom/:id/messages`

### WebSocket Events
```javascript
// Join space
ws.send({ type: 'join', payload: { spaceId, token } });

// Move user
ws.send({ type: 'move', payload: { x, y } });

// Video call signaling
ws.send({ type: 'video-call-signaling', payload: {/* WebRTC data */} });
```

---

## 🎥 Video Call Implementation

### Backend
- `VideoCallManager.ts`: Proximity detection, call lifecycle.
- `User.ts`: WebSocket integration, signaling.
- WebRTC signaling server: Offer/answer/ICE relay.

### Frontend Integration
- WebSocket message handlers for call events.
- WebRTC setup (see example in docs).
- UI: Local/remote video display.

---

## 🔧 Configuration

### Environment Variables
- HTTP Service: PORT, DATABASE_URL, JWT_SECRET, REDIS_URL
- WebSocket Service: WS_PORT, DATABASE_URL, REDIS_URL, KAFKA credentials
- Kafka Service: KAFKA_BROKER, DATABASE_URL, SERVICE_ID

### Video Call
- STUN/TURN server URLs for WebRTC
- Proximity range and call timeout

---

## 📊 Monitoring & Analytics

- Active calls, durations, connection status, proximity events.
- Real-time logs and metrics via Kafka and Redis.
- Service health checks and error reporting.

---

## 🧪 Testing

```bash
pnpm test          # All tests
pnpm test:unit     # Unit
pnpm test:integration # Integration
pnpm test:e2e      # E2E
```
Test suites for video call, WebSocket, chat, and system integration.

---

## 🔒 Security

- JWT auth, password hashing, token refresh.
- Data validation, SQL injection/XSS protection.
- SSL/TLS, CORS, WebSocket origin validation, Kafka SASL.

---

## 🤝 Contributing

1. Fork and branch (`feature/my-feature`)
2. Test your changes
3. Commit (`conventional commits`)
4. Push and open a PR

**Coding Standards**: TypeScript, ESLint/Prettier, Jest, structured documentation.

---

## 📝 License

MIT License – see [LICENSE](LICENSE) for details.

---

## 🆘 Support & Troubleshooting

- Video/audio issues: browser permissions, STUN/TURN config.
- Kafka/Database/WebSocket errors: check credentials, service status.
- Submit issues with logs and detailed descriptions.

---

**Built for scalable, secure, and seamless virtual collaboration with proximity-based video communication.**
