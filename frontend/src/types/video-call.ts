// Video Call Type Definitions
export interface Position3D {
  x: number;
  y: number;
  z?: number;
}

export interface User {
  id: string;
  username: string;
  x: number;
  y: number;
  isCurrentUser?: boolean;
  avatar?: string;
  isOnline?: boolean;
}

export interface CallSession {
  id: string;
  callerId: string;
  calleeId: string;
  status: 'initiating' | 'ringing' | 'active' | 'ended';
  startTime: Date;
  endTime?: Date;
  type: 'peer-to-peer';
}

export interface IncomingCall {
  id: string;
  callerId: string;
  callerUsername: string;
  callerAvatar?: string;
  timestamp: Date;
  type: 'peer-to-peer';
}

export type CallState = 'idle' | 'initiating' | 'calling' | 'incoming' | 'accepting' | 'active' | 'ending';

export interface VideoCallState {
  // Current user state
  currentPosition: Position3D;
  isInCall: boolean;
  
  // Nearby users for calling
  nearbyUsers: User[];
  
  // Active call state
  activeCall: CallSession | null;
  incomingCalls: IncomingCall[];
  
  // Media state
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-end';
  callId: string;
  senderId: string;
  receiverId: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidate | { reason?: string };
}

// WebSocket Events for Video Calls
export interface VideoCallWebSocketEvents {
  'incoming-call': IncomingCall;
  'call-accepted': { callId: string; calleeId: string };
  'call-rejected': { callId: string; calleeId: string; reason?: string };
  'call-ended': { callId: string; endedBy: string; reason?: string };
  'proximity-update': { nearbyUsers: User[]; userPosition: Position3D };
  'webrtc-signal': SignalingMessage;
  // New proximity video call events
  'video-call-start': ProximityCallStart;
  'video-call-signaling': ProximityCallSignaling;
  'video-call-end': ProximityCallEnd;
  'users-in-video-call': UsersInVideoCall;
}

// Proximity Video Call Types
export interface ProximityCallStart {
  callId: string;
  participants: Array<{
    userId: string;
    username: string;
    x: number;
    y: number;
  }>;
  isProximityCall: boolean;
}

export interface ProximityCallSignaling {
  callId: string;
  fromUserId: string;
  signalingData: {
    type: 'offer' | 'answer' | 'ice-candidate';
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidate;
  };
}

export interface ProximityCallEnd {
  callId: string;
  reason: 'proximity_lost' | 'user_ended' | 'user_disconnected' | 'error';
}

export interface UsersInVideoCall {
  userIds: string[];
  callId: string;
}

// Call Manager Events
export interface CallManagerEvents {
  'incoming-call': { incomingCall: IncomingCall };
  'call-accepted': { callSession: CallSession };
  'call-rejected': { callId: string; reason?: string };
  'call-ended': { callId: string; reason?: string };
  'call-error': { error: string; callId?: string };
}

// Proximity Manager Events
export interface ProximityManagerEvents {
  'user-entered-range': { user: User; distance: number };
  'user-left-range': { userId: string };
  'proximity-update': { nearbyUsers: User[] };
}
