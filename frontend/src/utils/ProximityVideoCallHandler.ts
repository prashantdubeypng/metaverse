export class ProximityVideoCallHandler {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private websocket: WebSocket | null = null;
  private isCallActive: boolean = false;

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

  constructor(websocket: WebSocket) {
    this.websocket = websocket;
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
      console.log('🎥 Proximity video call starting:', payload);
      
  const callData = payload as { callId: string; participants: unknown[] };
  const callDataObj = callData as { callId: string; participants: unknown[] };
  this.currentCallId = callDataObj.callId;
      this.isCallActive = true;

      // Get user media
      await this.initializeLocalStream();

      // Setup peer connection
      await this.setupPeerConnection();

      // Determine if we should create offer (first user alphabetically creates offer)
    const participants = (callData as { callId: string; participants: unknown[] }).participants;
      const currentUserId = this.getCurrentUserId(); // You'll need to implement this
  const participantObj = participants[0] as { userId: string };
  const shouldCreateOffer = participantObj.userId === currentUserId;

      if (shouldCreateOffer) {
        await this.createOffer();
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
  const signalData = payload as { callId: string; signalingData: unknown };
  if (!this.peerConnection || signalData.callId !== this.currentCallId) {
      console.warn('⚠️ Received signaling for inactive call');
      return;
    }

    try {
  const { signalingData } = signalData;

      const signalObj = signalingData as { type: string; offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit; candidate?: RTCIceCandidate };
      switch (signalObj.type) {
        case 'offer':
          await this.handleOffer(signalObj.offer!);
          break;
        case 'answer':
          await this.handleAnswer(signalObj.answer!);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(signalObj.candidate!);
          break;
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
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        offer: offer
      });

      console.log('Offer sent');
    } catch (error) {
      throw new Error(`Failed to create offer: ${error}`);
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(offer);
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: 'answer',
        answer: answer
      });

      console.log('📤 Answer sent');
    } catch (error) {
      throw new Error(`Failed to handle offer: ${error}`);
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(answer);
      console.log('✅ Answer processed');
    } catch (error) {
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