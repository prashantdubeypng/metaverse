import { VideoCallSystem } from '../VideoCallSystem.js';
import { User } from '../../types/video-call.js';

/**
 * Example integration of the VideoCallSystem
 * This shows how to integrate video calls into your frontend application
 */

// Initialize the video call system
const videoCallSystem = new VideoCallSystem();

// Example integration function
export async function initializeVideoCallsForUser(
  userId: string, 
  websocketConnection: WebSocket
): Promise<VideoCallSystem> {
  
  // Initialize the system
  await videoCallSystem.initialize(userId, websocketConnection);
  
  console.log('Video call system initialized for user:', userId);
  
  return videoCallSystem;
}

// Example: Update user position (call this when user moves in your 3D space)
export function updateUserPosition(x: number, y: number, z: number): void {
  videoCallSystem.updatePosition(x, y, z);
}

// Example: Get nearby users for calling
export function getNearbyUsersForCalling(): User[] {
  return videoCallSystem.getNearbyUsers();
}

// Example: Initiate a call to a nearby user
export async function callUser(targetUser: User): Promise<void> {
  try {
    const callSession = await videoCallSystem.initiateCall(targetUser);
    console.log('Call initiated:', callSession);
  } catch (error) {
    console.error('Failed to initiate call:', error);
  }
}

// Example: Handle incoming calls
export function handleIncomingCalls(): void {
  const incomingCalls = videoCallSystem.getIncomingCalls();
  
  incomingCalls.forEach(call => {
    console.log(`Incoming call from ${call.fromUser.username}`);
    
    // You would show UI here to accept/reject
    // For example:
    // showIncomingCallModal(call);
  });
}

// Example: Accept a call
export async function acceptIncomingCall(callId: string): Promise<void> {
  try {
    const callSession = await videoCallSystem.acceptCall(callId);
    console.log('Call accepted:', callSession);
  } catch (error) {
    console.error('Failed to accept call:', error);
  }
}

// Example: Reject a call
export function rejectIncomingCall(callId: string): void {
  videoCallSystem.rejectCall(callId);
  console.log('Call rejected:', callId);
}

// Example: End current call
export function endCurrentCall(): void {
  videoCallSystem.endCall();
  console.log('Call ended');
}

// Example: Toggle mute
export function toggleMicrophone(): boolean {
  const isMuted = videoCallSystem.toggleMute();
  console.log('Microphone muted:', isMuted);
  return isMuted;
}

// Example: Toggle camera
export function toggleCamera(): boolean {
  const isCameraOn = videoCallSystem.toggleCamera();
  console.log('Camera on:', isCameraOn);
  return isCameraOn;
}

// Example: Get media streams for your video elements
export function getMediaStreams(): {
  local: MediaStream | null;
  remote: MediaStream | null;
} {
  return {
    local: videoCallSystem.getLocalStream(),
    remote: videoCallSystem.getRemoteStream()
  };
}

// Example: Get system status
export function getVideoCallStatus(): any {
  return videoCallSystem.getStatus();
}

// Example: Cleanup when user leaves
export function cleanupVideoCallSystem(): void {
  videoCallSystem.destroy();
  console.log('Video call system cleaned up');
}

/**
 * Complete integration example:
 * 
 * // 1. Initialize when user enters metaverse
 * const websocket = new WebSocket('ws://localhost:3001');
 * await initializeVideoCallsForUser('user123', websocket);
 * 
 * // 2. Update position when user moves
 * updateUserPosition(10, 5, 0);
 * 
 * // 3. Get nearby users and show them in your UI
 * const nearbyUsers = getNearbyUsersForCalling();
 * 
 * // 4. Call a user when they click on them
 * await callUser(nearbyUsers[0]);
 * 
 * // 5. Handle incoming calls in your UI
 * handleIncomingCalls();
 * 
 * // 6. Accept/reject calls based on user interaction
 * await acceptIncomingCall('call-id');
 * 
 * // 7. Control media during calls
 * toggleMicrophone();
 * toggleCamera();
 * 
 * // 8. Display video streams in your video elements
 * const { local, remote } = getMediaStreams();
 * if (local) localVideoElement.srcObject = local;
 * if (remote) remoteVideoElement.srcObject = remote;
 * 
 * // 9. End calls
 * endCurrentCall();
 * 
 * // 10. Cleanup when done
 * cleanupVideoCallSystem();
 */