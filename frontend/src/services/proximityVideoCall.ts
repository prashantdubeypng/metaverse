/**
 * ProximityVideoCallManager - Manages proximity-based video calls
 * 
 * PURPOSE:
 * This service handles WebRTC-based video calls that are triggered
 * automatically when users move within proximity range (2 tiles) of each other.
 * It manages peer connections, media streams, and signaling.
 * 
 * ARCHITECTURE:
 * - Extends EventEmitter for state change notifications
 * - Uses WebSocket for signaling (offer/answer/ICE candidates)
 * - Manages multiple peer connections (one per nearby user)
 * - Tracks local and remote media streams
 * 
 * COORDINATE SYSTEM:
 * - Uses centralized coordinates.ts utility
 * - Position updates sent to backend in GRID coordinates
 * - Proximity calculations done in GRID coordinates
 * - Proximity range: 2 tiles (Manhattan distance)
 * 
 * BUG FIXES:
 * - BUG-001: Uses toGrid() for correct coordinate conversion
 * - BUG-011: Consistent with centralized coordinate system
 * 
 * @author GitHub Copilot
 * @see docs/bugs/video-calling/BUG-001-proximity-call-not-triggering.md
 */

import { EventEmitter } from 'events';
import { User, Position3D } from '@/types/video-call';
import { GRID_SIZE, toGrid, gridDistance } from '@/utils/coordinates';

/**
 * Proximity distance in GRID units (tiles)
 * Users within this many tiles will have video calls initiated
 */
const PROXIMITY_DISTANCE_TILES = 2;

/**
 * BUG-006 FIX: Hysteresis constants for call ending
 * 
 * To prevent call flickering when users are at the boundary,
 * we use different thresholds for starting and ending calls:
 * - Start call: when distance <= 2 tiles
 * - End call: when distance > 3 tiles (hysteresis buffer)
 * 
 * Additionally, we implement:
 * - Grace period: Wait 2 seconds before actually ending the call
 * - Cooldown: Prevent re-initiating call for 3 seconds after ending
 * 
 * @see docs/bugs/video-calling/BUG-006-call-not-ending.md
 */
const CALL_END_DISTANCE_TILES = PROXIMITY_DISTANCE_TILES + 1; // 3 tiles
const GRACE_PERIOD_MS = 2000; // 2 seconds before call actually ends
const COOLDOWN_PERIOD_MS = 3000; // 3 seconds after call ends before new call can start

