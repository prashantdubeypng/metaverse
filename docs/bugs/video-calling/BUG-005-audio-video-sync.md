# BUG-005: Audio Out of Sync with Video

## Bug Information

**Bug ID**: BUG-005  
**Title**: Audio Delayed/Ahead of Video During Video Calls  
**Severity**: Major  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

During video calls, audio and video streams can become desynchronized, with audio arriving before or after the video by 500ms to 2 seconds. This makes conversations feel unnatural and is especially noticeable during lip movements.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Handler | `frontend/src/utils/ProximityVideoCallHandler.ts` | Frontend |
| Video Call Manager | `frontend/src/services/proximityVideoCall.ts` | Frontend |

---

## Reproduction Steps

1. Open video call between two users
2. Both users on different network conditions (e.g., one on WiFi, one on 4G)
3. Talk while making visible movements
4. Observe audio arrives before/after visible mouth movement

**Expected Behavior**:  
Audio and video should be synchronized within 40ms (acceptable lip-sync threshold).

**Actual Behavior**:  
Audio and video can be 500ms-2000ms out of sync.

---

## Root Cause Analysis

### 1. Separate Track Transmission

Audio and video tracks may take different paths through the network:

```typescript
// Tracks added separately, may arrive at different times
peerConnection.addTrack(audioTrack, localStream);
peerConnection.addTrack(videoTrack, localStream);
```

### 2. No Synchronization Mechanism

The current implementation doesn't use RTP timestamp synchronization:

```typescript
// Current: Just plays streams as they arrive
videoElement.srcObject = remoteStream;
// No sync consideration
```

### 3. Network Jitter

Variable network latency affects audio and video differently because they use different packet sizes.

---

## Solution

### 1. Use Unified Stream Handling

```typescript
// frontend/src/utils/ProximityVideoCallHandler.ts

// Ensure both tracks are in the same stream
const combinedStream = new MediaStream();
combinedStream.addTrack(localStream.getAudioTracks()[0]);
combinedStream.addTrack(localStream.getVideoTracks()[0]);

// Add all tracks from the same stream
for (const track of combinedStream.getTracks()) {
  this.peerConnection.addTrack(track, combinedStream);
}
```

### 2. Implement Jitter Buffer

```typescript
class SyncedMediaPlayer {
  private audioBuffer: AudioBuffer[] = [];
  private videoBuffer: VideoFrame[] = [];
  private syncThreshold = 40; // ms

  queueAudioFrame(frame: AudioBuffer, timestamp: number): void {
    this.audioBuffer.push({ frame, timestamp });
    this.attemptSync();
  }

  queueVideoFrame(frame: VideoFrame, timestamp: number): void {
    this.videoBuffer.push({ frame, timestamp });
    this.attemptSync();
  }

  private attemptSync(): void {
    if (this.audioBuffer.length === 0 || this.videoBuffer.length === 0) {
      return;
    }

    const audio = this.audioBuffer[0];
    const video = this.videoBuffer[0];
    const diff = Math.abs(audio.timestamp - video.timestamp);

    if (diff <= this.syncThreshold) {
      // Play both
      this.playAudio(this.audioBuffer.shift()!.frame);
      this.playVideo(this.videoBuffer.shift()!.frame);
    } else if (audio.timestamp < video.timestamp) {
      // Audio is ahead, wait for matching video
      // or drop audio if too far behind
    } else {
      // Video is ahead, wait for matching audio
    }
  }
}
```

### 3. Use WebRTC Built-in Sync

```typescript
// Rely on browser's built-in A/V sync
peerConnection.ontrack = (event) => {
  // Use the stream directly, browser handles sync
  const [remoteStream] = event.streams;
  if (remoteStream) {
    videoElement.srcObject = remoteStream;
    // Don't create new MediaStream, use the provided one
  }
};
```

### 4. Configure SDP for Synchronization

```typescript
// Ensure proper SDP handling for sync
async function setRemoteDescription(sdp: RTCSessionDescriptionInit): Promise<void> {
  // The a=rtcp-mux attribute ensures audio/video share RTCP
  // This helps with synchronization
  await peerConnection.setRemoteDescription(sdp);
}
```

---

## Testing

1. Use network throttling in DevTools to simulate poor connections
2. Measure sync using clap test (clap hands, measure audio vs visible clap)
3. Test across different browsers (Chrome, Firefox, Safari)
4. Test mobile to desktop calls

---

## Prevention

1. **Always use the same MediaStream** for related audio/video
2. **Don't create new MediaStreams** from tracks unnecessarily
3. **Test on varied network conditions**
4. **Monitor WebRTC stats** for jitter and latency

---

## Related Issues

- **Related Bugs**: BUG-028 (audio echo), BUG-002 (black screen)
- **WebRTC Stats**: Use `getStats()` to monitor synchronization

---

## Notes

- Browser implementations vary in sync quality
- Mobile networks often have higher jitter
- Consider adaptive bitrate to reduce jitter impact
