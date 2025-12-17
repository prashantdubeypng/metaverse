# BUG-028: Audio Echo in Video Calls

## Bug Information

**Bug ID**: BUG-028  
**Title**: Audio Echo/Feedback When Multiple Users in Proximity  
**Severity**: High  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When 3 or more users are in proximity and video calls are established, audio echo and feedback loops occur. Users hear their own voice delayed, and sometimes audio from other calls bleeds through. This makes group conversations unusable.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Handler | `frontend/src/utils/ProximityVideoCallHandler.ts` | Frontend |
| Video Call Manager | `frontend/src/services/proximityVideoCall.ts` | Frontend |
| Call Controls | `frontend/src/components/CallControls.tsx` | Frontend |

---

## Reproduction Steps

1. Open application in 3 browser windows (User A, B, C)
2. All users join the same space
3. All users move within 2 tiles of each other
4. Users A-B, B-C, and A-C all establish video calls
5. User A speaks
6. User A hears echo of their voice
7. Audio quality degrades with each additional user

**Expected Behavior**:  
Clear audio without echo for all participants.

**Actual Behavior**:  
Audio echo, feedback loops, and cross-talk between calls.

---

## Root Cause Analysis

### 1. Lack of Acoustic Echo Cancellation Configuration

The WebRTC audio constraints don't properly configure echo cancellation:

```typescript
// Current configuration may be insufficient
const audioConstraints = {
  audio: true
};

// Should include advanced AEC settings
const audioConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};
```

### 2. Multiple Audio Outputs Not Muted

When User A has calls with both B and C, they receive audio from B and C. If B and C can hear each other (through their own call), A's audio goes to B, B's speaker plays it, and B's mic picks it up → sending it back to A.

```
A speaks → B receives → B's speaker plays → 
B's mic picks up → Sends back to A (echo!)
```

### 3. No Simultaneous Output Mixing

Each peer connection creates its own audio element, which can cause:
- Multiple overlapping audio streams
- No proper mixing of audio levels
- Browser audio conflicts

---

## Solution

### 1. Configure Proper Audio Constraints

```typescript
// frontend/src/utils/ProximityVideoCallHandler.ts

async initLocalStream(): Promise<MediaStream> {
  this.localStream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 },
      frameRate: { ideal: 15 }
    },
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      // Advanced AEC
      googEchoCancellation: true,
      googAutoGainControl: true,
      googNoiseSuppression: true,
      googHighpassFilter: true,
      googAudioMirroring: false,
      googNoiseReduction: true
    }
  });
  
  return this.localStream;
}
```

### 2. Implement Audio Level Detection and Duck

```typescript
// frontend/src/utils/audioManager.ts

class AudioManager {
  private audioContext: AudioContext;
  private activeStreams: Map<string, { 
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    gainNode: GainNode;
  }> = new Map();

  constructor() {
    this.audioContext = new AudioContext();
  }

  addRemoteStream(userId: string, stream: MediaStream): void {
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    const gainNode = this.audioContext.createGain();
    
    source.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    this.activeStreams.set(userId, { source, analyser, gainNode });
  }

  // Reduce volume of other streams when local user is speaking
  duckAudioWhenSpeaking(isSpeaking: boolean): void {
    const duckLevel = isSpeaking ? 0.3 : 1.0;
    
    this.activeStreams.forEach(({ gainNode }) => {
      // Smooth transition
      gainNode.gain.setTargetAtTime(duckLevel, this.audioContext.currentTime, 0.1);
    });
  }

  removeStream(userId: string): void {
    const stream = this.activeStreams.get(userId);
    if (stream) {
      stream.source.disconnect();
      stream.analyser.disconnect();
      stream.gainNode.disconnect();
      this.activeStreams.delete(userId);
    }
  }
}

export const audioManager = new AudioManager();
```

### 3. Detect and Suppress Echo

```typescript
// frontend/src/utils/echoDetector.ts

class EchoDetector {
  private localAudioBuffer: Float32Array[] = [];
  private readonly bufferSize = 10; // Keep 10 samples
  private readonly similarity threshold = 0.7;

  // Store local audio samples for comparison
  captureLocalAudio(audioData: Float32Array): void {
    this.localAudioBuffer.push(new Float32Array(audioData));
    if (this.localAudioBuffer.length > this.bufferSize) {
      this.localAudioBuffer.shift();
    }
  }

  // Check if incoming audio matches recent local audio (echo)
  isEcho(incomingAudio: Float32Array): boolean {
    for (const localSample of this.localAudioBuffer) {
      const similarity = this.calculateSimilarity(localSample, incomingAudio);
      if (similarity > this.similarityThreshold) {
        console.log('🔇 Echo detected, suppressing');
        return true;
      }
    }
    return false;
  }

  private calculateSimilarity(a: Float32Array, b: Float32Array): number {
    // Cross-correlation for similarity detection
    // Simplified - real implementation needs proper DSP
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }
    return sum / len;
  }
}
```