/**
 * Extended participant interface with grace period tracking
 * BUG-006 FIX: Added disconnectGraceTimer for hysteresis
 */
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
  /** BUG-006: Timer for grace period before disconnecting */
  disconnectGraceTimer: ReturnType<typeof setTimeout> | null;
  /** BUG-006: Whether the participant is in "leaving" state */
  isLeavingProximity: boolean;
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

  /**
   * BUG-006 FIX: Cooldown map to prevent rapid call start/end cycles
   * Key: userId, Value: timestamp when cooldown expires
   */
  private callCooldowns: Map<string, number> = new Map();

  /**
   * RTC Configuration for WebRTC peer connections (BUG-003 fix)
   * 
   * Includes both STUN and TURN servers for reliable connectivity:
   * - STUN: Works for simple NAT traversal (~70% success rate)
   * - TURN: Relay server for restrictive networks (~99% success rate)
   * 
   * TURN server credentials should be configured via environment variables.
   * If not configured, only STUN servers are used (reduced reliability).
   * 
   * @see docs/bugs/video-calling/BUG-003-ice-connection-failure.md
   */
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      // STUN servers (free, for simple NAT traversal)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      
      // TURN server (for restrictive networks - requires configuration)
      // Only add if credentials are configured
      ...(typeof process !== 'undefined' && 
          process.env?.NEXT_PUBLIC_TURN_SERVER_URL ? [{
        urls: [
          process.env.NEXT_PUBLIC_TURN_SERVER_URL,
          process.env.NEXT_PUBLIC_TURN_SERVER_URL + '?transport=tcp',
        ],
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
      }] : [])
    ],
    iceCandidatePoolSize: 10,
    // 'all' uses both STUN and TURN candidates
    // Change to 'relay' to force TURN for testing
    iceTransportPolicy: 'all',
  };
  
  /** ICE restart attempts per participant */
  private iceRestartAttempts: Map<string, number> = new Map();
  
  /** Maximum ICE restart attempts before giving up */
  private readonly MAX_ICE_RESTART_ATTEMPTS = 3;

  private currentUserId: string | null = null;

  /**
   * BUG-004 FIX: Constructor sets up page unload handlers
   * to ensure proper cleanup when user navigates away
   */
  constructor() {
    super();
    
    // BUG-004: Force cleanup on page unload to prevent memory leaks
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handlePageUnload);
      window.addEventListener('pagehide', this.handlePageUnload);
    }
  }

  /**
   * BUG-004 FIX: Handle page unload/hide events
   * Arrow function to preserve 'this' context
   */
  private handlePageUnload = (): void => {
    console.log('🧹 [BUG-004] Page unload - forcing cleanup');
    this.forceCleanup();
  };

  /**
   * BUG-004 FIX: Force cleanup all resources
   * 
   * Called on page unload to ensure no leaked connections.
   * Also useful for manual cleanup in error scenarios.
   */
  forceCleanup(): void {
    console.log('🧹 [BUG-004] Force cleanup initiated');
    
    // Clear all cooldowns
    this.callCooldowns.clear();
    
    // Clear all ICE restart attempts
    this.iceRestartAttempts.clear();
    
    // End all participant connections (without setting cooldowns)
    for (const userId of Array.from(this.state.participants.keys())) {
      this.endProximityCallWithUser(userId, false);
    }
    
    // Stop local stream
    if (this.state.localStream) {
      this.state.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.state.localStream = null;
    }
    
    // Reset state
    this.state.isActive = false;
    this.state.callId = null;
    this.state.participants.clear();
    
    // Remove page unload listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handlePageUnload);
      window.removeEventListener('pagehide', this.handlePageUnload);
    }
    
    // Remove all event listeners from this emitter
    this.removeAllListeners();
    
    console.log('✅ [BUG-004] Force cleanup complete');
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
    console.log('🎬 [INITIALIZE] Starting initialization for user:', userId);
    
    // Idempotency: avoid re-initializing if already initialized for same user
    if (this.currentUserId && this.currentUserId === userId && this.state.localStream) {
      console.log('🎬 [INITIALIZE] Already initialized for this user, skipping');
      return; // Already initialized
    }

    this.currentUserId = userId;
    console.log('🎬 [INITIALIZE] Set currentUserId:', this.currentUserId);

    // Initialize local media stream only if we don't have one
    if (!this.state.localStream) {
      console.log('🎬 [INITIALIZE] No local stream, initializing...');
      try {
        await this.initializeLocalStream();
        console.log('✅ [INITIALIZE] Local stream initialized successfully');
      } catch (error) {
        console.error('❌ [INITIALIZE] Failed to initialize local stream:', error);
        // Don't throw - let the system work without video initially
      }
    } else {
      console.log('🎬 [INITIALIZE] Local stream already exists');
    }

    console.log('🎬 [INITIALIZE] Final state:', {
      hasLocalStream: !!this.state.localStream,
      currentUserId: this.currentUserId
    });

    this.emit('initialized');
  }

  /**
   * Update user position and check for proximity changes
   * 
   * @param x - X position in PIXELS
   * @param y - Y position in PIXELS
   * @param z - Z position (optional, for future 3D support)
   * 
   * NOTE: Converts pixel coordinates to grid coordinates before
   * sending to backend, as backend expects grid coordinates.
   */
  updatePosition(x: number, y: number, z: number = 0): void {
    const oldPosition = { ...this.state.localPosition };
    this.state.localPosition = { x, y, z };
    
    // Convert pixel coordinates to grid coordinates using centralized utility
    const gridPos = toGrid({ x, y });
    
    console.log('📍 [DEBUG] Position updated in video service:', {
      oldPosition,
      newPosition: this.state.localPosition,
      gridPosition: gridPos,
      currentUserId: this.currentUserId
    });
    
    // Send GRID coordinates to backend (not pixel coordinates!)
    if (this.websocketService) {
      this.websocketService.emit('proximity-position-update', {
        userId: this.currentUserId,
        position: {
          x: gridPos.gridX,  // Send grid coordinates
          y: gridPos.gridY,  // Send grid coordinates
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
   * 
   * Filters users based on Manhattan distance (grid units) and
   * initiates/ends video calls as users enter/leave proximity range.
   * 
   * BUG-006 FIX: 
   * - Added cooldown check before starting new calls
   * - Updates participant positions for accurate distance tracking
   * - Uses hysteresis (end at 3 tiles, start at 2 tiles)
   * 
   * @param nearbyUsers - Array of users with their positions
   */
  handleNearbyUsersUpdate(nearbyUsers: User[]): void {
    // Convert local position to grid coordinates
    const currentGridPos = toGrid({ x: this.state.localPosition.x, y: this.state.localPosition.y });
    
    // Clean up expired cooldowns
    const now = Date.now();
    for (const [userId, expiry] of this.callCooldowns) {
      if (now >= expiry) {
        this.callCooldowns.delete(userId);
        console.log(`🔓 [BUG-006] Cooldown expired for user ${userId}`);
      }
    }
    
    // BUG-006: Update positions of existing participants FIRST
    // This ensures checkProximityDisconnections has accurate position data
    for (const user of nearbyUsers) {
      const existingParticipant = this.state.participants.get(user.id);
      if (existingParticipant) {
        // Update the participant's position (z is optional on User type)
        existingParticipant.position = { x: user.x, y: user.y, z: 0 };
      }
    }
    
    // Filter users within proximity range using grid-based Manhattan distance
    const usersInRange = nearbyUsers.filter(user => {
      // User positions should already be in pixels, convert to grid
      const userGridPos = toGrid({ x: user.x, y: user.y });
      const distance = gridDistance(currentGridPos, userGridPos);
      return distance <= PROXIMITY_DISTANCE_TILES;
    });

    // Debug logging for proximity detection
    console.log('🎥 [DEBUG] Proximity detection in video service:', {
      localPosition: this.state.localPosition,
      localGridPos: currentGridPos,
      activeCooldowns: this.callCooldowns.size,
      nearbyUsers: nearbyUsers.map(user => {
        const userGridPos = toGrid({ x: user.x, y: user.y });
        const manhattanDistance = gridDistance(currentGridPos, userGridPos);
        const hasCooldown = this.callCooldowns.has(user.id) && (this.callCooldowns.get(user.id) || 0) > now;
        
        return {
          username: user.username || `User_${user.id?.slice(0, 8)}`,
          pixelPos: { x: user.x, y: user.y },
          gridPos: userGridPos,
          manhattanDistance,
          inRange: manhattanDistance <= PROXIMITY_DISTANCE_TILES,
          hasCooldown
        };
      }),
      usersInRange: usersInRange.length,
      isActive: this.state.isActive,
      currentUserId: this.currentUserId
    });

    // Start calls with new users in range (respecting cooldown)
    for (const user of usersInRange) {
      if (!this.state.participants.has(user.id) && user.id !== this.currentUserId) {
        // BUG-006: Check cooldown before initiating call
        const cooldownExpiry = this.callCooldowns.get(user.id);
        if (cooldownExpiry && now < cooldownExpiry) {
          const remainingMs = cooldownExpiry - now;
          console.log(`⏳ [BUG-006] Skipping call with ${user.username || user.id} - cooldown active (${Math.ceil(remainingMs / 1000)}s remaining)`);
          continue;
        }
        
        const userGridPos = toGrid({ x: user.x, y: user.y });
        const manhattanDistance = gridDistance(currentGridPos, userGridPos);
        
        console.log(`🚀 Starting proximity video call with ${user.username || user.id} (Manhattan distance: ${manhattanDistance} tiles)`);
        this.initiateProximityCall(user);
      }
    }

    // BUG-006: Don't immediately end calls here - let checkProximityDisconnections handle it
    // with hysteresis and grace periods. Only track users that are now in "usersInRange"
    // but the actual disconnection logic is in checkProximityDisconnections()
    
    // However, we still need to handle users that have completely disconnected (not in nearbyUsers at all)
    const nearbyUserIds = nearbyUsers.map(u => u.id);
    for (const participantId of this.state.participants.keys()) {
      if (!nearbyUserIds.includes(participantId)) {
        const participant = this.state.participants.get(participantId);
        console.log(`🚫 [BUG-006] ${participant?.username || participantId} no longer in nearby users list - ending call immediately`);
        this.endProximityCallWithUser(participantId);
      }
    }
  }

  /**
   * Initialize local media stream (video and audio)
   */
  /**
   * Initialize local media stream (video and audio)
   * 
   * BUG-005/BUG-028 FIX: Enhanced audio constraints for better echo cancellation
   * and audio-video sync. Uses advanced WebRTC constraints where supported.
   * 
   * Audio constraints include:
   * - echoCancellation: Removes speaker audio picked up by microphone
   * - noiseSuppression: Reduces background noise
   * - autoGainControl: Normalizes volume levels
   * - channelCount: 1 for reduced bandwidth and better echo cancellation
   * - sampleRate: 48000 for optimal WebRTC performance
   * 
   * @see docs/bugs/video-calling/BUG-005-audio-video-sync.md
   * @see docs/bugs/video-calling/BUG-028-audio-echo.md
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
          // Core echo cancellation (BUG-028)
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // Mono audio for better echo cancellation and reduced bandwidth
          channelCount: { ideal: 1 },
          // Standard WebRTC sample rate
          sampleRate: { ideal: 48000 },
          // Additional advanced constraints (Chrome-specific, gracefully ignored by others)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(typeof navigator !== 'undefined' && 'chrome' in window ? {
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googAudioMirroring: false
          } : {}) as Record<string, boolean>
        }
      });
      
      // BUG-005: Log audio track settings for debugging
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log('🎤 [BUG-005/028] Audio track settings:', {
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
          channelCount: settings.channelCount,
          sampleRate: settings.sampleRate
        });
      }
      
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
   * 
   * BUG-006 FIX: Initializes new grace period fields for proper call ending
   */
  private async initiateProximityCall(user: User): Promise<void> {
    console.log('📞 [INITIATE CALL] Checking prerequisites:', {
      hasLocalStream: !!this.state.localStream,
      currentUserId: this.currentUserId,
      targetUser: { id: user.id, username: user.username }
    });

    if (!this.currentUserId) {
      console.error('❌ [INITIATE CALL] Cannot initiate call - no currentUserId set');
      return;
    }

    // Try to initialize local stream if we don't have one
    if (!this.state.localStream) {
      console.log('📹 [INITIATE CALL] No local stream, attempting to initialize...');
      try {
        await this.initializeLocalStream();
      } catch (error) {
        console.error('❌ [INITIATE CALL] Failed to initialize local stream:', error);
        return;
      }
    }

    if (!this.state.localStream) {
      console.error('❌ [INITIATE CALL] Still no local stream after initialization attempt');
      return;
    }

    console.log('✅ [INITIATE CALL] Prerequisites met, proceeding with call');
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
      connectionState: 'new',
      // BUG-006: Initialize grace period fields
      disconnectGraceTimer: null,
      isLeavingProximity: false
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
          targetUserId: user.id,
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
    targetUserId: string;
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
        connectionState: 'new',
        // BUG-006: Initialize grace period fields
        disconnectGraceTimer: null,
        isLeavingProximity: false
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
                targetUserId: fromUserId,
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

    /**
     * Handle remote stream
     * 
     * BUG-005 FIX: Use the provided stream directly from event.streams[0]
     * instead of creating a new MediaStream. This ensures audio and video
     * tracks stay synchronized as the browser manages them together.
     * 
     * The browser's RTP timestamp synchronization works best when tracks
     * are kept in their original stream.
     */
    peerConnection.ontrack = (event) => {
      // BUG-005: Use the stream directly from WebRTC for proper A/V sync
      const [remoteStream] = event.streams;
      
      if (remoteStream) {
        participant.remoteStream = remoteStream;
        
        // Log track info for debugging
        console.log(`📹 [BUG-005] Remote stream received for ${userId}:`, {
          videoTracks: remoteStream.getVideoTracks().length,
          audioTracks: remoteStream.getAudioTracks().length,
          streamId: remoteStream.id
        });
        
        this.emit('participant-stream', {
          userId,
          stream: remoteStream
        });
      } else {
        // Fallback: Create stream from track (less optimal for sync)
        console.warn(`⚠️ [BUG-005] No stream in event.streams, using track directly`);
        if (!participant.remoteStream) {
          participant.remoteStream = new MediaStream();
        }
        participant.remoteStream.addTrack(event.track);
        
        this.emit('participant-stream', {
          userId,
          stream: participant.remoteStream
        });
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.state.callId && this.websocketService) {
        this.websocketService.emit('proximity-video-call-signal', {
          type: 'ice-candidate',
          callId: this.state.callId,
          fromUserId: this.currentUserId,
          targetUserId: userId,
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

    /**
     * Handle ICE connection state changes (BUG-003 fix)
     * 
     * Implements ICE restart on failure to recover from transient network issues.
     * Tracks restart attempts to prevent infinite restart loops.
     */
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log(`🧊 ICE connection state for ${userId}:`, state);
      
      if (state === 'failed') {
        // Check if we can attempt a restart
        const restartCount = this.iceRestartAttempts.get(userId) || 0;
        
        if (restartCount < this.MAX_ICE_RESTART_ATTEMPTS) {
          console.log(`🔄 ICE connection failed, attempting restart (${restartCount + 1}/${this.MAX_ICE_RESTART_ATTEMPTS})...`);
          this.iceRestartAttempts.set(userId, restartCount + 1);
          
          // Attempt ICE restart
          peerConnection.restartIce();
          this.sendICERestartOffer(participant);
        } else {
          console.error(`❌ ICE connection failed after ${this.MAX_ICE_RESTART_ATTEMPTS} restart attempts, giving up`);
          this.iceRestartAttempts.delete(userId);
          this.removeParticipant(userId);
        }
      } else if (state === 'disconnected') {
        // Connection may recover on its own, wait before restarting
        console.log(`⚠️ ICE connection disconnected for ${userId}, waiting 5s before restart...`);
        
        setTimeout(() => {
          // Check if still disconnected
          if (peerConnection.iceConnectionState === 'disconnected') {
            const restartCount = this.iceRestartAttempts.get(userId) || 0;
            
            if (restartCount < this.MAX_ICE_RESTART_ATTEMPTS) {
              console.log(`🔄 Connection still disconnected, restarting ICE...`);
              this.iceRestartAttempts.set(userId, restartCount + 1);
              peerConnection.restartIce();
              this.sendICERestartOffer(participant);
            }
          }
        }, 5000);
      } else if (state === 'connected' || state === 'completed') {
        // Connection recovered, reset restart counter
        this.iceRestartAttempts.delete(userId);
        console.log(`✅ ICE connection established for ${userId}`);
      }
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
   * Send ICE restart offer (BUG-003 fix)
   * 
   * Creates and sends a new offer with iceRestart flag set to true.
   * This triggers ICE candidate re-gathering and connection re-establishment.
   */
  private async sendICERestartOffer(participant: ProximityCallParticipant): Promise<void> {
    const { peerConnection, userId } = participant;
    
    if (!peerConnection) {
      console.warn('⚠️ Cannot send ICE restart - no peer connection');
      return;
    }
    
    try {
      const offer = await peerConnection.createOffer({ iceRestart: true });
      await peerConnection.setLocalDescription(offer);
      
      if (this.websocketService) {
        this.websocketService.emit('proximity-video-call-signal', {
          type: 'offer',
          callId: this.state.callId,
          fromUserId: this.currentUserId,
          targetUserId: userId,
          offer: offer
        });
      }
      
      console.log('🔄 ICE restart offer sent to', userId);
    } catch (error) {
      console.error('❌ ICE restart failed:', error);
    }
  }

  /**
   * End proximity call with a specific user
   * 
   * BUG-004 FIX: Comprehensive cleanup to prevent memory leaks
   * BUG-006 FIX: Clears grace timer, sets cooldown
   * 
   * Cleanup steps:
   * 1. Clear grace timer (BUG-006)
   * 2. Remove all event listeners from peer connection (BUG-004)
   * 3. Remove all tracks from senders (BUG-004)
   * 4. Close peer connection (BUG-004)
   * 5. Stop and remove remote stream tracks (BUG-004)
   * 6. Null out references for GC (BUG-004)
   * 7. Set cooldown (BUG-006)
   * 
   * @param userId - User ID to disconnect from
   * @param setCooldown - Whether to set a cooldown period (default: true)
   * 
   * @see docs/bugs/video-calling/BUG-004-peer-connection-leak.md
   */
  private endProximityCallWithUser(userId: string, setCooldown: boolean = true): void {
    const participant = this.state.participants.get(userId);
    if (!participant) return;

    console.log(`🧹 [BUG-004] Starting cleanup for ${participant.username || userId}`);

    const { peerConnection, remoteStream } = participant;

    // BUG-006: Clear any pending grace timer
    if (participant.disconnectGraceTimer) {
      clearTimeout(participant.disconnectGraceTimer);
      participant.disconnectGraceTimer = null;
    }

    // BUG-004: Remove all event listeners BEFORE closing to prevent memory leaks
    if (peerConnection) {
      // Remove all event handlers
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.oniceconnectionstatechange = null;
      peerConnection.onnegotiationneeded = null;
      peerConnection.onsignalingstatechange = null;
      peerConnection.onicegatheringstatechange = null;
      peerConnection.ondatachannel = null;
      
      // BUG-004: Remove all tracks from senders to break references
      try {
        peerConnection.getSenders().forEach(sender => {
          try {
            peerConnection.removeTrack(sender);
          } catch (e) {
            // Ignore - track may already be removed
          }
        });
      } catch (e) {
        // Ignore - connection may be in invalid state
      }
      
      // Close the connection
      peerConnection.close();
      console.log(`🔌 [BUG-004] Peer connection closed for ${userId}`);
    }

    // BUG-004: Stop ALL remote stream tracks and remove from stream
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        track.stop();
        try {
          remoteStream.removeTrack(track);
        } catch (e) {
          // Ignore - track may already be removed
        }
      });
      console.log(`📹 [BUG-004] Remote stream tracks stopped for ${userId}`);
    }

    // BUG-004: Clear ICE restart attempts for this user
    this.iceRestartAttempts.delete(userId);

    // BUG-004: Null out references to allow garbage collection
    participant.peerConnection = null;
    participant.remoteStream = null;
    participant.localStream = null;

    // Remove from participants map
    this.state.participants.delete(userId);
    
    // BUG-006: Set cooldown to prevent rapid reconnection
    if (setCooldown) {
      this.callCooldowns.set(userId, Date.now() + COOLDOWN_PERIOD_MS);
      console.log(`🕐 [BUG-006] Set cooldown for ${participant.username || userId}`);
    }
    
    this.emit('participant-disconnected', { userId, username: participant.username });

    console.log(`✅ [BUG-004] Cleanup complete for ${userId}. Remaining participants: ${this.state.participants.size}`);

    // If no participants left, end the call
    if (this.state.participants.size === 0 && this.state.isActive) {
      this.endCall();
    }
  }

  /**
   * Check for proximity disconnections using grid-based distance
   * 
   * BUG-006 FIX: Complete rewrite with proper distance calculation
   * 
   * This method implements hysteresis and grace periods:
   * - Call starts when distance <= 2 tiles
   * - Call ends when distance > 3 tiles (hysteresis buffer)
   * - Grace period: Wait 2 seconds before actually ending
   * - If user returns within grace period, call continues
   * 
   * Uses Manhattan distance (grid units) for consistency with
   * the proximity detection system.
   * 
   * @see docs/bugs/video-calling/BUG-006-call-not-ending.md
   */
  private checkProximityDisconnections(): void {
    // Convert local position to grid coordinates
    const localGridPos = toGrid({ x: this.state.localPosition.x, y: this.state.localPosition.y });

    for (const [userId, participant] of this.state.participants) {
      // Convert participant position to grid coordinates
      const participantGridPos = toGrid({ x: participant.position.x, y: participant.position.y });
      
      // Calculate Manhattan distance in grid units (tiles)
      const distance = gridDistance(localGridPos, participantGridPos);

      // Check if participant is beyond the END threshold (with hysteresis)
      if (distance > CALL_END_DISTANCE_TILES) {
        // User is too far - start grace period if not already started
        if (!participant.isLeavingProximity && !participant.disconnectGraceTimer) {
          console.log(`⚠️ [BUG-006] ${participant.username || userId} is leaving proximity (${distance} tiles > ${CALL_END_DISTANCE_TILES}), starting grace period`);
          
          participant.isLeavingProximity = true;
          participant.disconnectGraceTimer = setTimeout(() => {
            // Re-check distance after grace period
            const currentLocalGridPos = toGrid({ x: this.state.localPosition.x, y: this.state.localPosition.y });
            const currentParticipant = this.state.participants.get(userId);
            
            if (!currentParticipant) return; // Already disconnected
            
            const currentParticipantGridPos = toGrid({ x: currentParticipant.position.x, y: currentParticipant.position.y });
            const currentDistance = gridDistance(currentLocalGridPos, currentParticipantGridPos);
            
            if (currentDistance > CALL_END_DISTANCE_TILES) {
              console.log(`🛑 [BUG-006] Grace period expired for ${currentParticipant.username || userId} (${currentDistance} tiles), ending call`);
              this.endProximityCallWithUser(userId);
            } else {
              console.log(`✅ [BUG-006] ${currentParticipant.username || userId} returned to proximity (${currentDistance} tiles), cancelling disconnect`);
              currentParticipant.isLeavingProximity = false;
              currentParticipant.disconnectGraceTimer = null;
            }
          }, GRACE_PERIOD_MS);
          
          // Notify UI that user is leaving
          this.emit('participant-leaving', { 
            userId, 
            username: participant.username,
            gracePeriodMs: GRACE_PERIOD_MS 
          });
        }
      } else if (participant.isLeavingProximity) {
        // User came back within range - cancel the grace period
        console.log(`↩️ [BUG-006] ${participant.username || userId} returned to proximity (${distance} tiles), cancelling disconnect`);
        
        if (participant.disconnectGraceTimer) {
          clearTimeout(participant.disconnectGraceTimer);
          participant.disconnectGraceTimer = null;
        }
        participant.isLeavingProximity = false;
        
        // Notify UI that user is back
        this.emit('participant-returned', { 
          userId, 
          username: participant.username 
        });
      }
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
   * 
   * BUG-004 FIX: Full cleanup with event listener removal
   * BUG-006 FIX: Clear grace timer when removing participant
   * 
   * This is a simpler version of endProximityCallWithUser without cooldowns.
   * Used for connection errors and signal handling failures.
   */
  private removeParticipant(userId: string): void {
    const participant = this.state.participants.get(userId);
    if (!participant) return;

    console.log(`🧹 [BUG-004] removeParticipant: cleaning up ${userId}`);

    // BUG-006: Clear any pending grace timer
    if (participant.disconnectGraceTimer) {
      clearTimeout(participant.disconnectGraceTimer);
      participant.disconnectGraceTimer = null;
    }
    
    // BUG-004: Remove event listeners before closing
    if (participant.peerConnection) {
      participant.peerConnection.ontrack = null;
      participant.peerConnection.onicecandidate = null;
      participant.peerConnection.onconnectionstatechange = null;
      participant.peerConnection.oniceconnectionstatechange = null;
      participant.peerConnection.onnegotiationneeded = null;
      participant.peerConnection.onsignalingstatechange = null;
      participant.peerConnection.onicegatheringstatechange = null;
      participant.peerConnection.ondatachannel = null;
      
      participant.peerConnection.close();
    }
    
    // BUG-004: Stop and remove all tracks
    if (participant.remoteStream) {
      participant.remoteStream.getTracks().forEach(track => {
        track.stop();
        try {
          participant.remoteStream?.removeTrack(track);
        } catch (e) {
          // Ignore
        }
      });
    }
    
    // BUG-004: Clear ICE restart attempts
    this.iceRestartAttempts.delete(userId);
    
    // BUG-004: Null references for GC
    participant.peerConnection = null;
    participant.remoteStream = null;
    participant.localStream = null;
    
    this.state.participants.delete(userId);
    this.emit('participant-left', { userId, username: participant.username });
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
        targetUserId?: string;
        offer?: RTCSessionDescriptionInit;
        answer?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidate;
      };
      if (!msg || !msg.type || !msg.fromUserId) {
        console.warn('Ignoring malformed proximity-video-call-signal', data);
        return;
      }
      // Cast to required format after validation, mapping toUserId -> targetUserId
      this.handleProximityCallSignal({
        type: msg.type,
        callId: msg.callId || '',
        fromUserId: msg.fromUserId,
        targetUserId: msg.targetUserId || msg.toUserId || '',
        offer: msg.offer,
        answer: msg.answer,
        candidate: msg.candidate
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