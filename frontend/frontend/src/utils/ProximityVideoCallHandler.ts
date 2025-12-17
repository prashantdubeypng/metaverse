export class ProximityVideoCallHandler {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private websocket: WebSocket | null = null;
  private isCallActive: boolean = false;
  private currentUserId: string = '';

  // WebRTC Configuration
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Event callbacks
  private onLocalStreamCallback?: (stream: MediaStream) => void;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onCallStartCallback?: (callData: unknown) => void;
  private onCallEndCallback?: (reason: string) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(websocket: WebSocket, userId: string) {
    this.websocket = websocket;
    this.currentUserId = userId;
    console.log('ProximityVideoCallHandler initialized for user:', userId);
  }

  // Set event callbacks
  onLocalStream(callback: (stream: MediaStream) => void) {
    this.onLocalStreamCallback = callback;
  }

  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onCallStart(callback: (callData: unknown) => void) {
    this.onCallStartCallback = callback;
  }

  onCallEnd(callback: (reason: string) => void) {
    this.onCallEndCallback = callback;
  }

  onError(callback: (error: string) => void) {
    this.onErrorCallback = callback;
  }

  /**
   * Handle incoming video call start from backend
   */
  async handleVideoCallStart(payload: unknown): Promise<void> {
    try {
      console.log('🎥 [CALL START] Proximity video call starting:', payload);
      
      const callData = payload as { callId: string; participants: Array<{ userId: string; username: string; x: number; y: number }> };
      this.currentCallId = callData.callId;
      this.isCallActive = true;

      console.log('🎥 [CALL START] Call ID:', this.currentCallId);
      console.log('🎥 [CALL START] Participants:', callData.participants);
      console.log('🎥 [CALL START] Current User ID:', this.currentUserId);

      // Get user media
      await this.initializeLocalStream();

      // Setup peer connection
      await this.setupPeerConnection();

      // Determine if we should create offer (first user alphabetically creates offer)
      const participants = callData.participants;
      const participantIds = participants.map(p => p.userId).sort();
      const shouldCreateOffer = participantIds[0] === this.currentUserId;

      console.log('🎥 [CALL START] Sorted participant IDs:', participantIds);
      console.log('🎥 [CALL START] Should create offer:', shouldCreateOffer);

      if (shouldCreateOffer) {
        console.log('🎥 [OFFER] Creating offer as first user...');
        await this.createOffer();
      } else {
        console.log('🎥 [ANSWER] Waiting for offer from other user...');
      }

      // Notify UI
      this.onCallStartCallback?.(payload);

    } catch (error) {
      console.error('❌ Error starting video call:', error);
      this.onErrorCallback?.(`Failed to start call: ${error}`);
      this.cleanup();
    }
  }

  /**
   * Handle WebRTC signaling messages from backend
   */
  async handleWebRTCSignaling(payload: unknown): Promise<void> {
    const signalData = payload as { callId: string; fromUserId: string; signalingData: unknown };
    
    console.log('📡 [SIGNALING] Received signaling message:', signalData);
    
    if (!this.peerConnection || signalData.callId !== this.currentCallId) {
      console.warn('[SIGNALING] Received signaling for inactive call or no peer connection');
      console.log(' [SIGNALING] Current call ID:', this.currentCallId, 'Received call ID:', signalData.callId);
      console.log(' [SIGNALING] Peer connection exists:', !!this.peerConnection);
      return;
    }

    try {
      const { signalingData, fromUserId } = signalData;
      console.log('📡 [SIGNALING] From user:', fromUserId, 'To user:', this.currentUserId);

      const signalObj = signalingData as { type: string; offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit; candidate?: RTCIceCandidate };
      
      console.log('📡 [SIGNALING] Signal type:', signalObj.type);
      
      switch (signalObj.type) {
        case 'offer':
          console.log('📡 [OFFER] Received offer from user:', fromUserId);
          console.log('📡 [OFFER] Offer details:', signalObj.offer);
          await this.handleOffer(signalObj.offer!);
          break;
        case 'answer':
          console.log('📡 [ANSWER] Received answer from user:', fromUserId);
          console.log('📡 [ANSWER] Answer details:', signalObj.answer);
          await this.handleAnswer(signalObj.answer!);
          break;
        case 'ice-candidate':
          console.log('📡 [ICE] Received ICE candidate from user:', fromUserId);
          console.log('📡 [ICE] Candidate details:', signalObj.candidate);
          await this.handleIceCandidate(signalObj.candidate!);
          break;
        default:
          console.warn('📡 [SIGNALING] Unknown signal type:', signalObj.type);
      }
    } catch (error) {
      console.error('❌ Error handling signaling:', error);
      this.onErrorCallback?.(`Signaling error: ${error}`);
    }
  }

  /**
   * Handle video call end from backend
   */
  handleVideoCallEnd(payload: unknown): void {
  const endData = payload as { reason: string };
  console.log('🔚 Video call ended:', endData.reason);
  this.onCallEndCallback?.(endData.reason);
    this.cleanup();
  }

  /**
   * Initialize local media stream
   */
  private async initializeLocalStream(): Promise<void> {
    try {
      console.log('Requesting camera and microphone permission...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });

      console.log('📹 Local stream initialized');
      this.onLocalStreamCallback?.(this.localStream);
    } catch (error) {
      throw new Error(`Failed to get user media: ${error}`);
    }
  }

  /**
   * Setup RTCPeerConnection
   */
  private async setupPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('📡 Remote stream received');
      this.remoteStream = event.streams[0];
      this.onRemoteStreamCallback?.(this.remoteStream);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Log the candidate to extract the user's IP address
        const candidateStr = event.candidate.candidate;
        const ipMatch = candidateStr.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
          console.log('User local IP from ICE candidate:', ipMatch[1]);
        }
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', this.peerConnection?.connectionState);
      
      if (this.peerConnection?.connectionState === 'failed' || 
          this.peerConnection?.connectionState === 'disconnected') {
        this.handleConnectionFailure();
      }
    };
  }

  /**
   * Create WebRTC offer
   */
  private async createOffer(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      console.log('🎯 [OFFER] Creating offer...');
      const offer = await this.peerConnection.createOffer();
      console.log('🎯 [OFFER] Offer created:', offer);
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('🎯 [OFFER] Local description set');

      this.sendSignalingMessage({
        type: 'offer',
        offer: offer
      });

      console.log('🎯 [OFFER] Offer sent to other user');
    } catch (error) {
      console.error('❌ [OFFER] Failed to create offer:', error);
      throw new Error(`Failed to create offer: ${error}`);
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      console.log('📥 [OFFER] Handling incoming offer...');
      console.log('📥 [OFFER] Offer details:', offer);
      
      await this.peerConnection.setRemoteDescription(offer);
      console.log('📥 [OFFER] Remote description set');
      
      const answer = await this.peerConnection.createAnswer();
      console.log('📤 [ANSWER] Answer created:', answer);
      
      await this.peerConnection.setLocalDescription(answer);
      console.log('📤 [ANSWER] Local description set');

      this.sendSignalingMessage({
        type: 'answer',
        answer: answer
      });

      console.log('📤 [ANSWER] Answer sent to other user');
    } catch (error) {
      console.error('❌ [ANSWER] Failed to handle offer:', error);
      throw new Error(`Failed to handle offer: ${error}`);
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      console.log('📥 [ANSWER] Handling incoming answer...');
      console.log('📥 [ANSWER] Answer details:', answer);
      
      await this.peerConnection.setRemoteDescription(answer);
      console.log('✅ [ANSWER] Answer processed and remote description set');
    } catch (error) {
      console.error('❌ [ANSWER] Failed to handle answer:', error);
      throw new Error(`Failed to handle answer: ${error}`);
    }
  }

  /**
   * Handle ICE candidate
   */
  private async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('🧊 ICE candidate added');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
    }
  }

  /**
   * Send signaling message to backend
   */
  private sendSignalingMessage(signalingData: unknown): void {
    if (!this.websocket || !this.currentCallId) return;

    const message = {
      type: 'video-call-signaling',
      payload: {
        callId: this.currentCallId,
        signalingData: signalingData
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(): void {
    console.warn('⚠️ WebRTC connection failed');
    this.onErrorCallback?.('Connection failed');
    this.cleanup();
  }

  /**
   * Manually end call
   */
  endCall(): void {
    if (!this.currentCallId) return;

    const message = {
      type: 'video-call-end',
      payload: {
        callId: this.currentCallId
      }
    };

    this.websocket?.send(JSON.stringify(message));
    this.cleanup();
  }

  /**
   * Toggle audio mute
   */
  toggleMute(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // Return muted state
    }
    return false;
  }

  /**
   * Toggle video
   */
  toggleVideo(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled; // Return video enabled state
    }
    return false;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    console.log('🧹 Cleaning up video call resources');

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.currentCallId = null;
    this.isCallActive = false;
    this.remoteStream = null;
  }

  /**
   * Get current user ID (implement based on your auth system)
   */
  private getCurrentUserId(): string {
    // TODO: Implement this based on your authentication system
    // For now, return a placeholder
    return localStorage.getItem('userId') || 'unknown';
  }

  /**
   * Check if call is active
   */
  isInCall(): boolean {
    return this.isCallActive;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}