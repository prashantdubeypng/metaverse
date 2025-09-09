// Frontend-specific video call types extending backend types
import { Position3D, User, CallSession, IncomingCall } from './video-call.js';

export interface VideoCallState {
  // Connection state
  isInitialized: boolean;
  isConnected: boolean;
  
  // User state
  currentPosition: Position3D | null;
  currentUser: User | null;
  
  // Proximity state
  nearbyUsers: User[];
  isProximityActive: boolean;
  
  // Call state
  activeCall: CallSession | null;
  incomingCalls: IncomingCall[];
  isInCall: boolean;
  
  // Media state
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  volume: number;
  
  // UI state
  showIncomingCallModal: boolean;
  showNearbyUsers: boolean;
  callDuration: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

export interface VideoCallActions {
  // Initialization
  initialize: (userId: string, websocket: WebSocket) => Promise<void>;
  cleanup: () => void;
  
  // Position management
  updatePosition: (x: number, y: number, z: number) => void;
  startProximityTracking: () => void;
  stopProximityTracking: () => void;
  
  // Call management
  initiateCall: (targetUser: User) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => void;
  endCall: () => void;
  
  // Media controls
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  setVolume: (volume: number) => void;
  
  // UI controls
  showNearbyUsersPanel: () => void;
  hideNearbyUsersPanel: () => void;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
}

export interface MediaConstraints {
  video: MediaTrackConstraints;
  audio: MediaTrackConstraints;
}

export interface CallControlsProps {
  isInCall: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  volume: number;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onVolumeChange: (volume: number) => void;
  onEndCall: () => void;
}

export interface VideoCallInterfaceProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isInCall: boolean;
  callDuration: number;
  connectionQuality: VideoCallState['connectionQuality'];
  remoteUser: User | null;
  onEndCall: () => void;
}

export interface IncomingCallModalProps {
  incomingCall: IncomingCall | null;
  isVisible: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export interface NearbyUsersPanelProps {
  nearbyUsers: User[];
  currentUser: User | null;
  isVisible: boolean;
  onCallUser: (user: User) => void;
  onClose: () => void;
}

export interface ProximityIndicatorProps {
  currentPosition: Position3D | null;
  nearbyUsers: User[];
  proximityRange: number;
  isActive: boolean;
}