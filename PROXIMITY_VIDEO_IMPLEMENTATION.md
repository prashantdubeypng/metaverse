# Proximity-Based Video Call System Implementation

## Overview
This document outlines the comprehensive proximity-based video call system implementation for the metaverse application. The system automatically connects users for video calls when they are within 2 tiles of each other, with seamless WebRTC peer-to-peer connections, screen sharing support, and automatic disconnect when users move too far apart.

## 🏗️ Architecture

### Frontend Components

#### 1. **ProximityVideoCallManager** (`src/services/proximityVideoCall.ts`)
- **Purpose**: Core service managing proximity-based video calls
- **Key Features**:
  - Automatic connection/disconnection based on 2-tile distance
  - WebRTC peer-to-peer video calls with SDP signaling
  - Screen sharing with track replacement
  - Media stream management (audio/video controls)
  - Real-time participant management
  - ICE candidate exchange for NAT traversal

#### 2. **WebSocketService** (`src/services/websocket.ts`)
- **Purpose**: Centralized WebSocket communication service
- **Key Features**:
  - Auto-reconnection with exponential backoff
  - JWT authentication support
  - Event-driven message handling
  - Heartbeat mechanism for connection monitoring
  - Message queuing for offline scenarios

#### 3. **useProximityVideoCall Hook** (`src/hooks/useProximityVideoCall.ts`)
- **Purpose**: React hook for proximity video call state management
- **Key Features**:
  - Real-time participant state updates
  - Media stream handling
  - Error state management
  - Integration with ProximityVideoCallManager

#### 4. **ProximityVideoCallUI Component** (`src/components/ProximityVideoCallUI.tsx`)
- **Purpose**: Complete user interface for video calls
- **Key Features**:
  - Responsive participant grid layout
  - Media controls (mute, camera, screen share)
  - Connection status indicators
  - Auto-connection notifications
  - Call duration tracking

#### 5. **ProximityManager Component** (`src/components/ProximityManager.tsx`)
- **Purpose**: Manages proximity detection and user tracking
- **Key Features**:
  - Real-time position tracking
  - Proximity range calculation (2 tiles for video, 10 tiles for detection)
  - Automatic user discovery
  - Position update broadcasting

### Backend Components

#### 1. **User Class Updates** (`metaverse/apps/ws/src/User.ts`)
- **New Message Handlers**:
  - `proximity-video-call-signal`: WebRTC signaling relay
  - `proximity-position-update`: Position tracking
  - `proximity-video-call-ended`: Call termination handling
  - `proximity-heartbeat`: Connection monitoring
  - `authenticate`: WebSocket authentication

#### 2. **VideoCallManager** (`metaverse/apps/ws/src/VideoCallManager.ts`)
- **Enhanced Features**:
  - Proximity-based call initiation
  - Automatic disconnection for distant users
  - Multi-participant call support
  - Position-based user filtering

## 🔧 Technical Implementation

### WebRTC Configuration
```typescript
{
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
}
```

### Proximity Algorithm
- **Video Call Range**: 2 tiles (Euclidean distance ≤ 2)
- **Proximity Detection**: 10 tiles (for user awareness)
- **Distance Calculation**: `√((x₁-x₂)² + (y₁-y₂)²)`

### Message Flow

#### Call Initiation
1. User moves within 2-tile range
2. ProximityManager detects nearby users
3. ProximityVideoCallManager initiates WebRTC offer
4. Server relays signaling through WebSocket
5. Target user receives offer and responds with answer
6. ICE candidates exchanged for connection establishment

#### Call Termination
1. User moves beyond 2-tile range
2. ProximityManager triggers disconnection
3. Peer connections closed gracefully
4. Media streams stopped and cleaned up

## 🎯 Key Features

### ✅ Automatic Connection Management
- **Auto-connect**: Users automatically enter video calls when within range
- **Auto-disconnect**: Calls end when users move too far apart
- **Seamless transitions**: Smooth switching between different proximity groups

### ✅ WebRTC Peer-to-Peer Communication
- **Direct media streaming**: No server-side media processing
- **Low latency**: Direct peer connections
- **NAT traversal**: ICE candidates for firewall handling

### ✅ Screen Sharing Support
- **Track replacement**: Seamless switch between camera and screen
- **Participant indicators**: Visual cues for screen sharing status
- **Quality optimization**: Adaptive bitrate based on connection

### ✅ Responsive UI Components
- **Grid layout**: Automatic participant arrangement
- **Media controls**: Mute, camera, screen share buttons
- **Connection status**: Real-time connection quality indicators
- **Auto-notifications**: Toast messages for call events

## 🚀 Usage Integration

### Space Page Integration (`src/app/space/[id]/page.tsx`)
```tsx
// Proximity video call integration
const proximityVideoCall = useProximityVideoCall();

// Components
<ProximityManager
  userId={currentUser.id}
  username={currentUser.username}
  currentPosition={{ x: currentUser.x, y: currentUser.y, z: 0 }}
/>
<ProximityVideoCallUI 
  userId={currentUser.id}
  username={currentUser.username}
/>
```

### Position Updates
- Movement triggers proximity position updates
- Real-time broadcasting to nearby users
- Automatic connection/disconnection based on distance

## 🛠️ Configuration

### Environment Variables
- **WebSocket URL**: `http://localhost:3001` (configurable)
- **Video Call Range**: 2 tiles (adjustable in ProximityManager)
- **Proximity Range**: 10 tiles (adjustable in ProximityManager)

### Media Constraints
```typescript
{
  video: { width: 640, height: 480, frameRate: 30 },
  audio: { echoCancellation: true, noiseSuppression: true }
}
```

## 🔍 Debugging Features

### Console Logging
- **Proximity detection**: `🎥 Users in video call range`
- **WebRTC signaling**: `🎥 [PROXIMITY SIGNALING]`
- **Connection states**: `🔗 WebSocket connected`
- **Position updates**: `📍 [PROXIMITY POSITION]`

### Error Handling
- WebSocket reconnection with exponential backoff
- WebRTC connection failure recovery
- Media stream error handling
- User-friendly error messages in UI

## 🔒 Security Considerations

### Authentication
- JWT token validation for WebSocket connections
- User ID verification for call participants
- Secure signaling message relay

### Privacy
- Peer-to-peer media streams (no server recording)
- Automatic call termination on disconnect
- User consent for camera/microphone access

## 📱 Browser Compatibility

### Supported Features
- **WebRTC**: Chrome 80+, Firefox 75+, Safari 14+
- **WebSocket**: All modern browsers
- **Screen Share**: Chrome 72+, Firefox 66+, Safari 13+

### Fallback Handling
- Graceful degradation for unsupported features
- Error messages for incompatible browsers
- Progressive enhancement approach

## 🎬 User Experience Flow

1. **Join Space**: User enters metaverse space
2. **Move Around**: Navigation using arrow keys/WASD
3. **Proximity Detection**: System detects nearby users
4. **Auto-Connect**: Video call starts automatically within 2 tiles
5. **Visual Feedback**: UI shows participant streams and controls
6. **Auto-Disconnect**: Call ends when users move apart
7. **Seamless Transitions**: Smooth experience throughout

This implementation provides a complete, production-ready proximity-based video calling system with automatic connection management, WebRTC integration, and a polished user interface.