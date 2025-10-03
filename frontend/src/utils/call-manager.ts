import { 
  CallSession, 
  IncomingCall, 
  SignalingMessage,
  User
} from '@/types/video-call';
import { WebRTCHandler } from '@/utils/webrtc-handler';

export class CallManager {
  private websocket: WebSocket | null = null;
  private userId: string | null = null;
  private webrtcHandler: WebRTCHandler | null = null;
  private activeCall: CallSession | null = null;
  private incomingCalls: Map<string, IncomingCall> = new Map();
  
  // Event listeners with simpler type handling
  private eventListeners: Record<string, ((data: unknown) => void)[]> = {};

  constructor() {}

  initialize(userId: string, websocket: WebSocket): void {
    this.userId = userId;
    this.websocket = websocket;
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
    if (!this.websocket) return;

    this.websocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'incoming-call':
          this.handleIncomingCall(message.payload);
          break;
        case 'call-accepted':
          this.handleCallAccepted(message.payload);
          break;
        case 'call-rejected':
          this.handleCallRejected(message.payload);
          break;
        case 'call-ended':
          this.handleCallEnded(message.payload);
          break;
        case 'webrtc-signal':
          this.handleWebRTCSignal(message.payload);
          break;
      }
    });
  }

  async initiatePeerToPeerCall(targetUser: User): Promise<CallSession | null> {
    if (!this.userId || !this.websocket) {
      this.emit('call-error', { error: 'Not initialized' });
      return null;
    }

    if (this.activeCall) {
      this.emit('call-error', { error: 'Already in a call' });
      return null;
    }

    try {
      const callId = `call_${this.userId}_${targetUser.id}_${Date.now()}`;
      const callSession: CallSession = {
        id: callId,
        callerId: this.userId,
        calleeId: targetUser.id,
        status: 'initiating',
        startTime: new Date(),
        type: 'peer-to-peer'
      };

      this.activeCall = callSession;

      // Initialize WebRTC handler
      this.webrtcHandler = new WebRTCHandler(
        this.userId,
        (stream) => this.handleRemoteStream(stream),
        (state) => this.handleConnectionStateChange(state),
        (message) => this.sendSignalingMessage(message),
        (error) => this.emit('call-error', { error, callId })
      );

      // Get user media and start the call
      await this.webrtcHandler.initializeLocalStream();
      await this.webrtcHandler.startCall(callId, targetUser.id);

      // Send call initiation message
      this.websocket.send(JSON.stringify({
        type: 'initiate-call',
        payload: {
          callId,
          targetUserId: targetUser.id,
          callType: 'peer-to-peer'
        }
      }));

      callSession.status = 'ringing';
      return callSession;

    } catch (error) {
      this.emit('call-error', { 
        error: `Failed to initiate call: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      this.activeCall = null;
      return null;
    }
  }

  async acceptIncomingCall(callId: string): Promise<boolean> {
    const incomingCall = this.incomingCalls.get(callId);
    if (!incomingCall || !this.userId) {
      return false;
    }

    try {
      // Create call session
      const callSession: CallSession = {
        id: callId,
        callerId: incomingCall.callerId,
        calleeId: this.userId,
        status: 'active',
        startTime: new Date(),
        type: 'peer-to-peer'
      };

      this.activeCall = callSession;

      // Initialize WebRTC handler
      this.webrtcHandler = new WebRTCHandler(
        this.userId,
        (stream) => this.handleRemoteStream(stream),
        (state) => this.handleConnectionStateChange(state),
        (message) => this.sendSignalingMessage(message),
        (error) => this.emit('call-error', { error, callId })
      );

      await this.webrtcHandler.acceptCall(callId, incomingCall.callerId);

      // Send acceptance message
      if (this.websocket) {
        this.websocket.send(JSON.stringify({
          type: 'accept-call',
          payload: { callId }
        }));
      }

      // Remove from incoming calls
      this.incomingCalls.delete(callId);

      this.emit('call-accepted', { callSession });
      return true;

    } catch (error) {
      this.emit('call-error', { 
        error: `Failed to accept call: ${error instanceof Error ? error.message : 'Unknown error'}`,
        callId 
      });
      return false;
    }
  }

  rejectIncomingCall(callId: string, reason?: string): boolean {
    const incomingCall = this.incomingCalls.get(callId);
    if (!incomingCall || !this.websocket) {
      return false;
    }

    this.websocket.send(JSON.stringify({
      type: 'reject-call',
      payload: { callId, reason }
    }));

    this.incomingCalls.delete(callId);
    return true;
  }

  endCurrentCall(reason?: string): void {
    if (!this.activeCall) return;

    const callId = this.activeCall.id;

    // End WebRTC call
    if (this.webrtcHandler) {
      this.webrtcHandler.endCall();
      this.webrtcHandler = null;
    }

    // Send end call message
    if (this.websocket) {
      this.websocket.send(JSON.stringify({
        type: 'end-call',
        payload: { callId, reason }
      }));
    }

    this.activeCall.status = 'ended';
    this.activeCall.endTime = new Date();
    this.activeCall = null;

    this.emit('call-ended', { callId, reason });
  }

  // Event handling methods
  private handleIncomingCall(data: IncomingCall): void {
    this.incomingCalls.set(data.id, data);
    this.emit('incoming-call', { incomingCall: data });
  }

  private handleCallAccepted(data: { callId: string; calleeId: string }): void {
    if (this.activeCall && this.activeCall.id === data.callId) {
      this.activeCall.status = 'active';
      this.emit('call-accepted', { callSession: this.activeCall });
    }
  }

  private handleCallRejected(data: { callId: string; calleeId: string; reason?: string }): void {
    if (this.activeCall && this.activeCall.id === data.callId) {
      this.activeCall.status = 'ended';
      this.activeCall = null;
      
      if (this.webrtcHandler) {
        this.webrtcHandler.endCall();
        this.webrtcHandler = null;
      }
    }
    
    this.emit('call-rejected', { callId: data.callId, reason: data.reason });
  }

  private handleCallEnded(data: { callId: string; endedBy: string; reason?: string }): void {
    if (this.activeCall && this.activeCall.id === data.callId) {
      this.activeCall.status = 'ended';
      this.activeCall.endTime = new Date();
      this.activeCall = null;

      if (this.webrtcHandler) {
        this.webrtcHandler.endCall();
        this.webrtcHandler = null;
      }
    }

    // Remove from incoming calls if it exists
    this.incomingCalls.delete(data.callId);
    
    this.emit('call-ended', { callId: data.callId, reason: data.reason });
  }

  private handleWebRTCSignal(data: SignalingMessage): void {
    if (this.webrtcHandler) {
      this.webrtcHandler.handleSignalingMessage(data);
    }
  }

  private sendSignalingMessage(message: SignalingMessage): void {
    if (this.websocket) {
      this.websocket.send(JSON.stringify({
        type: 'webrtc-signal',
        payload: message
      }));
    }
  }

  private handleRemoteStream(stream: MediaStream): void {
    // This will be handled by the UI components
    console.log('Remote stream received:', stream);
  }

  private handleConnectionStateChange(state: RTCPeerConnectionState): void {
    console.log('Connection state changed:', state);
    
    if (state === 'connected' && this.activeCall) {
      this.activeCall.status = 'active';
    } else if (state === 'failed' || state === 'disconnected') {
      this.endCurrentCall('Connection failed');
    }
  }

  // Event management with simplified typing
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event]!.push(callback);
  }

  off(event: string, callback: (data: unknown) => void): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event]!.filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data: unknown): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event]!.forEach(callback => callback(data));
    }
  }

  // Utility methods
  toggleMute(): boolean {
    return this.webrtcHandler ? this.webrtcHandler.toggleAudio() : false;
  }

  toggleCamera(): boolean {
    return this.webrtcHandler ? this.webrtcHandler.toggleVideo() : false;
  }

  async startScreenShare(): Promise<MediaStream | null> {
    return this.webrtcHandler ? this.webrtcHandler.startScreenShare() : null;
  }

  async stopScreenShare(): Promise<void> {
    if (this.webrtcHandler) {
      await this.webrtcHandler.stopScreenShare();
    }
  }

  getActiveCall(): CallSession | null {
    return this.activeCall;
  }

  getIncomingCalls(): IncomingCall[] {
    return Array.from(this.incomingCalls.values());
  }

  getLocalStream(): MediaStream | null {
    return this.webrtcHandler ? this.webrtcHandler.getLocalStream() : null;
  }

  getRemoteStream(): MediaStream | null {
    return this.webrtcHandler ? this.webrtcHandler.getRemoteStream() : null;
  }

  isInCall(): boolean {
    return this.activeCall !== null && this.activeCall.status === 'active';
  }
}
