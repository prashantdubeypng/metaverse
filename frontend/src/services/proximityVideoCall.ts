import { EventEmitter } from 'events';
// Removed unused imports (WebRTCHandler, SignalingMessage)
import { User, Position3D } from '@/types/video-call';

interface ProximityCallParticipant {
  userId: string;
  username: string;
  position: Position3D;
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  connectionState: RTCPeerConnectionState;
}

interface ProximityVideoCallState {
  isActive: boolean;
  callId: string | null;
  participants: Map<string, ProximityCallParticipant>;
  localStream: MediaStream | null;
  localPosition: Position3D;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  proximityRange: number;
}

class ProximityVideoCallManager extends EventEmitter {
  private state: ProximityVideoCallState = {
    isActive: false,
    callId: null,
    participants: new Map(),
    localStream: null,
    localPosition: { x: 0, y: 0, z: 0 },
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    proximityRange: 40, // 2 tiles * 20 pixels = 40 pixels for video call activation
  };

  private websocketService: {
    emit: (type: string, data?: Record<string, unknown>) => void;
    on: (event: string, listener: (data: unknown) => void) => void;
  } | null = null; // Injected WebSocket service
  private userId: string | null = null;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  private currentUserId: string | null = null;

  constructor() {
    super();
  }

  /**
   * Inject WebSocket service dependency
   */
  setWebSocketService(ws: {
    emit: (type: string, data?: Record<string, unknown>) => void;
    on: (event: string, listener: (data: unknown) => void) => void;
  }): void {
    this.websocketService = ws;
    this.setupWebSocketListeners();
  }

  /**
   * Initialize the proximity video call manager
   */
  async initialize(userId: string): Promise<void> {
    // Idempotency: avoid re-initializing if already initialized for same user
    if (this.currentUserId && this.currentUserId === userId && this.state.localStream) {
      return; // Already initialized
    }

    this.currentUserId = userId;

    // Initialize local media stream only if we don't have one
    if (!this.state.localStream) {
      await this.initializeLocalStream();
    }

    this.emit('initialized');
  }

  /**
   * Update user position and check for proximity changes
   */
  updatePosition(x: number, y: number, z: number = 0): void {
    const oldPosition = { ...this.state.localPosition };
    this.state.localPosition = { x, y, z };
    
    // Convert pixel coordinates to grid coordinates for backend
    const gridX = Math.round(x / 20);
    const gridY = Math.round(y / 20);
    
    console.log('📍 [DEBUG] Position updated in video service:', {
      oldPosition,
      newPosition: this.state.localPosition,
      gridPosition: { x: gridX, y: gridY },
      currentUserId: this.currentUserId
    });
    
    // Send GRID coordinates to backend (not pixel coordinates!)
    if (this.websocketService) {
      this.websocketService.emit('proximity-position-update', {
        userId: this.currentUserId,
        position: {
          x: gridX,  // Send grid coordinates
          y: gridY,  // Send grid coordinates
          z: z
        },
        isInVideoCall: this.state.isActive,
      });
    }

    // Check if we need to disconnect from users who are too far
    this.checkProximityDisconnections();
  }

