import { EventEmitter } from 'events';
import { 
  CallSession, 
  IncomingCall, 
  User, 
  CallEvent, 
  CALL_REQUEST_TIMEOUT 
} from '../../types/video-call.js';
import { canInitiateCall, isValidUser } from '../../utils/validation.js';
import { VIDEO_CALL_CONFIG } from '../../config/video-call.config.js';

/**
 * Client-side call manager for peer-to-peer video calls
 * Handles call initiation, incoming call management, and call state tracking
 */
export class CallManager extends EventEmitter {
  private activeCalls: Map<string, CallSession> = new Map();
  private incomingCalls: Map<string, IncomingCall> = new Map();
  private callTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private currentUserId: string | null = null;
  private socketConnection: any = null;

  constructor() {
    super();
  }

  /**
   * Initialize call manager with user ID and socket connection
   */
  initialize(userId: string, socketConnection: any): void {
    this.currentUserId = userId;
    this.socketConnection = socketConnection;
    this.setupSocketHandlers();
  }

  /**
   * Initiate a peer-to-peer call to a target user
   */
  async initiatePeerToPeerCall(targetUser: User): Promise<CallSession> {
    if (!this.currentUserId || !this.socketConnection) {
      throw new Error('CallManager not properly initialized');
    }

    if (!isValidUser(targetUser)) {
      throw new Error('Invalid target user data');
    }

    // Check if we can initiate the call
    const currentUser = await this.getCurrentUser();
    const eligibilityCheck = canInitiateCall(currentUser, targetUser);
    
    if (!eligibilityCheck.canCall) {
      throw new Error(eligibilityCheck.reason || 'Cannot initiate call');
    }

    // Check if already in a call
    if (this.hasActiveCall()) {
      throw new Error('Already in an active call');
    }

    // Create call session
    const callId = this.generateCallId();
    const callSession: CallSession = {
      callId,
      type: 'peer-to-peer',
      participants: [this.currentUserId, targetUser.id],
      status: 'pending',
      createdAt: new Date()
    };

    this.activeCalls.set(callId, callSession);

    // Set up call timeout
    const timeout = setTimeout(() => {
      this.handleCallTimeout(callId);
    }, CALL_REQUEST_TIMEOUT);
    
    this.callTimeouts.set(callId, timeout);

    // Send call request to server
    this.socketConnection.emit('call-request', {
      callId,
      targetUserId: targetUser.id,
      type: 'peer-to-peer'
    });

    this.emit('call-initiated', { callSession });
    
    return callSession;
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string): Promise<CallSession> {
    const incomingCall = this.incomingCalls.get(callId);
    if (!incomingCall) {
      throw new Error('Incoming call not found');
    }

    // Check if already in a call
    if (this.hasActiveCall()) {
      throw new Error('Already in an active call');
    }

    // Create call session
    const callSession: CallSession = {
      callId,
      type: 'peer-to-peer',
      participants: [this.currentUserId!, incomingCall.fromUser.id],
      status: 'connecting',
      createdAt: incomingCall.expiresAt, // Use original creation time
      connectedAt: new Date()
    };

    this.activeCalls.set(callId, callSession);
    this.incomingCalls.delete(callId);

    // Clear any timeout for this call
    this.clearCallTimeout(callId);

    // Send acceptance to server
    this.socketConnection.emit('call-response', {
      callId,
      accepted: true
    });

    this.emit('call-accepted', { callSession });
    
    return callSession;
  }

  /**
   * Reject an incoming call
   */
  rejectCall(callId: string): void {
    const incomingCall = this.incomingCalls.get(callId);
    if (!incomingCall) {
      return;
    }

    this.incomingCalls.delete(callId);
    this.clearCallTimeout(callId);

    // Send rejection to server
    this.socketConnection.emit('call-response', {
      callId,
      accepted: false
    });

    this.emit('call-rejected', { callId, fromUser: incomingCall.fromUser });
  }

  /**
   * End an active call
   */
  endCall(callId: string): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    // Update call session
    callSession.status = 'ended';
    callSession.endedAt = new Date();

    this.activeCalls.delete(callId);
    this.clearCallTimeout(callId);

    // Send end call to server
    this.socketConnection.emit('call-end', { callId });

