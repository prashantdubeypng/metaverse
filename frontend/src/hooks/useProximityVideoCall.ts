import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@/types/video-call';
import proximityVideoCallManager from '@/services/proximityVideoCall';
import websocketService from '@/services/websocket';

interface ParticipantInfo {
  userId: string;
  username: string;
  stream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  connectionState: RTCPeerConnectionState;
}

interface ProximityVideoCallHookState {
  isCallActive: boolean;
  participants: ParticipantInfo[];
  localStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isInitialized: boolean;
  error: string | null;
}

export function useProximityVideoCall() {
  const [state, setState] = useState<ProximityVideoCallHookState>({
    isCallActive: false,
    participants: [],
    localStream: null,
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    isInitialized: false,
    error: null,
  });

  const participantStreams = useRef<Map<string, MediaStream>>(new Map());

  /**
   * Update state from proximity call manager
   */
  const updateState = useCallback(() => {
    const callState = proximityVideoCallManager.getState();
    const participants = proximityVideoCallManager.getParticipants();

    const participantInfo: ParticipantInfo[] = participants.map(p => ({
      userId: p.userId,
      username: p.username,
      stream: participantStreams.current.get(p.userId) || null,
      isAudioEnabled: p.isAudioEnabled,
      isVideoEnabled: p.isVideoEnabled,
      isScreenSharing: p.isScreenSharing,
      connectionState: p.connectionState,
    }));

    setState(prev => {
      // Only update if something actually changed
      const hasChanged = 
        prev.isCallActive !== callState.isActive ||
        prev.participants.length !== participantInfo.length ||
        prev.localStream !== callState.localStream ||
        prev.isMuted !== callState.isMuted ||
        prev.isCameraOff !== callState.isCameraOff ||
        prev.isScreenSharing !== callState.isScreenSharing ||
        !prev.participants.every((prevP, index) => {
          const newP = participantInfo[index];
          return newP && prevP.userId === newP.userId && 
                 prevP.isAudioEnabled === newP.isAudioEnabled &&
                 prevP.isVideoEnabled === newP.isVideoEnabled &&
                 prevP.connectionState === newP.connectionState;
        });

      if (!hasChanged) {
        return prev;
      }

      return {
        ...prev,
        isCallActive: callState.isActive,
        participants: participantInfo,
        localStream: callState.localStream,
        isMuted: callState.isMuted,
        isCameraOff: callState.isCameraOff,
        isScreenSharing: callState.isScreenSharing,
      };
    });
  }, []);

  const isInitializedRef = useRef(false);

  /**
   * Initialize proximity video call manager
   */
  const initialize = useCallback(async (userId: string) => {
    if (isInitializedRef.current) return; // Guard against duplicate init calls
    
    try {
      isInitializedRef.current = true;
      // Inject WebSocket service (idempotent; internally resets listeners each time)
      proximityVideoCallManager.setWebSocketService(websocketService);
      await proximityVideoCallManager.initialize(userId);
      setState(prev => ({ ...prev, isInitialized: true, error: null }));
    } catch (error) {
      isInitializedRef.current = false;
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize video call',
      }));
    }
  }, []);

  /**
   * Update user position
   */
  const updatePosition = useCallback((x: number, y: number, z: number = 0) => {
    proximityVideoCallManager.updatePosition(x, y, z);
  }, []);

  /**
   * Handle nearby users update
   */
  const handleNearbyUsers = useCallback((nearbyUsers: User[]) => {
    proximityVideoCallManager.handleNearbyUsersUpdate(nearbyUsers);
  }, []);

  /**
   * Toggle microphone mute
   */
  const toggleMute = useCallback(() => {
    const isMuted = proximityVideoCallManager.toggleMute();
    setState(prev => ({ ...prev, isMuted }));
    return isMuted;
  }, []);

  /**
   * Toggle camera on/off
   */
  const toggleCamera = useCallback(() => {
    const isCameraOff = proximityVideoCallManager.toggleCamera();
    setState(prev => ({ ...prev, isCameraOff }));
    return isCameraOff;
  }, []);

  /**
   * Start screen sharing
   */
  const startScreenShare = useCallback(async () => {
    const success = await proximityVideoCallManager.startScreenShare();
    if (success) {
      setState(prev => ({ ...prev, isScreenSharing: true }));
    }
    return success;
  }, []);

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(async () => {
    await proximityVideoCallManager.stopScreenShare();
    setState(prev => ({ ...prev, isScreenSharing: false }));
  }, []);

  /**
   * Toggle screen sharing
   */
  const toggleScreenShare = useCallback(async () => {
    if (state.isScreenSharing) {
      await stopScreenShare();
      return false;
    } else {
      return await startScreenShare();
    }
  }, [state.isScreenSharing, startScreenShare, stopScreenShare]);

  /**
   * End the call
   */
  const endCall = useCallback(() => {
    proximityVideoCallManager.endCall();
    participantStreams.current.clear();
    setState(prev => ({
      ...prev,
      isCallActive: false,
      participants: [],
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
    }));
  }, []);

  /**
   * Get participant stream by user ID
   */
  const getParticipantStream = useCallback((userId: string): MediaStream | null => {
    return participantStreams.current.get(userId) || null;
  }, []);

  /**
   * Set up event listeners
   */
  useEffect(() => {
    const manager = proximityVideoCallManager;

    // Call state events
    manager.on('initialized', updateState);
    manager.on('proximity-call-started', updateState);
    manager.on('call-ended', updateState);

    // Participant events
    manager.on('participant-connecting', (data: { userId: string; username: string }) => {
      console.log(`Participant connecting: ${data.username}`);
      updateState();
    });

    manager.on('participant-connected', (data: { userId: string; username: string }) => {
      console.log(`Participant connected: ${data.username}`);
      updateState();
    });

    manager.on('participant-disconnected', (data: { userId: string; username: string }) => {
      console.log(`Participant disconnected: ${data.username}`);
      participantStreams.current.delete(data.userId);
      updateState();
    });

    manager.on('participant-left', (data: { userId: string; username: string }) => {
      console.log(`Participant left: ${data.username}`);
      participantStreams.current.delete(data.userId);
      updateState();
    });

    // Stream events
    manager.on('local-stream-ready', (_stream: MediaStream) => {
      console.log('Local stream ready');
      updateState();
    });

    manager.on('participant-stream', (data: { userId: string; stream: MediaStream }) => {
      console.log(`Participant stream received: ${data.userId}`);
      participantStreams.current.set(data.userId, data.stream);
      updateState();
    });

    // Media control events
    manager.on('audio-toggled', (data: { isMuted: boolean }) => {
      setState(prev => ({ ...prev, isMuted: data.isMuted }));
    });

    manager.on('video-toggled', (data: { isCameraOff: boolean }) => {
      setState(prev => ({ ...prev, isCameraOff: data.isCameraOff }));
    });

    manager.on('screen-share-started', () => {
      setState(prev => ({ ...prev, isScreenSharing: true }));
    });

    manager.on('screen-share-stopped', () => {
      setState(prev => ({ ...prev, isScreenSharing: false }));
    });

    // Error events
    manager.on('error', (error: string) => {
      setState(prev => ({ ...prev, error }));
    });

    // Connection events
    manager.on('participant-connection-state', (data: { userId: string; state: RTCPeerConnectionState }) => {
      console.log(`Participant ${data.userId} connection state: ${data.state}`);
      updateState();
    });

    // Cleanup
    return () => {
      manager.removeAllListeners();
    };
  }, [updateState]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    const streamsRef = participantStreams.current; // capture ref snapshot
    return () => {
      proximityVideoCallManager.destroy();
      streamsRef.clear();
    };
  }, []);

  return {
    // State
    isCallActive: state.isCallActive,
    participants: state.participants,
    localStream: state.localStream,
    isMuted: state.isMuted,
    isCameraOff: state.isCameraOff,
    isScreenSharing: state.isScreenSharing,
    isInitialized: state.isInitialized,
    error: state.error,

    // Actions
    initialize,
    updatePosition,
    handleNearbyUsers,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    startScreenShare,
    stopScreenShare,
    endCall,
    getParticipantStream,

    // Utilities
    clearError: () => setState(prev => ({ ...prev, error: null })),
  };
}