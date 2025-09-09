import { CallManager } from './CallManager.js';
import { WebRTCHandler } from '../webrtc/WebRTCHandler.js';
import { User, CallSession } from '../../types/video-call.js';

/**
 * Enhanced Call Manager that integrates WebRTC functionality
 * Extends the base CallManager with media handling capabilities
 */
export class EnhancedCallManager extends CallManager {
  private webrtcHandler: WebRTCHandler;
  private mediaStreams: Map<string, { local: MediaStream | null; remote: MediaStream | null }> = new Map();

  constructor() {
    super();
    this.webrtcHandler = new WebRTCHandler();
    this.setupWebRTCHandlers();
  }

  /**
   * Initialize with WebRTC support
   */
  initialize(userId: string, socketConnection: any): void {
    super.initialize(userId, socketConnection);
    this.webrtcHandler.initialize(socketConnection);
  }

  /**
   * Initiate call with WebRTC media
   */
  async initiatePeerToPeerCall(targetUser: User): Promise<CallSession> {
    const callSession = await super.initiatePeerToPeerCall(targetUser);
    
    // Start WebRTC call
    try {
      await this.webrtcHandler.startCall(callSession.callId);
      this.mediaStreams.set(callSession.callId, {
        local: this.webrtcHandler.getLocalStream(),
        remote: null
      });
    } catch (error) {
      console.error('Failed to start WebRTC call:', error);
      this.endCall(callSession.callId);
      throw error;
    }

    return callSession;
  }

  /**
   * Accept call with WebRTC media
   */
  async acceptCall(callId: string): Promise<CallSession> {
    const callSession = await super.acceptCall(callId);
    
    // Answer WebRTC call
    try {
      await this.webrtcHandler.answerCall(callId);
      this.mediaStreams.set(callId, {
        local: this.webrtcHandler.getLocalStream(),
        remote: null
      });
    } catch (error) {
      console.error('Failed to answer WebRTC call:', error);
      this.endCall(callId);
      throw error;
    }

    return callSession;
  }

  /**
   * End call with WebRTC cleanup
   */
  endCall(callId: string): void {
    // Clean up WebRTC
    this.webrtcHandler.endCall();
    this.mediaStreams.delete(callId);
    
    // Call parent end call
    super.endCall(callId);
  }

  /**
   * Get local media stream for current call
   */
  getLocalStream(): MediaStream | null {
    return this.webrtcHandler.getLocalStream();
  }

  /**
   * Get remote media stream for current call
   */
  getRemoteStream(): MediaStream | null {
    return this.webrtcHandler.getRemoteStream();
  }

  /**
   * Toggle microphone mute
   */
  toggleMute(): boolean {
    return this.webrtcHandler.toggleMute();
  }

  /**
   * Toggle camera on/off
   */
  toggleCamera(): boolean {
    return this.webrtcHandler.toggleCamera();
  }

  /**
   * Get WebRTC connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.webrtcHandler.getConnectionState();
  }

  /**
   * Get media streams for a specific call
   */
  getCallMediaStreams(callId: string): { local: MediaStream | null; remote: MediaStream | null } | null {
    return this.mediaStreams.get(callId) || null;
  }

  /**
   * Setup WebRTC event handlers
   */
  private setupWebRTCHandlers(): void {
    this.webrtcHandler.on('local-stream', (stream: MediaStream) => {
      const currentCall = this.getCurrentCall();
      if (currentCall) {
        const streams = this.mediaStreams.get(currentCall.callId);
        if (streams) {
          streams.local = stream;
        }
      }
      this.emit('local-stream', stream);
    });

    this.webrtcHandler.on('remote-stream', (stream: MediaStream) => {
      const currentCall = this.getCurrentCall();
      if (currentCall) {
        const streams = this.mediaStreams.get(currentCall.callId);
        if (streams) {
          streams.remote = stream;
        }
      }
      this.emit('remote-stream', stream);
    });

    this.webrtcHandler.on('call-connected', () => {
      const currentCall = this.getCurrentCall();
      if (currentCall) {
        this.updateCallStatus(currentCall.callId, 'active');
      }
      this.emit('webrtc-connected');
    });

    this.webrtcHandler.on('call-disconnected', () => {
      this.emit('webrtc-disconnected');
    });

    this.webrtcHandler.on('connection-state-change', (state: RTCPeerConnectionState) => {
      this.emit('connection-state-change', state);
    });

    this.webrtcHandler.on('mute-toggled', (isMuted: boolean) => {
      this.emit('mute-toggled', isMuted);
    });

    this.webrtcHandler.on('camera-toggled', (isCameraOff: boolean) => {
      this.emit('camera-toggled', isCameraOff);
    });

    this.webrtcHandler.on('media-error', (error: any) => {
      this.emit('media-error', error);
    });

    this.webrtcHandler.on('error', (error: any) => {
      this.emit('webrtc-error', error);
    });
  }

  /**
   * Get enhanced status including WebRTC info
   */
  getEnhancedStatus(): {
    hasActiveCall: boolean;
    activeCallId: string | null;
    incomingCallsCount: number;
    isInitialized: boolean;
    hasLocalStream: boolean;
    hasRemoteStream: boolean;
    connectionState: RTCPeerConnectionState | null;
  } {
    const baseStatus = this.getStatus();
    
    return {
      ...baseStatus,
      hasLocalStream: !!this.getLocalStream(),
      hasRemoteStream: !!this.getRemoteStream(),
      connectionState: this.getConnectionState()
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.webrtcHandler.destroy();
    this.mediaStreams.clear();
    super.destroy();
  }
}