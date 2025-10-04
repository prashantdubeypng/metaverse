// Core data models for video call feature
import './webrtc';

export interface Position3D {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface UserPosition {
  userId: string;
  position: Position3D;
  isAvailable: boolean;
  proximityRange: 10; // Fixed at 10 for MVP
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  status: 'available' | 'unavailable' | 'in-call' | 'do-not-disturb';
  position: Position3D;
  blockedUsers: string[];
  friends: string[];
  privacySettings: {
    allowCallsFromStrangers: boolean;
    proximityVisible: boolean;
  };
}

export interface CallSession {
  callId: string;
  type: 'peer-to-peer';
  participants: [string, string]; // Always 2 for peer-to-peer
  status: 'pending' | 'connecting' | 'active' | 'ended';
  createdAt: Date;
  connectedAt?: Date;
  endedAt?: Date;
}

export interface IncomingCall {
  callId: string;
  type: 'peer-to-peer';
  fromUser: User;
  expiresAt: Date;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-end';
  callId: string;
  payload: any;
  timestamp: Date;
}

// WebRTC Configuration
export interface RTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
}

export interface MediaConfig {
  video: MediaTrackConstraints;
  audio: MediaTrackConstraints;
}

// Event types for the video call system
export type ProximityEvent = {
  type: 'user-entered-range' | 'user-left-range' | 'proximity-updated';
  userId: string;
  user?: User;
  nearbyUsers?: User[];
};

export type CallEvent = {
  type: 'incoming-call' | 'call-accepted' | 'call-rejected' | 'call-ended' | 'call-failed';
  callId: string;
  call?: IncomingCall;
  error?: string;
};

// Constants
export const PROXIMITY_RANGE = 10; // Fixed 10-unit range for MVP
export const CALL_REQUEST_TIMEOUT = 30000; // 30 seconds
export const POSITION_UPDATE_INTERVAL = 100; // 100ms
export const PROXIMITY_CHECK_INTERVAL = 200; // 200ms