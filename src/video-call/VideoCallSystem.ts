import { EnhancedCallManager } from './calling/EnhancedCallManager.js';
import { ProximityManager } from './proximity/ProximityManager.js';
import { User, Position3D, CallSession, IncomingCall } from '../types/video-call.js';

/**
 * Main Video Call System that coordinates all components
 * This is the primary interface for integrating video calls into your frontend
 */
export class VideoCallSystem {
  private callManager: EnhancedCallManager;
  private proximityManager: ProximityManager;
  private currentUserId: string | null = null;
  private socketConnection: any = null;
  private isInitialized: boolean = false;

  // State tracking
  private currentPosition: Position3D | null = null;
  private nearbyUsers: User[] = [];
  private activeCall: CallSession | null = null;
  private incomingCalls: IncomingCall[] = [];

  // Media state
  private isMuted: boolean = false;
  private isCameraOn: boolean = true;

  constructor() {
    this.callManager = new EnhancedCallManager();
    this.proximityManager = new ProximityManager();
    this.setupEventHandlers();
  }

  /**
   * Initialize the video call system
   */
  async initialize(userId: string, socketConnection: any): Promise<void> {
    this.currentUserId = userId;
    this.socketConnection = socketConnection;

    // Initialize managers
    this.callManager.initialize(userId, socketConnection);
    this.proximityManager.initialize(socketConnection);

    // Start proximity tracking
    this.proximityManager.start();

    this.isInitialized = true;
  }

  /**
   * Update user position for proximity detection
   */
  updatePosition(x: number, y: number, z: number): void {
    this.currentPosition = { x, y, z, timestamp: Date.now() };
    this.proximityManager.updatePosition(x, y, z);
  }

  /**
   * Get nearby users available for calling
   */
  getNearbyUsers(): User[] {
    return this.nearbyUsers;
  }

  /**
   * Initiate a call to a nearby user
   */
  async initiateCall(targetUser: User): Promise<CallSession> {
    if (!this.isInitialized) {
      throw new Error('Video call system not initialized');
    }

    const callSession = await this.callManager.initiatePeerToPeerCall(targetUser);
    this.activeCall = callSession;
    return callSession;
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string): Promise<CallSession> {
    const callSession = await this.callManager.acceptCall(callId);
    this.activeCall = callSession;
    
    // Remove from incoming calls
    this.incomingCalls = this.incomingCalls.filter(call => call.callId !== callId);
    
    return callSession;
  }

  /**
   * Reject an incoming call
   */
  rejectCall(callId: string): void {
    this.callManager.rejectCall(callId);
    
    // Remove from incoming calls
    this.incomingCalls = this.incomingCalls.filter(call => call.callId !== callId);
  }

  /**
   * End the current call
   */
  endCall(): void {
    if (this.activeCall) {
      this.callManager.endCall(this.activeCall.callId);
      this.activeCall = null;
    }
  }

  /**
   * Toggle microphone mute
   */
  toggleMute(): boolean {
    this.isMuted = this.callManager.toggleMute();
    return this.isMuted;
  }

  /**
   * Toggle camera on/off
   */
  toggleCamera(): boolean {
    const isCameraOff = this.callManager.toggleCamera();
    this.isCameraOn = !isCameraOff;
    return this.isCameraOn;
  }

  /**
   * Get local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.callManager.getLocalStream();
  }

  /**
   * Get remote media stream
   */
  getRemoteStream(): MediaStream | null {
    return this.callManager.getRemoteStream();
  }

  /**
   * Get current call session
   */
  getCurrentCall(): CallSession | null {
    return this.activeCall;
  }

  /**
   * Get incoming calls
   */
  getIncomingCalls(): IncomingCall[] {
    return this.incomingCalls;
  }

  /**
   * Check if user is currently in a call
   */
  isInCall(): boolean {
    return !!this.activeCall && this.activeCall.status === 'active';
  }

  /**
   * Get current position
   */
  getCurrentPosition(): Position3D | null {
    return this.currentPosition;
  }

  /**
   * Get system status
   */
  getStatus(): {
    isInitialized: boolean;
    isInCall: boolean;
    hasActiveCall: boolean;
    nearbyUsersCount: number;
    incomingCallsCount: number;
    currentPosition: Position3D | null;
    isMuted: boolean;
    isCameraOn: boolean;
    hasLocalStream: boolean;
    hasRemoteStream: boolean;
    connectionState: RTCPeerConnectionState | null;
  } {
    return {
      isInitialized: this.isInitialized,
      isInCall: this.isInCall(),
      hasActiveCall: !!this.activeCall,
      nearbyUsersCount: this.nearbyUsers.length,
      incomingCallsCount: this.incomingCalls.length,
      currentPosition: this.currentPosition,
      isMuted: this.isMuted,
      isCameraOn: this.isCameraOn,
      hasLocalStream: !!this.getLocalStream(),
      hasRemoteStream: !!this.getRemoteStream(),
      connectionState: this.callManager.getConnectionState()
    };
  }

  /**
   * Setup event handlers for all managers
   */
  private setupEventHandlers(): void {
    // Proximity events
    this.proximityManager.on('proximity-updated', (users: User[]) => {
      this.nearbyUsers = users;
    });

    this.proximityManager.on('user-entered-range', ({ user }: { user: User }) => {
      console.log(`User ${user.username} entered range`);
    });

    this.proximityManager.on('user-left-range', ({ userId }: { userId: string }) => {
      console.log(`User ${userId} left range`);
    });

    // Call events
    this.callManager.on('incoming-call', ({ incomingCall }: { incomingCall: IncomingCall }) => {
      this.incomingCalls.push(incomingCall);
      console.log(`Incoming call from ${incomingCall.fromUser.username}`);
    });

    this.callManager.on('call-accepted', ({ callSession }: { callSession: CallSession }) => {
      this.activeCall = callSession;
      console.log('Call accepted');
    });

    this.callManager.on('call-rejected', ({ callSession }: { callSession: CallSession }) => {
      if (this.activeCall?.callId === callSession.callId) {
        this.activeCall = null;
      }
      console.log('Call rejected');
    });

    this.callManager.on('call-ended', ({ callSession }: { callSession: CallSession }) => {
      if (this.activeCall?.callId === callSession.callId) {
        this.activeCall = null;
      }
      console.log('Call ended');
    });

    this.callManager.on('call-failed', ({ callId, error }: { callId: string; error: string }) => {
      if (this.activeCall?.callId === callId) {
        this.activeCall = null;
      }
      console.error('Call failed:', error);
    });

    // WebRTC events
    this.callManager.on('local-stream', (stream: MediaStream) => {
      console.log('Local stream available');
    });

    this.callManager.on('remote-stream', (stream: MediaStream) => {
      console.log('Remote stream available');
    });

    this.callManager.on('webrtc-connected', () => {
      console.log('WebRTC connection established');
    });

    this.callManager.on('connection-state-change', (state: RTCPeerConnectionState) => {
      console.log('Connection state changed:', state);
    });

    this.callManager.on('mute-toggled', (isMuted: boolean) => {
      this.isMuted = isMuted;
      console.log('Mute toggled:', isMuted);
    });

    this.callManager.on('camera-toggled', (isCameraOff: boolean) => {
      this.isCameraOn = !isCameraOff;
      console.log('Camera toggled:', !isCameraOff);
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.proximityManager.destroy();
    this.callManager.destroy();
    
    this.currentUserId = null;
    this.socketConnection = null;
    this.isInitialized = false;
    this.nearbyUsers = [];
    this.activeCall = null;
    this.incomingCalls = [];
  }
}