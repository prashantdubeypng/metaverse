# BUG-002: Video Stream Shows Black Screen

## Bug Information

**Bug ID**: BUG-002  
**Title**: Video Stream Shows Black Screen Despite Camera Being Active  
**Severity**: Major  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When a proximity video call is initiated, users sometimes see a black screen in the video element instead of the remote user's camera feed. The local video preview works correctly, indicating the camera is functioning. The issue appears to be related to the WebRTC track attachment or the video element not receiving the stream properly.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Call Manager | `frontend/src/services/proximityVideoCall.ts` | Frontend |
| Proximity Video Call UI | `frontend/src/components/ProximityVideoCallUI.tsx` | Frontend |
| Video Call Interface | `frontend/src/components/VideoCallInterface.tsx` | Frontend |

---

## Reproduction Steps

1. Start a proximity video call between two users
2. Observe the video elements
3. Local preview shows correctly
4. Remote video shows black screen
5. Check console for track events

**Expected Behavior**:  
Both local and remote video streams should display properly in the video elements.

**Actual Behavior**:  
Remote video element shows black screen. Track events fire but video doesn't render.

---

## Console Logs / Error Messages

```
📡 Remote stream received
🔗 Connection state: connected
✅ ICE connection established
// But video element remains black
```

---

## Root Cause Analysis

### Problem

Multiple potential causes:

1. **Video Element Reference**: The video element's `srcObject` is set but the element may not be in the DOM yet when the stream is attached
2. **Track Ordering**: Remote tracks may arrive before the video element is ready
3. **Auto-play Policy**: Browser auto-play policies may block video playback
4. **Missing play() Call**: Video element needs explicit `play()` call after setting srcObject

### Technical Details

**File**: `frontend/src/components/ProximityVideoCallUI.tsx`

```typescript
// POTENTIAL ISSUE - Video element may not be ready
useEffect(() => {
  if (remoteVideoRef.current && remoteStream) {
    remoteVideoRef.current.srcObject = remoteStream;
    // Missing: autoplay handling, play() call, readiness check
  }
}, [remoteStream]);
```

---

## Solution

### Approach

1. Add explicit `play()` call with error handling
2. Wait for video element to be ready before setting srcObject
3. Handle browser auto-play policies
4. Add retry logic for track attachment

### Code Changes

**File**: `frontend/src/components/ProximityVideoCallUI.tsx`

```typescript
// BEFORE (may cause black screen)
useEffect(() => {
  if (remoteVideoRef.current && remoteStream) {
    remoteVideoRef.current.srcObject = remoteStream;
  }
}, [remoteStream]);

// AFTER (robust stream handling)
useEffect(() => {
  const videoElement = remoteVideoRef.current;
  if (!videoElement || !remoteStream) return;

  // Wait for element to be fully mounted
  const attachStream = async () => {
    try {
      // Set the stream
      videoElement.srcObject = remoteStream;
      
      // Ensure video tracks are active
      const videoTracks = remoteStream.getVideoTracks();
      if (videoTracks.length > 0) {
        console.log('📹 Video track state:', videoTracks[0].readyState);
        console.log('📹 Video track enabled:', videoTracks[0].enabled);
      }
      
      // Wait for metadata to load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Metadata timeout')), 5000);
        
        videoElement.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        // If metadata already loaded
        if (videoElement.readyState >= 1) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      // Attempt to play with muted fallback for autoplay policy
      videoElement.muted = true; // Start muted to bypass autoplay
      await videoElement.play();
      
      // After successful play, unmute if user permits
      videoElement.muted = false;
      
      console.log('✅ Remote video playing successfully');
      
    } catch (error) {
      console.error('❌ Failed to play remote video:', error);
      
      // Retry with muted video as fallback
      try {
        videoElement.muted = true;
        await videoElement.play();
        console.log('⚠️ Playing muted due to autoplay policy');
      } catch (retryError) {
        console.error('❌ Failed to play even when muted:', retryError);
      }
    }
  };

  attachStream();

  // Cleanup
  return () => {
    videoElement.srcObject = null;
  };
}, [remoteStream]);
```

**Additional Fix**: Add `playsInline` and `autoPlay` attributes

```tsx
<video
  ref={remoteVideoRef}
  autoPlay
  playsInline
  muted={false}
  className="remote-video"
  onLoadedMetadata={() => console.log('📹 Metadata loaded')}
  onPlay={() => console.log('▶️ Video playing')}
  onError={(e) => console.error('❌ Video error:', e)}
/>
```

---

## Testing

### Manual Testing

1. Open developer tools Network tab
2. Start proximity video call
3. Check that video track is being received
4. Verify video element has srcObject set
5. Check for console errors related to autoplay
6. Verify video plays with sound

### Debugging Steps

```javascript
// In browser console, check video element state
const video = document.querySelector('video.remote-video');
console.log('srcObject:', video.srcObject);
console.log('readyState:', video.readyState);
console.log('paused:', video.paused);
console.log('muted:', video.muted);

// Check stream tracks
const stream = video.srcObject;
if (stream) {
  console.log('Video tracks:', stream.getVideoTracks());
  console.log('Audio tracks:', stream.getAudioTracks());
}
```

---

## Related Issues

- **Related Bugs**: BUG-003 (ICE failure may also cause black screen)
- **Browser Compatibility**: Chrome, Firefox, Safari have different autoplay policies
- **Mobile**: iOS requires user interaction before video can play

---

## Notes

- Chrome DevTools has a "Media" panel that shows detailed video playback info
- Consider adding a "Click to enable video" button as fallback for strict autoplay policies
- Test on mobile devices where autoplay restrictions are stricter
