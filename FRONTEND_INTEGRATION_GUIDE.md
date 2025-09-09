# Video Call Frontend Integration Guide

## 🎯 Overview

Your backend video call system is **ready for integration**! Here's everything you need to connect your frontend to the video call functionality.

## ✅ Backend Assessment

**Your backend has excellent infrastructure:**
- ✅ **CallManager**: Complete call lifecycle management
- ✅ **ProximityManager**: 10-unit range spatial detection
- ✅ **WebSocket Service**: Real-time communication at `ws://localhost:3001`
- ✅ **Type Definitions**: Comprehensive TypeScript interfaces
- ✅ **Configuration**: WebRTC and media settings ready

## 🔧 Core Components Implemented

### 1. **WebRTC Handler** (`src/video-call/webrtc/WebRTCHandler.ts`)
- Peer-to-peer connection management
- Offer/answer/ICE candidate handling
- Media stream processing
- Connection state monitoring

### 2. **Enhanced Call Manager** (`src/video-call/calling/EnhancedCallManager.ts`)
- Extends your existing CallManager with WebRTC
- Media stream integration
- Call controls (mute, camera toggle)

### 3. **Video Call System** (`src/video-call/VideoCallSystem.ts`)
- Main integration class that coordinates everything
- Simple API for your frontend
- State management and event handling

### 4. **Integration Example** (`src/video-call/examples/integration-example.ts`)
- Complete usage examples
- Step-by-step integration guide

## 🚀 Quick Integration Steps

### Step 1: Import the Video Call System

```typescript
import { VideoCallSystem } from './src/video-call/VideoCallSystem.js';

// Initialize the system
const videoCallSystem = new VideoCallSystem();
```

### Step 2: Initialize with Your WebSocket

```typescript
// Connect to your existing WebSocket service
const websocket = new WebSocket('ws://localhost:3001');

// Initialize video calls for a user
await videoCallSystem.initialize('user123', websocket);
```

### Step 3: Update Position for Proximity Detection

```typescript
// Call this when user moves in your 3D space
function onUserMove(x: number, y: number, z: number) {
  videoCallSystem.updatePosition(x, y, z);
}
```

### Step 4: Handle Nearby Users

```typescript
// Get users within 10-unit range for calling
const nearbyUsers = videoCallSystem.getNearbyUsers();

// Show these users in your UI as available for calls
nearbyUsers.forEach(user => {
  console.log(`${user.username} is nearby and available for calls`);
});
```

### Step 5: Initiate Calls

```typescript
// Call a nearby user
async function callUser(targetUser) {
  try {
    const callSession = await videoCallSystem.initiateCall(targetUser);
    console.log('Call initiated:', callSession);
  } catch (error) {
    console.error('Failed to initiate call:', error);
  }
}
```

### Step 6: Handle Incoming Calls

```typescript
// Check for incoming calls
const incomingCalls = videoCallSystem.getIncomingCalls();

// Accept a call
await videoCallSystem.acceptCall(callId);

// Reject a call
videoCallSystem.rejectCall(callId);
```

### Step 7: Control Media During Calls

```typescript
// Toggle microphone
const isMuted = videoCallSystem.toggleMute();

// Toggle camera
const isCameraOn = videoCallSystem.toggleCamera();

// End call
videoCallSystem.endCall();
```

### Step 8: Display Video Streams

```typescript
// Get media streams for your video elements
const localStream = videoCallSystem.getLocalStream();
const remoteStream = videoCallSystem.getRemoteStream();

// Assign to your video elements
if (localStream) {
  localVideoElement.srcObject = localStream;
}

if (remoteStream) {
  remoteVideoElement.srcObject = remoteStream;
}
```

## 🎮 WebSocket Events You Need to Handle

Your existing WebSocket at `ws://localhost:3001` will handle these events:

### Outgoing Events (Frontend → Backend):
```typescript
// Position updates
ws.emit('position-update', { position: { x, y, z }, isAvailable: true });

// Call signaling
ws.emit('call-request', { callId, targetUserId, type: 'peer-to-peer' });
ws.emit('call-response', { callId, accepted: true });
ws.emit('call-end', { callId });

// WebRTC signaling
ws.emit('webrtc-signal', { type: 'offer', callId, payload: offer });
```

### Incoming Events (Backend → Frontend):
```typescript
// Proximity updates
ws.on('proximity-update', (data) => { /* nearby users updated */ });
ws.on('user-entered-range', (data) => { /* user came into range */ });
ws.on('user-left-range', (data) => { /* user left range */ });

// Call events
ws.on('incoming-call', (data) => { /* show incoming call UI */ });
ws.on('call-accepted', (data) => { /* call was accepted */ });
ws.on('call-rejected', (data) => { /* call was rejected */ });
ws.on('call-ended', (data) => { /* call ended */ });

// WebRTC signaling
ws.on('webrtc-signal', (message) => { /* handle WebRTC signaling */ });
```

## 📱 Frontend UI Integration

### Basic HTML Structure You'll Need:

```html
<!-- Video call interface -->
<div id="video-call-container" style="display: none;">
  <!-- Local video (your camera) -->
  <video id="localVideo" autoplay muted playsinline></video>
  
  <!-- Remote video (other person's camera) -->
  <video id="remoteVideo" autoplay playsinline></video>
  
  <!-- Call controls -->
  <div id="call-controls">
    <button id="muteBtn">🎤</button>
    <button id="cameraBtn">📷</button>
    <button id="endCallBtn">📞</button>
  </div>
</div>

<!-- Nearby users panel -->
<div id="nearby-users">
  <h3>Nearby Users</h3>
  <div id="users-list"></div>
</div>

<!-- Incoming call modal -->
<div id="incoming-call-modal" style="display: none;">
  <div class="modal-content">
    <h3>Incoming Call</h3>
    <p id="caller-name"></p>
    <button id="acceptBtn">Accept</button>
    <button id="rejectBtn">Reject</button>
  </div>
</div>
```

