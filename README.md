# 🌐 Metaverse Platform with Proximity Video Calls

A comprehensive real-time metaverse platform built with modern web technologies, featuring **automatic proximity-based video calls**, spatial chat, and scalable microservices architecture.

## ✨ Key Features

### 🎥 **Proximity Video Calls** (NEW!)
- **Automatic video calls** when users are within 2 tiles of each other
- **No manual calling** - calls start and end based on proximity
- **WebRTC peer-to-peer** connections for high-quality video/audio
- **Real-time signaling** through WebSocket infrastructure
- **Seamless integration** with existing movement system

### 🏢 **Virtual Spaces**
- Create and manage 2D virtual environments
- Grid-based movement system with collision detection
- Real-time user position tracking and synchronization

### 💬 **Spatial Communication**
- Location-aware chat with multiple chatrooms per space
- Real-time messaging with Kafka persistence
- Redis pub/sub for instant message delivery

### 👥 **User Management**
- JWT-based authentication and authorization
- User profiles, avatars, and presence status
- Space membership and role management

## 🏗️ Enhanced Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   HTTP API      │    │   WebSocket     │
│   (WebRTC)      │◄──►│   Service       │◄──►│   Service       │
│                 │    │                 │    │ + VideoCallMgr  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                        │
         │ P2P Video             ▼                        ▼
         │                ┌─────────────────┐    ┌─────────────────┐
         │                │   PostgreSQL    │    │   Redis Cache   │
         │                │   Database      │    │   & PubSub      │
         │                └─────────────────┘    └─────────────────┘
         │                                                │
         │                                                ▼
         │                                    ┌─────────────────┐
         └────────────────────────────────────│   Kafka Queue   │
                  WebRTC Signaling            │   & Analytics   │
                                              └─────────────────┘
                                                        │
                                                        ▼
                                            ┌─────────────────┐
                                            │   Kafka         │
                                            │   Consumer      │
                                            │   Service       │
                                            └─────────────────┘
```

## 🎯 Video Call System Architecture

### **Proximity Detection Engine**
```
User Movement → Position Update → Proximity Check → Auto Video Call
     ↓               ↓                ↓                    ↓
  Grid System    WebSocket Sync   2-Tile Radius    WebRTC Connection
```

### **Video Call Flow**
1. **User A** moves within 2 tiles of **User B**
2. **VideoCallManager** detects proximity automatically
3. **WebSocket** sends `video-call-start` to both users
4. **Frontend** establishes WebRTC peer-to-peer connection
5. **Video/audio streams** flow directly between users
6. **Call ends automatically** when users move apart

### **WebRTC Signaling**
```
User A                    WebSocket Server                    User B
  │                            │                               │
  ├─── Offer ────────────────► │ ─────────────────────────────► │
  │                            │                               │
  │ ◄─────────────────────────── │ ◄─────────── Answer ─────────┤
  │                            │                               │
  ├─ ICE Candidates ─────────► │ ─────────────────────────────► │
  │                            │                               │
  │ ◄─────────────────────────── │ ◄───── ICE Candidates ──────┤
  │                            │                               │
  └──── Direct P2P Video ──────────────────────────────────────┘
