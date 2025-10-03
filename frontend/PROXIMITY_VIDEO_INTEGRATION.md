# Proximity Video Call Integration Guide

## 🎯 Overview

This integration adds automatic proximity-based video calling to your existing metaverse application. When users move within 2 tiles of each other, a video call automatically starts. When they move apart, the call automatically ends.

## 📁 Files Added

### Core Implementation
- `src/utils/ProximityVideoCallHandler.ts` - WebRTC handler class
- `src/hooks/useProximityVideoCall.ts` - React hook for video call state
- `src/components/ProximityVideoCall.tsx` - Video call UI component
- `src/components/SpaceWithProximityVideo.tsx` - Integration example

### Updated Files
- `src/types/video-call.ts` - Added proximity video call types

## 🚀 Quick Integration

### Step 1: Add to Your Space Component

Replace your existing space component with the integrated version:

```tsx
import SpaceWithProximityVideo from '@/components/SpaceWithProximityVideo';

// In your page/component
<SpaceWithProximityVideo
  userId={currentUser.id}
  username={currentUser.username}
  spaceId={currentSpace.id}
/>
```

### Step 2: Update Your WebSocket Handler

If you have an existing WebSocket connection, add these message handlers:

```typescript
// Add to your existing WebSocket onmessage handler
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    // Your existing cases...
    
    // New proximity video call cases
    case 'video-call-start':
    case 'video-call-signaling':
    case 'video-call-end':
    case 'users-in-video-call':
      // These are automatically handled by useProximityVideoCall hook
      break;
  }
};
```

### Step 3: Send User Movement

Make sure to send user position updates when users move:

```typescript
// Call this whenever a user moves in your space
const sendUserMovement = (x: number, y: number) => {
  websocket.send(JSON.stringify({
    type: 'user-moved',
    payload: {
      userId: currentUser.id,
      x,
      y,
      timestamp: Date.now()
    }
  }));
};
```

## 🎮 How It Works

### Automatic Flow
1. **User Movement**: Users move around in your space
2. **Proximity Detection**: Backend detects when users are within 2 tiles
3. **Auto Call Start**: Video call automatically starts (no buttons/prompts)
4. **WebRTC Connection**: Peer-to-peer video/audio connection established
5. **Auto Call End**: Call ends when users move more than 2 tiles apart

### Backend Messages Your Frontend Receives

```typescript
// 1. Call starts automatically
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

// 2. WebRTC signaling exchange
{
  type: 'video-call-signaling',
  payload: {
    callId: 'call_123',
    fromUserId: 'user1',
    signalingData: { /* WebRTC offer/answer/ice-candidate */ }
  }
}

// 3. Call ends automatically
{
  type: 'video-call-end',
  payload: {
    callId: 'call_123',
    reason: 'proximity_lost'
  }
}
```

## 🎨 UI Features

### Video Call Interface
- **Full-screen overlay** when call is active
- **Picture-in-picture** local video
- **Main remote video** display
- **Call controls**: Mute, camera toggle, end call
- **Proximity indicator**: Shows "Within 2 tiles"
- **Auto-disconnect notice**: Explains automatic behavior

### Visual Indicators
- 🟢 **Green indicator**: Shows proximity status
- ⏱️ **Call timer**: Shows call duration
- 🎥 **Camera/mic status**: Visual feedback for mute/video state

## 🔧 Customization

### Styling
The components use Tailwind CSS classes. Customize by:
- Modifying classes in `ProximityVideoCall.tsx`
- Adding custom CSS for video elements
- Changing colors/layout to match your theme

### Behavior
Customize behavior by modifying:
- `ProximityVideoCallHandler.ts` - WebRTC configuration
- `useProximityVideoCall.ts` - State management
- Backend proximity radius (currently 2 tiles)

### Integration with Existing UI
- The video call overlay appears on top of your existing space UI
- Calls are completely automatic - no UI changes needed to your existing components
- Users can still interact with your space while in a call (if desired)

## 🐛 Troubleshooting

### Common Issues

1. **No video/audio permissions**
   - Browser will prompt for camera/microphone access
   - Users must allow permissions for calls to work

2. **WebSocket connection issues**
   - Check WebSocket URL in environment variables
   - Ensure backend is running and accessible

3. **WebRTC connection fails**
   - May need TURN servers for users behind strict NATs
   - Check browser console for WebRTC errors

### Debug Mode
Enable debug logging by adding to console:
```javascript
// In browser console
localStorage.setItem('debug-proximity-video', 'true');
```

## 🌐 Environment Variables

Add to your `.env.local`:
```bash
# WebSocket URL for your backend
NEXT_PUBLIC_WS_URL=http://localhost:3001

# Optional: TURN server configuration
NEXT_PUBLIC_TURN_SERVER_URL=turn:your-turn-server.com
NEXT_PUBLIC_TURN_USERNAME=username
NEXT_PUBLIC_TURN_CREDENTIAL=password
```

## 📱 Browser Compatibility

- ✅ Chrome 60+
- ✅ Firefox 60+
- ✅ Safari 12+
- ✅ Edge 79+
- ❌ Internet Explorer (not supported)

## 🔒 Security Considerations

- Video calls are peer-to-peer (no server recording)
- WebRTC uses encryption by default
- Consider implementing user consent for video calls
- Add user blocking/reporting features if needed

## 🚀 Production Deployment

### TURN Servers
For production, add TURN servers to `ProximityVideoCallHandler.ts`:

```typescript
private rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-turn-server.com',
      username: 'your-username',
      credential: 'your-password'
    }
  ]
};
```

### Performance Optimization
- Consider limiting concurrent video calls
- Add bandwidth detection and quality adjustment
- Implement call recording if needed
- Add analytics for call success rates

## 📞 Support

The proximity video calling system is now fully integrated with your existing metaverse backend. Users will automatically start video calls when they move close to each other, creating a natural and immersive social experience!