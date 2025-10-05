import { ENV } from '@/CONFIG/env.config';
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CallState,
  CallSession, 
  IncomingCall, 
  User, 
  Position3D 
} from '@/types/video-call';

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
  
  // WebSocket reference
  const websocketRef = useRef<WebSocket | null>(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(webSocketUrl);
    websocketRef.current = ws;
    
    ws.onopen = () => {
      console.log('Video call WebSocket connected');
      setConnectionQuality('excellent');
    };
    
    ws.onmessage = (event) => {
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
    
    ws.onclose = () => {
      console.log('Video call WebSocket disconnected');
      setConnectionQuality('disconnected');
    };
    
    return () => {
      ws.close();
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
      
      // Send call initiation via WebSocket
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'initiate-call',
          payload: {
            targetUserId,
            callerId: currentUser.id,
            type: 'peer-to-peer'
          }
        }));
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
      
      // Send acceptance via WebSocket
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'accept-call',
          payload: { callId }
        }));
      }
      
    } catch (error) {
      console.error('Failed to accept call:', error);
      setCallState('idle');
      setIncomingCall(null);
      setLocalStream(null);
    }
  }, [incomingCall]);
  
  const rejectCall = useCallback(async (callId: string, reason?: string) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'reject-call',
        payload: { callId, reason }
      }));
    }
    
    setIncomingCall(null);
    setCallState('idle');
  }, []);
  
  const endCall = useCallback(async () => {
    if (!currentSession) return;
    
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'end-call',
        payload: { callId: currentSession.id }
      }));
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