```

## 📁 Enhanced Project Structure

```
📁 metaverse/
├── 📁 apps/                          # Microservices
│   ├── 📁 http/                      # REST API service
│   │   ├── 📁 src/
│   │   │   ├── 📁 routes/v1/         # API endpoints
│   │   │   │   ├── 📄 chatroom.ts    # Chat management
│   │   │   │   ├── 📄 space.ts       # Virtual spaces
│   │   │   │   ├── 📄 user.ts        # User management
│   │   │   │   └── 📁 chats_route/   # Chat controllers
│   │   │   ├── 📁 middleware/        # Auth & validation
│   │   │   ├── 📁 services/          # Business logic
│   │   │   └── 📁 types/             # TypeScript definitions
│   │   └── 📄 package.json
│   │
│   ├── 📁 ws/                        # 🎥 WebSocket + Video Call Service
│   │   ├── 📁 src/
│   │   │   ├── 📄 User.ts            # User connection handling
│   │   │   ├── 📄 Roommanager.ts     # Space management
│   │   │   ├── 📄 VideoCallManager.ts # 🎥 Proximity video calls
│   │   │   ├── 📄 KafkaChatService.ts # Chat messaging
│   │   │   ├── 📄 RedisService.ts    # Real-time pub/sub
│   │   │   ├── 📄 types.ts           # WebSocket types
│   │   │   └── 📄 index.ts           # Main server
│   │   └── 📄 package.json
│   │
│   ├── 📁 kafka-service/             # Message processing
│   │   ├── 📄 src/index.ts           # Kafka consumer
│   │   └── 📄 package.json
│   │
│   └── 📁 media-service/             # File & media handling
│
├── 📁 packages/                      # Shared libraries
│   ├── 📁 db/                        # Database schema & client
│   │   ├── 📁 prisma/
│   │   │   ├── 📄 schema.prisma      # Database models
│   │   │   └── 📁 migrations/        # DB migrations
│   │   └── 📄 package.json
│   │
│   ├── 📁 webrtc-client/             # 🎥 WebRTC client utilities
│   │   ├── 📁 src/
│   │   │   ├── 📁 calling/           # Call management
│   │   │   ├── 📁 proximity/         # Proximity detection
│   │   │   ├── 📁 types/             # Video call types
│   │   │   └── 📁 utils/             # WebRTC utilities
│   │   └── 📄 package.json
│   │
│   ├── 📁 shared-types/              # Common TypeScript types
│   ├── 📁 kafka-client/              # Kafka utilities
│   ├── 📁 redis-client/              # Redis utilities
│   └── 📁 ui/                        # Shared UI components
│
├── 📁 tests/                         # Test suites
│   ├── 📁 unit/                      # Unit tests
│   ├── 📁 integration/               # Integration tests
│   └── 📁 e2e/                       # End-to-end tests
│
├── 📄 package.json                   # Root package configuration
├── 📄 tsconfig.json                  # TypeScript configuration
└── 📄 turbo.json                     # Turborepo configuration
```

## 🛠️ Technology Stack

### **Backend Services**
- **Node.js** + **TypeScript** - Runtime and language
- **Express.js** - HTTP API framework
- **WebSocket (ws)** - Real-time communication
- **WebRTC** - Peer-to-peer video/audio calls
- **Prisma** - Database ORM and migrations
- **PostgreSQL** - Primary database
- **Redis** - Caching and pub/sub
- **Kafka** - Message queuing and analytics

### **Video Call Technology**
- **WebRTC** - Peer-to-peer video/audio streaming
- **STUN/TURN Servers** - NAT traversal for connections
- **WebSocket Signaling** - Offer/answer/ICE candidate exchange
- **Proximity Detection** - Grid-based spatial awareness
- **Automatic Call Management** - No manual intervention required

### **Infrastructure**
- **Turborepo** - Monorepo build system
- **pnpm** - Package manager
- **JWT** - Authentication tokens
- **ESLint** + **Prettier** - Code quality
- **Jest** - Testing framework

## 🚀 Quick Start

### **Prerequisites**
- **Node.js** >= 18
- **pnpm** >= 9.0.0
- **PostgreSQL** database
- **Redis** server
- **Kafka** cluster (or Aiven Cloud account)

### **1. Clone and Install**
```bash
git clone <repository-url>
cd metaverse
pnpm install
```

### **2. Environment Setup**
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

### **3. Database Setup**
```bash
cd packages/db
pnpm prisma migrate dev
pnpm prisma generate
```

### **4. Start Services**
```bash
# Terminal 1: HTTP API
cd apps/http && pnpm dev

# Terminal 2: WebSocket + Video Call Service
cd apps/ws && pnpm dev