  /**
   * Handle nearby users update from proximity system
   */
  handleNearbyUsersUpdate(nearbyUsers: User[]): void {
    const GRID_SIZE = 20; // Must match space page grid size
    const PROXIMITY_DISTANCE = 2; // Must match space page proximity distance
    
    // Use the same Manhattan distance calculation as the space page
    const usersInRange = nearbyUsers.filter(user => {
      const currentGridX = Math.round(this.state.localPosition.x / GRID_SIZE);
      const currentGridY = Math.round(this.state.localPosition.y / GRID_SIZE);
      const userGridX = Math.round(user.x / GRID_SIZE);
      const userGridY = Math.round(user.y / GRID_SIZE);
      
      const manhattanDistance = Math.abs(currentGridX - userGridX) + Math.abs(currentGridY - userGridY);
      return manhattanDistance <= PROXIMITY_DISTANCE;
    });

    // Debug logging for proximity detection
    console.log('🎥 [DEBUG] Proximity detection in video service:', {
      localPosition: this.state.localPosition,
      localGridPos: {
        x: Math.round(this.state.localPosition.x / GRID_SIZE),
        y: Math.round(this.state.localPosition.y / GRID_SIZE)
      },
      nearbyUsers: nearbyUsers.map(user => {
        const currentGridX = Math.round(this.state.localPosition.x / GRID_SIZE);
        const currentGridY = Math.round(this.state.localPosition.y / GRID_SIZE);
        const userGridX = Math.round(user.x / GRID_SIZE);
        const userGridY = Math.round(user.y / GRID_SIZE);
        const manhattanDistance = Math.abs(currentGridX - userGridX) + Math.abs(currentGridY - userGridY);
        
        return {
          username: user.username || `User_${user.id?.slice(0, 8)}`,
          pixelPos: { x: user.x, y: user.y },
          gridPos: { x: userGridX, y: userGridY },
          manhattanDistance,
          inRange: manhattanDistance <= PROXIMITY_DISTANCE
        };
      }),
      usersInRange: usersInRange.length,
      isActive: this.state.isActive,
      currentUserId: this.currentUserId
    });

    // Start calls with new users in range
    for (const user of usersInRange) {
      if (!this.state.participants.has(user.id) && user.id !== this.currentUserId) {
        const currentGridX = Math.round(this.state.localPosition.x / GRID_SIZE);
        const currentGridY = Math.round(this.state.localPosition.y / GRID_SIZE);
        const userGridX = Math.round(user.x / GRID_SIZE);
        const userGridY = Math.round(user.y / GRID_SIZE);
        const manhattanDistance = Math.abs(currentGridX - userGridX) + Math.abs(currentGridY - userGridY);
        
        console.log(`🚀 Starting proximity video call with ${user.username || user.id} (Manhattan distance: ${manhattanDistance} tiles)`);
        this.initiateProximityCall(user);
      }
    }

    // End calls with users who left range
    const currentParticipantIds = Array.from(this.state.participants.keys());
    const usersInRangeIds = usersInRange.map(u => u.id);
    
    for (const participantId of currentParticipantIds) {
      if (!usersInRangeIds.includes(participantId)) {
        const participant = this.state.participants.get(participantId);
        console.log(`🛑 Ending proximity video call with ${participant?.username || participantId} (moved out of range)`);
        this.endProximityCallWithUser(participantId);
      }
    }
  }

