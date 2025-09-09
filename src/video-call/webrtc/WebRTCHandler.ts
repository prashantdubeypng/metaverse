import { EventEmitter } from 'events';
import { DEFAULT_RTC_CONFIG, DEFAULT_MEDIA_CONFIG } from '../../config/video-call.config.js';
import { SignalingMessage } from '../../types/video-call.js';

/**
 * WebRTC Handler for peer-to-peer video calls
 * Manages RTCPeerConnection, media streams, and signaling
 */
export class WebRTCHandler extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private socketConnection: any = null;
  private callId: string | null = null;
  private isInitiator: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize WebRTC handler with socket connection
   */
  initialize(socketConnection: any): void {
    this.socketConnection = socketConnection;
    this.setupSocketHandlers();
  }

  /**
   * Start a call as initiator
   */
  async startCall(callId: string): Promise<void> {
    this.callId = callId;
    this.isInitiator = true;
    
    await this.createPeerConnection();
    await this.getUserMedia();
    
    if (this.localStream && this.peerConnection) {
      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.sendSignalingMessage({
        type: 'offer',
        callId,
        payload: offer,
        timestamp: new Date()
      });
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callId: string): Promise<void> {
    this.callId = callId;
    this.isInitiator = false;
    
    await this.createPeerConnection();
    await this.getUserMedia();
    
    if (this.localStream && this.peerConnection) {
      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }
  }

  /**
   * Handle incoming signaling message
   */
  async handleSignalingMessage(message: SignalingMessage): void {
    if (!this.peerConnection || message.callId !== this.callId) {
      return;
    }

    try {
      switch (message.type) {
        case 'offer':
          await this.handleOffer(message.payload);
          break;
        case 'answer':
          await this.handleAnswer(message.payload);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message.payload);
          break;
        case 'call-end':
          this.endCall();
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
      this.emit('error', error);
    }
  }

  /**
   * End the current call
   */
  endCall(): void {
    // Send end call signal
    if (this.callId && this.socketConnection) {
      this.sendSignalingMessage({
        type: 'call-end',
        callId: this.callId,
        payload: {},
        timestamp: new Date()
      });
    }

    // Clean up peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear remote stream
    this.remoteStream = null;
    this.callId = null;
    this.isInitiator = false;

    this.emit('call-ended');
  }

  /**
   * Toggle microphone mute
   */
  toggleMute(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.emit('mute-toggled', !audioTrack.enabled);
      return !audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle camera on/off
   */
  toggleCamera(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.emit('camera-toggled', !videoTrack.enabled);
      return !videoTrack.enabled;
    }
    return false;
  }

  /**
   * Get local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote media stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Get connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  /**
   * Create RTCPeerConnection
   */
  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(DEFAULT_RTC_CONFIG);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.callId) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          callId: this.callId,
          payload: event.candidate,
          timestamp: new Date()
        });
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.emit('remote-stream', this.remoteStream);
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.emit('connection-state-change', state);
      
      if (state === 'connected') {
        this.emit('call-connected');
      } else if (state === 'disconnected' || state === 'failed') {
        this.emit('call-disconnected');
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      this.emit('ice-connection-state-change', state);
    };
  }

  /**
   * Get user media (camera and microphone)
   */
  private async getUserMedia(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: DEFAULT_MEDIA_CONFIG.video,
        audio: DEFAULT_MEDIA_CONFIG.audio
      });
      
      this.emit('local-stream', this.localStream);
    } catch (error) {
      console.error('Error getting user media:', error);
      this.emit('media-error', error);
      throw error;
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(offer);
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    if (this.callId) {
      this.sendSignalingMessage({
        type: 'answer',
        callId: this.callId,
        payload: answer,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    
    await this.peerConnection.setRemoteDescription(answer);
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    
    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Send signaling message through WebSocket
   */
  private sendSignalingMessage(message: SignalingMessage): void {
    if (this.socketConnection) {
      this.socketConnection.emit('webrtc-signal', message);
    }
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socketConnection) return;

    this.socketConnection.on('webrtc-signal', (message: SignalingMessage) => {
      this.handleSignalingMessage(message);
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.endCall();
    this.removeAllListeners();
    this.socketConnection = null;
  }
}