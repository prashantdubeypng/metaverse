// Complete Frontend Video Call Implementation
// TypeScript version for your React/Next.js project

export class VideoCallHandler {
  private ws: WebSocket;
  private userId: string;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private isInCall: boolean = false;

  // WebRTC configuration
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // UI elements
  private localVideo: HTMLVideoElement | null = null;
  private remoteVideo: HTMLVideoElement | null = null;

  constructor(websocket: WebSocket, userId: string) {
    this.ws = websocket;
    this.userId = userId;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Add video call message handlers to your existing WebSocket
    const originalOnMessage = this.ws.onmessage;
      this.ws.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
      
        // Handle video call messages
        switch(data.type) {
          case 'video-call-start':
            this.handleCallStart(data.payload);
            break;
          case 'video-call-signaling':
            this.handleSignaling(data.payload);
            break;
          case 'video-call-end':
            this.handleCallEnd(data.payload);
            break;
          case 'users-in-video-call':
            this.handleUsersInCall(data.payload);
            break;
          default:
            // Call original handler for other messages
            if (originalOnMessage) {
              originalOnMessage.call(this.ws, event);
            }
        }
      };
  }

  // Called when backend starts a proximity-based video call
  private async handleCallStart(payload: unknown): Promise<void> {
    console.log('Video call starting:', payload);
  const callData = payload as { callId: string; participants: unknown[] };
  this.currentCallId = callData.callId;
    this.isInCall = true;

    // Find the other participant
    const callData2 = payload as { callId: string; participants: unknown[] };
    const otherParticipant = callData2.participants.find((p: unknown) => (p as { userId: string }).userId !== this.userId);
    const otherParticipantObj = otherParticipant as { userId: string };

    try {
      // Get user media (camera and microphone)
      await this.startLocalMedia();

      // Create peer connection
      await this.createPeerConnection();

      // Determine who initiates the call (user with smaller ID)
  const shouldInitiate = this.userId < otherParticipantObj.userId;
      if (shouldInitiate) {
        // Create and send offer
        const offer = await this.peerConnection!.createOffer();
        await this.peerConnection!.setLocalDescription(offer);
        this.sendSignaling({
          type: 'offer',
          offer: offer
        });
      }

      // Show video call UI
      this.showVideoCallUI(otherParticipant);
    } catch (error) {
      console.error('Error starting video call:', error);
      this.endCall();
    }
  }

  // Handle WebRTC signaling messages
  private async handleSignaling(payload: unknown): Promise<void> {
  const signalData = payload as { callId: string; signalingData: unknown };
  if (!this.peerConnection || signalData.callId !== this.currentCallId) {
      return;
    }

  const { signalingData } = signalData;
  const signalObj = signalingData as { type: string; offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit; candidate?: RTCIceCandidate };
  try {
    switch(signalObj.type) {
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
    console.error(' Error handling signaling:', error);
  }
  }

  // Handle incoming offer
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection!.setRemoteDescription(offer);
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    this.sendSignaling({
      type: 'answer',
      answer: answer
    });
  }

  // Handle incoming answer
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection!.setRemoteDescription(answer);
  }

  // Handle ICE candidates
  private async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    await this.peerConnection!.addIceCandidate(candidate);
  }

  // Handle call end
  private handleCallEnd(payload: unknown): void {
  const endData = payload as { reason: string };
  console.log('Video call ended:', endData.reason);
    this.endCall();
  }

  // Handle other users in calls (for UI updates)
  private handleUsersInCall(payload: unknown): void {
    // Update UI to show which users are in video calls
  const usersData = payload as { userIds: string[] };
  console.log('Users in video calls:', usersData.userIds);
  }

  // Start local media (camera/microphone)
  private async startLocalMedia(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Display local video
      if (this.localVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      console.log('Local media started');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  // Create WebRTC peer connection
  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      this.remoteStream = event.streams[0];
      if (this.remoteVideo) {
        this.remoteVideo.srcObject = this.remoteStream;
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection!.connectionState);
      if (this.peerConnection!.connectionState === 'connected') {
        console.log('Video call connected!');
      } else if (this.peerConnection!.connectionState === 'failed') {
        console.log('Video call connection failed');
        this.endCall();
      }
    };
  }

  // Send signaling data to backend
  private sendSignaling(data: unknown): void {
    this.ws.send(JSON.stringify({
      type: 'video-call-signaling',
      payload: data
    }));
  }

  // End the current call
  public endCall(): void {
    console.log('Ending video call');

    // Send end call message to backend
    if (this.currentCallId) {
      this.ws.send(JSON.stringify({
        type: 'video-call-end',
        payload: { callId: this.currentCallId }
      }));
    }

    // Clean up WebRTC
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local media
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear video elements
    if (this.localVideo) {
      this.localVideo.srcObject = null;
    }
    if (this.remoteVideo) {
      this.remoteVideo.srcObject = null;
    }

    // Hide video call UI
    this.hideVideoCallUI();

    // Reset state
    this.currentCallId = null;
    this.isInCall = false;
    this.remoteStream = null;
  }

  // Toggle mute
  public toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log(' Audio muted:', !audioTrack.enabled);
        return !audioTrack.enabled;
      }
    }
    return false;
  }

  // Toggle camera
  public toggleCamera(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('Video disabled:', !videoTrack.enabled);
        return !videoTrack.enabled;
      }
    }
    return false;
  }

  // Show video call UI
  private showVideoCallUI(otherParticipant: unknown): void {
    // Create or show your video call UI elements
  const participant = otherParticipant as { username: string };
  console.log('Showing video call UI for:', participant.username);
    
    // Example: Create video elements if they don't exist
    if (!this.localVideo) {
      this.createVideoElements();
    }

    // Show the video call container
    const videoContainer = document.getElementById('video-call-container');
    if (videoContainer) {
      videoContainer.style.display = 'block';
    }
  }

  // Hide video call UI
  private hideVideoCallUI(): void {
    console.log('Hiding video call UI');
    const videoContainer = document.getElementById('video-call-container');
    if (videoContainer) {
      videoContainer.style.display = 'none';
    }
  }

  // Create video elements (you can customize this)
  private createVideoElements(): void {
    // Create local video element
    this.localVideo = document.createElement('video');
    this.localVideo.id = 'local-video';
    this.localVideo.autoplay = true;
    this.localVideo.muted = true; // Always mute local video
    this.localVideo.style.width = '200px';
    this.localVideo.style.height = '150px';

    // Create remote video element
    this.remoteVideo = document.createElement('video');
    this.remoteVideo.id = 'remote-video';
    this.remoteVideo.autoplay = true;
    this.remoteVideo.style.width = '400px';
    this.remoteVideo.style.height = '300px';

    // Add to your UI container
    const container = document.getElementById('video-call-container');
    if (container) {
      container.appendChild(this.remoteVideo);
      container.appendChild(this.localVideo);
    }
  }

  // Get current call status
  public getCallStatus(): {
    isInCall: boolean;
    callId: string | null;
    hasLocalStream: boolean;
    hasRemoteStream: boolean;
    connectionState: string;
  } {
    return {
      isInCall: this.isInCall,
      callId: this.currentCallId,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      connectionState: this.peerConnection?.connectionState || 'disconnected'
    };
  }

  // Set video elements (for React integration)
  public setVideoElements(localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement): void {
    this.localVideo = localVideo;
    this.remoteVideo = remoteVideo;
    
    // If we already have streams, connect them
    if (this.localStream && this.localVideo) {
      this.localVideo.srcObject = this.localStream;
    }
    if (this.remoteStream && this.remoteVideo) {
      this.remoteVideo.srcObject = this.remoteStream;
    }
  }
}