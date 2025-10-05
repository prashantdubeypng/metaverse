import { SignalingMessage } from '@/types/video-call';

export class WebRTCHandler {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string | null = null;
  private isInitiator: boolean = false;

  // Configuration for STUN/TURN servers
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add your TURN servers here for production
    ],
    iceCandidatePoolSize: 10
  };

  // Event callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onSignalingMessageCallback: ((message: SignalingMessage) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  constructor(
    private userId: string,
    private onRemoteStream: (stream: MediaStream) => void,
    private onConnectionStateChange: (state: RTCPeerConnectionState) => void,
    private onSignalingMessage: (message: SignalingMessage) => void,
    private onError: (error: string) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onConnectionStateChangeCallback = onConnectionStateChange;
    this.onSignalingMessageCallback = onSignalingMessage;
    this.onErrorCallback = onError;
  }

  async initializeLocalStream(video = true, audio = true): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 640, height: 480 } : false,
        audio: audio
      });
      return this.localStream;
    } catch (error) {
      const errorMsg = `Failed to get user media: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.onErrorCallback?.(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async startCall(callId: string, targetUserId: string): Promise<void> {
    try {
      this.callId = callId;
      this.isInitiator = true;
      
      await this.setupPeerConnection();
      
      if (!this.localStream) {
        await this.initializeLocalStream();
      }

      // Add local stream to peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

      // Create offer
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      // Send offer through signaling
      this.onSignalingMessageCallback?.({
        type: 'offer',
        callId,
        senderId: this.userId,
        receiverId: targetUserId,
        payload: offer
      });

    } catch (error) {
      this.onErrorCallback?.(`Failed to start call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async acceptCall(callId: string, _callerId: string): Promise<void> {
    try {
      this.callId = callId;
      this.isInitiator = false;
      
      await this.setupPeerConnection();
      
      if (!this.localStream) {
        await this.initializeLocalStream();
      }

      // Add local stream to peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

    } catch (error) {
      this.onErrorCallback?.(`Failed to accept call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return;
    }

    try {
      switch (message.type) {
        case 'offer':
          const offer = message.payload as RTCSessionDescriptionInit;
          await this.peerConnection.setRemoteDescription(offer);
          
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          
          this.onSignalingMessageCallback?.({
            type: 'answer',
            callId: message.callId,
            senderId: this.userId,
            receiverId: message.senderId,
            payload: answer
          });
          break;

        case 'answer':
          const answer_payload = message.payload as RTCSessionDescriptionInit;
          await this.peerConnection.setRemoteDescription(answer_payload);
          break;

        case 'ice-candidate':
          const candidate = message.payload as RTCIceCandidate;
          await this.peerConnection.addIceCandidate(candidate);
          break;

        case 'call-end':
          this.endCall();
          break;
      }
    } catch (error) {
      this.onErrorCallback?.(`Error handling signaling message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setupPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.onRemoteStreamCallback?.(this.remoteStream);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.callId) {
        this.onSignalingMessageCallback?.({
          type: 'ice-candidate',
          callId: this.callId,
          senderId: this.userId,
          receiverId: '', // Will be set by the signaling server
          payload: event.candidate
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        this.onConnectionStateChangeCallback?.(this.peerConnection.connectionState);
        
        if (this.peerConnection.connectionState === 'failed' || 
            this.peerConnection.connectionState === 'disconnected') {
          this.endCall();
        }
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
    };
  }

  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      if (this.peerConnection && this.localStream) {
        // Replace video track with screen share
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );

        if (sender) {
          await sender.replaceTrack(videoTrack);
        }

        // Handle screen share end
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      return screenStream;
    } catch (error) {
      this.onErrorCallback?.(`Failed to start screen share: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (this.peerConnection && this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      }
    }
  }

  endCall(): void {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.callId = null;
    this.isInitiator = false;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  isCallActive(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }
}