  /**
   * Initialize local media stream (video and audio)
   */
  private async initializeLocalStream(): Promise<void> {
    // Guard against duplicate calls creating multiple tracks
    if (this.state.localStream) {
      return; // Already have a local stream
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
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
      });
      this.state.localStream = stream;
      this.emit('local-stream-ready', this.state.localStream);
    } catch (error) {
      console.error('Failed to initialize local stream:', error);
      this.emit('error', 'Failed to access camera/microphone');
      throw error;
    }
  }

  /**
   * Initiate proximity call with a user
   */
  private async initiateProximityCall(user: User): Promise<void> {
    if (!this.state.localStream || !this.currentUserId) return;

    const callId = this.generateCallId();
    
    if (!this.state.isActive) {
      this.state.isActive = true;
      this.state.callId = callId;
      this.emit('proximity-call-started', { callId });
    }

    // Create peer connection for this user
    const peerConnection = new RTCPeerConnection(this.rtcConfig);
    
    const participant: ProximityCallParticipant = {
      userId: user.id,
      username: user.username,
      position: { x: user.x, y: user.y, z: 0 },
      peerConnection,
      localStream: this.state.localStream,
      remoteStream: null,
      isAudioEnabled: !this.state.isMuted,
      isVideoEnabled: !this.state.isCameraOff,
      isScreenSharing: false,
      connectionState: 'new'
    };

    // Add local stream to peer connection
    this.state.localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, this.state.localStream!);
    });

    // Set up peer connection event handlers
    this.setupPeerConnectionHandlers(participant);

    // Add to participants
    this.state.participants.set(user.id, participant);

    // Create and send offer
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer through WebSocket
      if (this.websocketService) {
        this.websocketService.emit('proximity-video-call-signal', {
          type: 'offer',
          callId: this.state.callId,
          fromUserId: this.currentUserId,
          toUserId: user.id,
          offer: offer
        });
      }

      this.emit('participant-connecting', { userId: user.id, username: user.username });
    } catch (error) {
      console.error('Failed to create offer for user:', user.id, error);
      this.removeParticipant(user.id);
    }
  }

  /**
   * Handle incoming proximity call signals
   */
  private async handleProximityCallSignal(data: {
    type: 'offer' | 'answer' | 'ice-candidate';
    callId: string;
    fromUserId: string;
    toUserId: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidate;
  }): Promise<void> {
    const { type, fromUserId, offer, answer, candidate } = data;

    let participant = this.state.participants.get(fromUserId);

    // If we receive an offer from a new user, create a participant
    if (!participant && type === 'offer') {
      if (!this.state.isActive) {
        this.state.isActive = true;
        this.state.callId = data.callId;
        this.emit('proximity-call-started', { callId: data.callId });
      }

      const peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      participant = {
        userId: fromUserId,
        username: `User ${fromUserId}`, // You might want to fetch username
        position: { x: 0, y: 0, z: 0 }, // Will be updated by proximity system
        peerConnection,
        localStream: this.state.localStream,
        remoteStream: null,
        isAudioEnabled: !this.state.isMuted,
        isVideoEnabled: !this.state.isCameraOff,
        isScreenSharing: false,
        connectionState: 'new'
      };

      // Add local stream
      if (this.state.localStream) {
        this.state.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.state.localStream!);
        });
      }

      this.setupPeerConnectionHandlers(participant);
      this.state.participants.set(fromUserId, participant);
    }

    if (!participant) return;

    const { peerConnection } = participant;

    try {
      switch (type) {
        case 'offer':
          if (offer && peerConnection) {
            await peerConnection.setRemoteDescription(offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            // Send answer back
            if (this.websocketService) {
              this.websocketService.emit('proximity-video-call-signal', {
                type: 'answer',
                callId: data.callId,
                fromUserId: this.currentUserId,
                toUserId: fromUserId,
                answer: answer
              });
            }
          }
          break;

        case 'answer':
          if (answer && peerConnection) {
            await peerConnection.setRemoteDescription(answer);
          }
          break;

        case 'ice-candidate':
          if (candidate && peerConnection) {
            await peerConnection.addIceCandidate(candidate);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling signaling:', error);
      this.removeParticipant(fromUserId);
    }
  }

  /**
   * Set up peer connection event handlers
   */
  private setupPeerConnectionHandlers(participant: ProximityCallParticipant): void {
    const { peerConnection, userId } = participant;

    if (!peerConnection) {
      console.error('❌ Cannot setup handlers: peerConnection is null');
      return;
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      participant.remoteStream = event.streams[0];
      this.emit('participant-stream', {
        userId,
        stream: event.streams[0]
      });
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.state.callId && this.websocketService) {
        this.websocketService.emit('proximity-video-call-signal', {
          type: 'ice-candidate',
          callId: this.state.callId,
          fromUserId: this.currentUserId,
          toUserId: userId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      participant.connectionState = peerConnection.connectionState;
      
      this.emit('participant-connection-state', {
        userId,
        state: peerConnection.connectionState
      });

      if (peerConnection.connectionState === 'connected') {
        this.emit('participant-connected', { userId, username: participant.username });
      } else if (peerConnection.connectionState === 'failed' || 
                 peerConnection.connectionState === 'disconnected') {
        this.removeParticipant(userId);
      }
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${userId}:`, peerConnection.iceConnectionState);
    };

    // Additional negotiation & state diagnostics
    peerConnection.onnegotiationneeded = () => {
      console.log(`[NegotiationNeeded] for participant ${userId}`);
    };

    peerConnection.onsignalingstatechange = () => {
      console.log(`[SignalingState] ${userId}:`, peerConnection.signalingState);
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log(`[ICEGatheringState] ${userId}:`, peerConnection.iceGatheringState);
    };
  }

  /**
   * End proximity call with a specific user
   */
  private endProximityCallWithUser(userId: string): void {
    const participant = this.state.participants.get(userId);
    if (!participant) return;

    // Close peer connection
    if (participant.peerConnection) {
      participant.peerConnection.close();
    }

    // Stop remote stream
    if (participant.remoteStream) {
      participant.remoteStream.getTracks().forEach(track => track.stop());
    }

    this.state.participants.delete(userId);
    this.emit('participant-disconnected', { userId, username: participant.username });

    // If no participants left, end the call
    if (this.state.participants.size === 0 && this.state.isActive) {
      this.endCall();
    }
  }

  /**
   * Check for proximity disconnections
   */
  private checkProximityDisconnections(): void {
    const participantsToRemove: string[] = [];

    for (const [userId, participant] of this.state.participants) {
      const distance = this.calculateDistance(this.state.localPosition, participant.position);
      if (distance > this.state.proximityRange) {
        participantsToRemove.push(userId);
      }
    }

    for (const userId of participantsToRemove) {
      this.endProximityCallWithUser(userId);
    }
  }

  /**
   * Toggle microphone mute
   */
  toggleMute(): boolean {
    if (!this.state.localStream) return false;

    const audioTrack = this.state.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.state.isMuted = !audioTrack.enabled;

      // Update all participants
      for (const participant of this.state.participants.values()) {
        participant.isAudioEnabled = audioTrack.enabled;
      }

      this.emit('audio-toggled', { isMuted: this.state.isMuted });
      return this.state.isMuted;
    }
    return false;
  }

  /**
   * Toggle camera on/off
   */
  toggleCamera(): boolean {
    if (!this.state.localStream) return false;

    const videoTrack = this.state.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.state.isCameraOff = !videoTrack.enabled;

      // Update all participants
      for (const participant of this.state.participants.values()) {
        participant.isVideoEnabled = videoTrack.enabled;
      }

      this.emit('video-toggled', { isCameraOff: this.state.isCameraOff });
      return this.state.isCameraOff;
    }
    return false;
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<boolean> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const videoTrack = screenStream.getVideoTracks()[0];
      
      // Replace video track for all peer connections
      for (const participant of this.state.participants.values()) {
        const sender = participant.peerConnection?.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );

        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      // Handle screen share end
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      this.state.isScreenSharing = true;
      this.emit('screen-share-started');
      return true;

    } catch (error) {
      console.error('Failed to start screen share:', error);
      this.emit('error', 'Failed to start screen sharing');
      return false;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.state.localStream) return;

    const videoTrack = this.state.localStream.getVideoTracks()[0];
    
    // Restore original video track for all peer connections
    for (const participant of this.state.participants.values()) {
      const sender = participant.peerConnection?.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      }
    }

    this.state.isScreenSharing = false;
    this.emit('screen-share-stopped');
  }

  /**
   * End the entire proximity call
   */
  endCall(): void {
    // Store callId before resetting state
    const endingCallId = this.state.callId;

    // End all participant connections
    for (const userId of this.state.participants.keys()) {
      this.endProximityCallWithUser(userId);
    }

    // Stop local stream
    if (this.state.localStream) {
      this.state.localStream.getTracks().forEach(track => track.stop());
      this.state.localStream = null;
    }

    // Reset state
    this.state.isActive = false;
    this.state.callId = null;
    this.state.participants.clear();
    this.state.isMuted = false;
    this.state.isCameraOff = false;
    this.state.isScreenSharing = false;

    // Notify server with the original callId
    if (this.websocketService && endingCallId) {
      this.websocketService.emit('proximity-video-call-ended', {
        userId: this.currentUserId,
        callId: endingCallId
      });
    }

    this.emit('call-ended');
  }

  /**
   * Remove a participant
   */
  private removeParticipant(userId: string): void {
    const participant = this.state.participants.get(userId);
    if (participant) {
      if (participant.peerConnection) {
        participant.peerConnection.close();
      }
      if (participant.remoteStream) {
        participant.remoteStream.getTracks().forEach(track => track.stop());
      }
      this.state.participants.delete(userId);
      this.emit('participant-left', { userId, username: participant.username });
    }
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupWebSocketListeners(): void {
    if (!this.websocketService) {
      console.warn('WebSocket service not available for proximity video calls');
      return;
    }

    this.websocketService.on('proximity-video-call-signal', (data: unknown) => {
      // Perform a runtime shape check
      const msg = data as {
        type?: 'offer' | 'answer' | 'ice-candidate';
        callId?: string;
        fromUserId?: string;
        toUserId?: string;
        offer?: RTCSessionDescriptionInit;
        answer?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidate;
      };
      if (!msg || !msg.type || !msg.fromUserId) {
        console.warn('Ignoring malformed proximity-video-call-signal', data);
        return;
      }
      // Cast to required format after validation
      this.handleProximityCallSignal(msg as Required<Pick<typeof msg,'type'|'callId'|'fromUserId'|'toUserId'>> & {
        offer?: RTCSessionDescriptionInit;
        answer?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidate;
      });
    });

    this.websocketService.on('proximity-user-left', (data: unknown) => {
      const payload = data as { userId?: string };
      if (payload?.userId) {
        this.endProximityCallWithUser(payload.userId);
      } else {
        console.warn('Malformed proximity-user-left payload', data);
      }
    });

    this.websocketService.on('disconnect', () => {
      this.endCall();
    });
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: Position3D, pos2: Position3D): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `proximity_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current call state
   */
  getState(): ProximityVideoCallState {
    return { ...this.state };
  }

  /**
   * Get all participants
   */
  getParticipants(): ProximityCallParticipant[] {
    return Array.from(this.state.participants.values());
  }

  /**
   * Check if call is active
   */
  isCallActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.state.localStream;
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.endCall();
    this.removeAllListeners();
    this.currentUserId = null;
  }
}

// Singleton instance
const proximityVideoCallManager = new ProximityVideoCallManager();
export default proximityVideoCallManager;