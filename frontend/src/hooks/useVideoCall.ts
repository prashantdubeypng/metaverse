"use client";

import { ENV } from '@/CONFIG/env.config';

import { useState, useEffect, useCallback } from 'react';
import { 
  CallState,
  CallSession, 
  IncomingCall, 
  User, 
  Position3D 
} from '@/types/video-call';
import websocketService from '@/services/websocket';

interface UseVideoCallProps {
  currentUser: User;
  // currentPosition removed (unused)
  webSocketUrl?: string;
}

export interface UseVideoCallReturn {
  // State
  callState: CallState;
  currentSession: CallSession | null;
  incomingCall: IncomingCall | null;
  nearbyUsers: Array<User & { position: Position3D; distance: number; isInCallRange: boolean; isCurrentlyInCall: boolean }>;
  
  // Actions
  initiateCall: (targetUserId: string) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string, reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  
  // Media controls
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnectionReady: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

export const useVideoCall = ({ 
  currentUser, 
  webSocketUrl = ENV.WS_URL 
}: UseVideoCallProps): UseVideoCallReturn => {
  // Core state
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<Array<User & { position: Position3D; distance: number; isInCallRange: boolean; isCurrentlyInCall: boolean }>>([]);
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnectionReady, setIsConnectionReady] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'disconnected'>('disconnected');
  
  // Use unified WebSocket service instead of creating new connection
  
  // Initialize WebSocket connection via service
  useEffect(() => {
    const ws = websocketService.socket;
    if (!ws) {
      console.log('WebSocket service not connected, skipping video call initialization');
      return;
    }
    
    const _handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      console.log('Video call message:', message);
      
      switch (message.type) {
        case 'incoming-call':
          setIncomingCall(message.payload);
          setCallState('incoming');
          break;
        case 'call-accepted':
          setCallState('active');
          setIncomingCall(null);
          break;
        case 'call-rejected':
          setCallState('idle');
          setIncomingCall(null);
          break;
        case 'call-ended':
          setCurrentSession(null);
          setCallState('idle');
          setIncomingCall(null);
          setLocalStream(null);
          setRemoteStream(null);
          setIsConnectionReady(false);
          break;
        case 'proximity-update':
          setNearbyUsers(message.payload.nearbyUsers || []);
          break;
      }
    };
    
    // Register video call message handler
    websocketService.on('incoming-call', (payload) => {
      setIncomingCall(payload as IncomingCall);
      setCallState('incoming');
    });
    
    websocketService.on('call-accepted', (_payload) => {
      setCallState('active');
      setIncomingCall(null);
    });
    
    websocketService.on('call-rejected', (_payload) => {
      setCallState('idle');
      setIncomingCall(null);
    });
    
    websocketService.on('call-ended', (_payload) => {
      setCurrentSession(null);
      setCallState('idle');
      setIncomingCall(null);
      setLocalStream(null);
      setRemoteStream(null);
      setIsConnectionReady(false);
    });
    
    websocketService.on('proximity-update', (payload) => {
      const nearbyUsersData = (payload as { nearbyUsers?: Array<User & { position: Position3D; distance: number; isInCallRange: boolean; isCurrentlyInCall: boolean }> }).nearbyUsers || [];
      setNearbyUsers(nearbyUsersData);
    });
    
    setConnectionQuality('excellent');
    
    return () => {
      // Cleanup event listeners when component unmounts - no parameters needed for websocket service
      if (websocketService.socket) {
        websocketService.socket.close();
      }
    };
  }, [webSocketUrl]);
  
  // Actions
  const initiateCall = useCallback(async (targetUserId: string) => {
    if (callState !== 'idle') return;
    
    try {
      setCallState('initiating');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      
      // Send call initiation via WebSocket service
      if (websocketService.socket && websocketService.socket.readyState === WebSocket.OPEN) {
        websocketService.send('initiate-call', {
          targetUserId,
          callerId: currentUser.id,
          type: 'peer-to-peer'
        });
      }
      
      setCallState('calling');
    } catch (error) {
      console.error('Failed to initiate call:', error);
      setCallState('idle');
      setLocalStream(null);
    }
  }, [callState, currentUser.id]);
  
  const acceptCall = useCallback(async (callId: string) => {
    if (!incomingCall) return;
    
    try {
      setCallState('accepting');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      
      // Send acceptance via WebSocket service
      if (websocketService.socket && websocketService.socket.readyState === WebSocket.OPEN) {
        websocketService.send('accept-call', { callId });
      }
      
    } catch (error) {
      console.error('Failed to accept call:', error);
      setCallState('idle');
      setIncomingCall(null);
      setLocalStream(null);
    }
  }, [incomingCall]);
  
  const rejectCall = useCallback(async (callId: string, reason?: string) => {
    if (websocketService.socket && websocketService.socket.readyState === WebSocket.OPEN) {
      websocketService.send('reject-call', { callId, reason });
    }
    
    setIncomingCall(null);
    setCallState('idle');
  }, []);
  
  const endCall = useCallback(async () => {
    if (!currentSession) return;
    
    if (websocketService.socket && websocketService.socket.readyState === WebSocket.OPEN) {
      websocketService.send('end-call', { callId: currentSession.id });
    }
    
    // Clean up local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    setCurrentSession(null);
    setCallState('idle');
    setRemoteStream(null);
    setIsConnectionReady(false);
  }, [currentSession, localStream]);
  
  const toggleMute = useCallback(() => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
    }
  }, [localStream]);
  
  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
    }
  }, [localStream]);
  
  const toggleScreenShare = useCallback(async () => {
    if (!currentSession) return;
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });
      
      // Update local stream
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const newStream = new MediaStream([stream.getVideoTracks()[0], audioTrack]);
        setLocalStream(newStream);
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  }, [currentSession, localStream]);
  
  return {
    // State
    callState,
    currentSession,
    incomingCall,
    nearbyUsers,
    
    // Actions
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    
    // Media
    localStream,
    remoteStream,
    isConnectionReady,
    connectionQuality
  };
};