# Terminal 3: Kafka Consumer
cd apps/kafka-service && pnpm dev
```

### **5. Verify Setup**
- **HTTP API**: http://localhost:3000
- **WebSocket + Video**: http://localhost:3001
- **Health Check**: http://localhost:3002

## 📡 API Documentation

### **WebSocket Events (Enhanced)**

#### **Connection & Movement**
```javascript
// Join space
ws.send(JSON.stringify({
  type: 'join',
  payload: { spaceId: 'space-id', token: 'jwt-token' }
}))

// Move user (triggers proximity detection)
ws.send(JSON.stringify({
  type: 'move',
  payload: { x: 5, y: 3 }
}))
```

#### **🎥 Video Call Events (NEW!)**
```javascript
// Automatic video call start (received from server)
{
  type: 'video-call-start',
  payload: {
    callId: 'call_123',
    participants: [
      { userId: 'user1', username: 'Alice', x: 5, y: 3 },
      { userId: 'user2', username: 'Bob', x: 6, y: 3 }
    ],
    isProximityCall: true
  }
}

// WebRTC signaling data exchange
ws.send(JSON.stringify({
  type: 'video-call-signaling',
  payload: { /* WebRTC offer/answer/ice-candidate */ }
}))

// Automatic video call end (received from server)
{
  type: 'video-call-end',
  payload: {
    callId: 'call_123',
    reason: 'proximity_lost' // or 'user_ended', 'user_disconnected'
  }
}

// Manual call end (send to server)
ws.send(JSON.stringify({
  type: 'video-call-end',
  payload: { callId: 'call_123' }
}))
```

#### **Chat System**
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
```

## 🎥 Video Call Implementation Guide

### **Backend (✅ Complete)**
The video call system is fully implemented in the backend:

- **VideoCallManager.ts** - Proximity detection and call management
- **User.ts** - WebSocket integration and signaling relay
- **Automatic proximity detection** - 2-tile radius monitoring
- **WebRTC signaling server** - Relay offers/answers/ICE candidates
- **Call lifecycle management** - Start, maintain, and end calls

### **Frontend Integration**
To add video calls to your frontend, implement these components:

#### **1. WebSocket Message Handlers**
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'video-call-start':
      startVideoCall(data.payload);
      break;
    case 'video-call-signaling':
      handleWebRTCSignaling(data.payload);
      break;
    case 'video-call-end':
      endVideoCall(data.payload);
      break;
  }
};
```

#### **2. WebRTC Implementation**
```javascript
// Get user media
const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

// Create peer connection
const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Handle signaling through WebSocket
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    ws.send(JSON.stringify({
      type: 'video-call-signaling',
      payload: { candidate: event.candidate }
    }));
  }
};
```

#### **3. Video Display**
```html
<!-- Local video (your camera) -->
<video id="localVideo" autoplay muted></video>

<!-- Remote video (other user) -->
<video id="remoteVideo" autoplay></video>
```

### **Complete Frontend Implementation**
A complete WebRTC handler class is available in `frontend-video-implementation.js` that handles all the complexity for you.

## 🔧 Configuration

### **Environment Variables**

#### **WebSocket Service (.env)**
```env
WS_PORT=3001
DATABASE_URL="postgresql://user:pass@localhost:5432/metaverse"
JWT_SECRET="your-jwt-secret"
REDIS_URL="redis://localhost:6379"
KAFKA_BROKER="your-kafka-broker:9092"
KAFKA_USERNAME="kafka-user"
KAFKA_PASSWORD="kafka-password"
```

#### **Video Call Configuration**
```javascript
// WebRTC Configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
    // Add TURN servers for production
  ]
};