### 4. Use Single Audio Context and Proper Mixing

```typescript
// frontend/src/utils/proximityAudioMixer.ts

class ProximityAudioMixer {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private remoteAudios: Map<string, {
    element: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    gain: GainNode;
    panner: PannerNode;
  }> = new Map();

  constructor() {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  addRemoteUser(userId: string, stream: MediaStream, distance: number): void {
    // Create audio element (muted to prevent double play)
    const audioEl = document.createElement('audio');
    audioEl.srcObject = stream;
    audioEl.muted = true; // We'll use Web Audio API for output
    audioEl.play();

    // Create audio graph
    const source = this.audioContext.createMediaElementSource(audioEl);
    const gain = this.audioContext.createGain();
    const panner = this.audioContext.createPanner();

    // Configure panner for 3D audio based on relative position
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.masterGain);

    // Set initial distance-based volume
    this.updateUserVolume(userId, distance);

    this.remoteAudios.set(userId, { element: audioEl, source, gain, panner });
  }

  updateUserVolume(userId: string, distance: number): void {
    const audio = this.remoteAudios.get(userId);
    if (!audio) return;

    // Volume falls off with distance (2 tiles = full volume)
    const maxDistance = 10; // tiles
    const volume = Math.max(0, 1 - (distance / maxDistance));
    
    audio.gain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.1);
  }

  updateUserPosition(userId: string, relativeX: number, relativeY: number): void {
    const audio = this.remoteAudios.get(userId);
    if (!audio) return;

    // Update 3D position for spatial audio
    audio.panner.positionX.setTargetAtTime(relativeX, this.audioContext.currentTime, 0.1);
    audio.panner.positionY.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
    audio.panner.positionZ.setTargetAtTime(relativeY, this.audioContext.currentTime, 0.1);
  }

  removeUser(userId: string): void {
    const audio = this.remoteAudios.get(userId);
    if (audio) {
      audio.element.pause();
      audio.element.srcObject = null;
      audio.source.disconnect();
      audio.gain.disconnect();
      audio.panner.disconnect();
      this.remoteAudios.delete(userId);
    }
  }
}

export const proximityAudioMixer = new ProximityAudioMixer();
```

### 5. Mute Audio When Video Panel Not Active

```typescript
// frontend/src/components/VideoCallPanel.tsx

interface Props {
  userId: string;
  stream: MediaStream;
  isMinimized: boolean;
}

const VideoCallPanel: React.FC<Props> = ({ userId, stream, isMinimized }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      // Mute audio when minimized to reduce echo sources
      audioRef.current.muted = isMinimized;
    }
  }, [isMinimized]);

  return (
    <div className={isMinimized ? 'minimized' : ''}>
      <video autoPlay playsInline muted /> {/* Video always muted */}
      <audio ref={audioRef} autoPlay /> {/* Audio separate */}
    </div>
  );
};
```

---

## Testing

### Test Scenarios

1. **Two-User Call**: Verify no echo between two users
2. **Three-User Proximity**: Verify no feedback loops
3. **Speaker Test**: Play music through speakers, verify not transmitted
4. **Headphone Test**: Confirm no echo with headphones
5. **Distance Test**: Verify volume decreases with distance

### Automated Audio Testing

```javascript
// Test echo cancellation is working
async function testEchoCancellation() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const track = stream.getAudioTracks()[0];
  const settings = track.getSettings();
  
  console.log('Audio Settings:', {
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl
  });
  
  // All should be true
  if (!settings.echoCancellation) {
    console.warn('⚠️ Echo cancellation not enabled!');
  }
}
```

---

## Prevention

1. **Always configure audio constraints** with echo cancellation
2. **Use Web Audio API** for multi-stream mixing
3. **Implement voice activity detection** to reduce background noise
4. **Test with speakers** not just headphones
5. **Consider push-to-talk** option for noisy environments

---

## Related Issues

- **Related Bugs**: BUG-005 (audio out of sync), BUG-003 (ICE failures can cause audio issues)
- **Feature Request**: Add push-to-talk option
- **UX**: Show audio level indicator so users know when they're transmitting

---

## Notes

- Chrome has best AEC support
- Firefox AEC is improving but may have issues
- Safari has known WebRTC audio issues
- Hardware echo cancellation (headphones) is most reliable
- Consider adding noise gate to reduce background noise