### JavaScript Integration:

```javascript
// Initialize video call system
const videoCallSystem = new VideoCallSystem();
const websocket = new WebSocket('ws://localhost:3001');

// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const videoCallContainer = document.getElementById('video-call-container');
const nearbyUsersList = document.getElementById('users-list');
const incomingCallModal = document.getElementById('incoming-call-modal');

// Initialize when page loads
async function initializeVideoCall() {
  await videoCallSystem.initialize('currentUserId', websocket);
  
  // Update position periodically (integrate with your movement system)
  setInterval(() => {
    const position = getCurrentUserPosition(); // Your function
    videoCallSystem.updatePosition(position.x, position.y, position.z);
  }, 100);
  
  // Update nearby users UI
  setInterval(() => {
    updateNearbyUsersUI();
  }, 1000);
  
  // Check for incoming calls
  setInterval(() => {
    handleIncomingCalls();
  }, 500);
}

// Update nearby users display
function updateNearbyUsersUI() {
  const nearbyUsers = videoCallSystem.getNearbyUsers();
  nearbyUsersList.innerHTML = '';
  
  nearbyUsers.forEach(user => {
    const userElement = document.createElement('div');
    userElement.innerHTML = `
      <span>${user.username}</span>
      <button onclick="callUser('${user.id}')">Call</button>
    `;
    nearbyUsersList.appendChild(userElement);
  });
}

// Call a user
async function callUser(userId) {
  const nearbyUsers = videoCallSystem.getNearbyUsers();
  const targetUser = nearbyUsers.find(u => u.id === userId);
  
  if (targetUser) {
    await videoCallSystem.initiateCall(targetUser);
    showVideoCallUI();
  }
}

// Handle incoming calls
function handleIncomingCalls() {
  const incomingCalls = videoCallSystem.getIncomingCalls();
  
  if (incomingCalls.length > 0) {
    const call = incomingCalls[0];
    showIncomingCallModal(call);
  }
}

// Show video call interface
function showVideoCallUI() {
  videoCallContainer.style.display = 'block';
  
  // Update video streams
  const localStream = videoCallSystem.getLocalStream();
  const remoteStream = videoCallSystem.getRemoteStream();
  
  if (localStream) localVideo.srcObject = localStream;
  if (remoteStream) remoteVideo.srcObject = remoteStream;
}

// Control buttons
document.getElementById('muteBtn').onclick = () => {
  videoCallSystem.toggleMute();
};

document.getElementById('cameraBtn').onclick = () => {
  videoCallSystem.toggleCamera();
};

document.getElementById('endCallBtn').onclick = () => {
  videoCallSystem.endCall();
  videoCallContainer.style.display = 'none';
};

// Initialize when page loads
initializeVideoCall();
```

## 🔧 System Status Monitoring

```typescript
// Get comprehensive system status
const status = videoCallSystem.getStatus();

console.log('Video Call Status:', {
  isInitialized: status.isInitialized,
  isInCall: status.isInCall,
  nearbyUsersCount: status.nearbyUsersCount,
  incomingCallsCount: status.incomingCallsCount,
  isMuted: status.isMuted,
  isCameraOn: status.isCameraOn,
  hasLocalStream: status.hasLocalStream,
  hasRemoteStream: status.hasRemoteStream,
  connectionState: status.connectionState
});
```

## 🎯 Key Integration Points

### 1. **Position Updates**
- Call `videoCallSystem.updatePosition(x, y, z)` whenever user moves
- This enables the 10-unit proximity detection

### 2. **WebSocket Connection**
- Use your existing WebSocket at `ws://localhost:3001`
- The system will automatically handle all video call signaling

### 3. **User Management**
- Integrate with your existing user authentication
- Pass the current user ID when initializing

### 4. **UI Integration**
- Create video elements for local and remote streams
- Add call control buttons (mute, camera, end call)
- Show nearby users list with call buttons
- Handle incoming call notifications

## 🚀 Next Steps

1. **Test the Integration**:
   ```typescript
   // Basic test
   const videoCallSystem = new VideoCallSystem();
   await videoCallSystem.initialize('test-user', websocket);
   videoCallSystem.updatePosition(0, 0, 0);
   console.log('Status:', videoCallSystem.getStatus());
   ```

2. **Add to Your Main App**:
   - Import VideoCallSystem into your main application
   - Initialize when user enters the metaverse
   - Connect position updates to your movement system

3. **Create Your UI**:
   - Design video call interface to match your app style
   - Add nearby users panel
   - Create incoming call modal

4. **Test with Multiple Users**:
   - Open multiple browser tabs
   - Move users within 10 units of each other
   - Test calling functionality

## 🔍 Debugging

```typescript
// Enable debug logging
console.log('Nearby users:', videoCallSystem.getNearbyUsers());
console.log('Current position:', videoCallSystem.getCurrentPosition());
console.log('System status:', videoCallSystem.getStatus());

// Monitor WebSocket events
websocket.addEventListener('message', (event) => {
  console.log('WebSocket message:', JSON.parse(event.data));
});
```

## 🎉 You're Ready!

Your backend is perfectly set up for video calls. The integration should be straightforward since all the complex WebRTC and signaling logic is handled for you. Just connect the UI and you'll have working proximity-based video calls in your metaverse!