// Proximity Settings
const PROXIMITY_RANGE = 2; // tiles
const CALL_TIMEOUT = 30000; // 30 seconds
```

## 📊 Enhanced Monitoring & Analytics

### **Video Call Metrics**
- **Active video calls** - Real-time call count
- **Call duration** - Average and total call times
- **Connection quality** - WebRTC connection states
- **Proximity events** - User proximity detection frequency
- **Call success rate** - Successful vs failed call attempts

### **Server Logs**
```bash
📊 Server Stats: 15 users across 3 spaces
🎥 Video Call Stats: 4 active calls, 8 users in calls
🎥 Active Video Calls: call_123: user1 <-> user2 (45s)
🏢 Active Spaces: space1: 8 users, space2: 4 users, space3: 3 users
```

## 🧪 Testing Video Calls

### **Manual Testing**
1. **Start the services** (HTTP, WebSocket, Kafka)
2. **Connect two users** to the same space
3. **Move users within 2 tiles** of each other
4. **Video call starts automatically**
5. **Move users apart** - call ends automatically

### **Automated Testing**
```bash
# Test proximity detection
pnpm test:unit -- VideoCallManager

# Test WebSocket integration
pnpm test:integration -- video-call

# Test end-to-end video call flow
pnpm test:e2e -- video-call-flow
```

## 🔒 Security Considerations

### **Video Call Security**
- **JWT authentication** required for all video calls
- **WebRTC encryption** - All video/audio streams are encrypted
- **STUN/TURN security** - Secure NAT traversal
- **Proximity validation** - Server-side proximity verification
- **Call authorization** - Only authenticated users can participate

### **Privacy Features**
- **Automatic call management** - No persistent call history
- **Proximity-based** - Calls only with nearby users
- **No recording** - Peer-to-peer streams, no server recording
- **User control** - Users can end calls manually

## 🚀 Deployment

### **Production Considerations**
- **TURN servers** required for users behind NAT/firewalls
- **Load balancing** for WebSocket connections
- **Redis clustering** for high availability
- **Kafka partitioning** for message scaling
- **Database connection pooling** for performance

### **Scaling Video Calls**
- **Horizontal scaling** - Multiple WebSocket servers
- **Redis pub/sub** - Cross-server communication
- **Load balancer** - Sticky sessions for WebSocket
- **TURN server cluster** - Geographic distribution

## 🎯 Roadmap

### **Current Features** ✅
- Proximity-based video calls (2-tile radius)
- Automatic call start/end
- WebRTC peer-to-peer connections
- Real-time signaling
- Chat integration

### **Upcoming Features** 🚧
- **Group video calls** - Multiple users in proximity
- **Screen sharing** - Share screens during calls
- **Call quality indicators** - Connection quality metrics
- **Mobile support** - React Native integration
- **Voice-only mode** - Audio-only calls option

## 🤝 Contributing

### **Video Call Development**
- **Backend**: `metaverse/apps/ws/src/VideoCallManager.ts`
- **Frontend**: `frontend-video-implementation.js`
- **Types**: `metaverse/packages/webrtc-client/src/types/`
- **Tests**: `tests/unit/video-call/`

### **Development Workflow**
1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/video-enhancement`)
3. **Test** video call functionality
4. **Commit** changes (`git commit -m 'Add video call enhancement'`)
5. **Push** to branch (`git push origin feature/video-enhancement`)
6. **Open** Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### **Video Call Troubleshooting**
1. **No video/audio**: Check browser permissions for camera/microphone
2. **Connection failed**: Verify STUN/TURN server configuration
3. **Calls not starting**: Check proximity detection (2-tile radius)
4. **WebSocket errors**: Verify WebSocket server is running on port 3001

### **Common Issues**
1. **Kafka Connection Errors**: Verify broker URL and credentials
2. **Database Connection**: Check PostgreSQL service and URL
3. **WebSocket Failures**: Ensure ports 3001-3002 are available
4. **Build Errors**: Clear node_modules and reinstall dependencies

### **Getting Help**
- **Issues**: Create GitHub issue with detailed description
- **Video Call Issues**: Include browser console logs and WebRTC stats
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check service-specific README files

---

**🎥 Built with ❤️ for seamless virtual collaboration and proximity-based video communication**