    this.emit('call-ended', { callSession });
  }

  /**
   * Get current active call
   */
  getCurrentCall(): CallSession | null {
    const activeCalls = Array.from(this.activeCalls.values());
    return activeCalls.find(call => call.status === 'active' || call.status === 'connecting') || null;
  }

  /**
   * Check if user has an active call
   */
  hasActiveCall(): boolean {
    return this.getCurrentCall() !== null;
  }

  /**
   * Get all incoming calls
   */
  getIncomingCalls(): IncomingCall[] {
    return Array.from(this.incomingCalls.values());
  }

  /**
   * Get call session by ID
   */
  getCallSession(callId: string): CallSession | null {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Update call session status
   */
  updateCallStatus(callId: string, status: CallSession['status']): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    callSession.status = status;
    
    if (status === 'active' && !callSession.connectedAt) {
      callSession.connectedAt = new Date();
    }

    this.emit('call-status-updated', { callSession });
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socketConnection) {
      return;
    }

    // Handle incoming call requests
    this.socketConnection.on('incoming-call', (data: { 
      callId: string; 
      fromUser: User; 
      type: 'peer-to-peer' 
    }) => {
      this.handleIncomingCall(data);
    });

    // Handle call responses
    this.socketConnection.on('call-accepted', (data: { callId: string }) => {
      this.handleCallAccepted(data.callId);
    });

    this.socketConnection.on('call-rejected', (data: { callId: string; reason?: string }) => {
      this.handleCallRejected(data.callId, data.reason);
    });

    // Handle call end
    this.socketConnection.on('call-ended', (data: { callId: string }) => {
      this.handleCallEnded(data.callId);
    });

    // Handle call failures
    this.socketConnection.on('call-failed', (data: { callId: string; error: string }) => {
      this.handleCallFailed(data.callId, data.error);
    });

    // Handle connection events
    this.socketConnection.on('disconnect', () => {
      this.handleDisconnection();
    });
  }

  /**
   * Handle incoming call from server
   */
  private handleIncomingCall(data: { callId: string; fromUser: User; type: 'peer-to-peer' }): void {
    // Check if already in a call - auto-reject
    if (this.hasActiveCall()) {
      this.socketConnection.emit('call-response', {
        callId: data.callId,
        accepted: false,
        reason: 'Already in call'
      });
      return;
    }

    const incomingCall: IncomingCall = {
      callId: data.callId,
      type: 'peer-to-peer',
      fromUser: data.fromUser,
      expiresAt: new Date(Date.now() + CALL_REQUEST_TIMEOUT)
    };

    this.incomingCalls.set(data.callId, incomingCall);

    // Set up auto-expiration
    const timeout = setTimeout(() => {
      this.handleCallTimeout(data.callId);
    }, CALL_REQUEST_TIMEOUT);
    
    this.callTimeouts.set(data.callId, timeout);

    this.emit('incoming-call', { incomingCall });
  }

  /**
   * Handle call accepted by remote user
   */
  private handleCallAccepted(callId: string): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    callSession.status = 'connecting';
    callSession.connectedAt = new Date();

    this.clearCallTimeout(callId);
    this.emit('call-accepted', { callSession });
  }

  /**
   * Handle call rejected by remote user
   */
  private handleCallRejected(callId: string, reason?: string): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    callSession.status = 'ended';
    callSession.endedAt = new Date();

    this.activeCalls.delete(callId);
    this.clearCallTimeout(callId);

    this.emit('call-rejected', { callSession, reason });
  }

  /**
   * Handle call ended by remote user
   */
  private handleCallEnded(callId: string): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    callSession.status = 'ended';
    callSession.endedAt = new Date();

    this.activeCalls.delete(callId);
    this.clearCallTimeout(callId);

    this.emit('call-ended', { callSession });
  }

  /**
   * Handle call failure
   */
  private handleCallFailed(callId: string, error: string): void {
    const callSession = this.activeCalls.get(callId);
    if (callSession) {
      callSession.status = 'ended';
      callSession.endedAt = new Date();
      this.activeCalls.delete(callId);
    }

    const incomingCall = this.incomingCalls.get(callId);
    if (incomingCall) {
      this.incomingCalls.delete(callId);
    }

    this.clearCallTimeout(callId);
    this.emit('call-failed', { callId, error });
  }

  /**
   * Handle call timeout (no response)
   */
  private handleCallTimeout(callId: string): void {
    const callSession = this.activeCalls.get(callId);
    const incomingCall = this.incomingCalls.get(callId);

    if (callSession) {
      callSession.status = 'ended';
      callSession.endedAt = new Date();
      this.activeCalls.delete(callId);
      this.emit('call-timeout', { callSession });
    }

    if (incomingCall) {
      this.incomingCalls.delete(callId);
      this.emit('call-expired', { callId });
    }

    this.clearCallTimeout(callId);
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(): void {
    // End all active calls
    for (const [callId, callSession] of this.activeCalls) {
      callSession.status = 'ended';
      callSession.endedAt = new Date();
      this.emit('call-ended', { callSession });
    }

    // Clear all calls and timeouts
    this.activeCalls.clear();
    this.incomingCalls.clear();
    this.clearAllTimeouts();

    this.emit('connection-lost');
  }

  /**
   * Clear call timeout
   */
  private clearCallTimeout(callId: string): void {
    const timeout = this.callTimeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.callTimeouts.delete(callId);
    }
  }

  /**
   * Clear all timeouts
   */
  private clearAllTimeouts(): void {
    for (const timeout of this.callTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.callTimeouts.clear();
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current user data (placeholder - should be implemented based on your user system)
   */
  private async getCurrentUser(): Promise<User> {
    // This should be implemented to get current user data from your user system
    // For now, returning a placeholder
    return {
      id: this.currentUserId!,
      username: 'Current User',
      status: 'available',
      position: { x: 0, y: 0, z: 0, timestamp: Date.now() },
      blockedUsers: [],
      friends: [],
      privacySettings: {
        allowCallsFromStrangers: true,
        proximityVisible: true
      }
    };
  }

  /**
   * Get call manager status
   */
  getStatus(): {
    hasActiveCall: boolean;
    activeCallId: string | null;
    incomingCallsCount: number;
    isInitialized: boolean;
  } {
    const currentCall = this.getCurrentCall();
    
    return {
      hasActiveCall: !!currentCall,
      activeCallId: currentCall?.callId || null,
      incomingCallsCount: this.incomingCalls.size,
      isInitialized: !!(this.currentUserId && this.socketConnection)
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // End all active calls
    for (const [callId] of this.activeCalls) {
      this.endCall(callId);
    }

    // Clear all data
    this.activeCalls.clear();
    this.incomingCalls.clear();
    this.clearAllTimeouts();

    // Remove all listeners
    this.removeAllListeners();

    // Clear references
    this.currentUserId = null;
    this.socketConnection = null;
  }
}