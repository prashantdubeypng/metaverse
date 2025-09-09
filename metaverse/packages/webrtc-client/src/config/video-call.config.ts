import { RTCConfig, MediaConfig } from '../types/video-call.js';

// WebRTC Configuration
export const DEFAULT_RTC_CONFIG: RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'username',
    //   credential: 'password'
    // }
  ],
  iceCandidatePoolSize: 10
};

// Media Constraints
export const DEFAULT_MEDIA_CONFIG: MediaConfig = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

// Feature Configuration
export const VIDEO_CALL_CONFIG = {
  proximityRange: 10, // Fixed 10-unit range for MVP
  callRequestTimeout: 30000, // 30 seconds
  positionUpdateInterval: 100, // 100ms
  proximityCheckInterval: 200, // 200ms
  maxReconnectionAttempts: 3,
  spatialGridCellSize: 10, // Based on proximity range
  enableAudioFallback: true,
  enableQualityAdaptation: true
} as const;