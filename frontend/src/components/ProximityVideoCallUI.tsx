import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useProximityVideoCall } from '@/hooks/useProximityVideoCall';

interface VideoStreamProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  username?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  className?: string;
}

const VideoStream: React.FC<VideoStreamProps> = ({
  stream,
  isLocal = false,
  username = '',
  isMuted = false,
  isVideoOff = false,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative rounded-lg overflow-hidden bg-gray-900 ${className}`}>
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video to prevent feedback
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-white text-sm">{username}</p>
            {isVideoOff && <p className="text-gray-400 text-xs mt-1">Camera Off</p>}
          </div>
        </div>
      )}

      {/* Username overlay */}
      {username && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
          {username}
          {isLocal && ' (You)'}
        </div>
      )}

      {/* Audio indicator */}
      {isMuted && (
        <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1.586l4.707-4.707C10.923 5.663 12 6.109 12 7v10c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        </div>
      )}

      {/* Connection status indicator */}
      {!isLocal && (
        <div className="absolute top-2 left-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
};

interface ProximityVideoCallUIProps {
  userId: string;
  username: string;
  className?: string;
}

const ProximityVideoCallUI: React.FC<ProximityVideoCallUIProps> = ({
  userId,
  username,
  className = ''
}) => {
  const {
    isCallActive,
    participants,
    localStream,
    isMuted,
    isCameraOff,
    isScreenSharing,
    error,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    endCall,
    clearError,
    initialize,
    isInitialized
  } = useProximityVideoCall();

  const [callDuration, setCallDuration] = useState(0);
  const callStartTime = useRef<Date | null>(null);
  
  // Window state
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Initialize video call manager
  useEffect(() => {
    if (!isInitialized) {
      initialize(userId);
    }
  }, [userId, initialize, isInitialized]);

  // Track call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isCallActive) {
      if (!callStartTime.current) {
        callStartTime.current = new Date();
      }
      
      interval = setInterval(() => {
        if (callStartTime.current) {
          const now = new Date();
          const diff = Math.floor((now.getTime() - callStartTime.current.getTime()) / 1000);
          setCallDuration(diff);
        }
      }, 1000);
    } else {
      callStartTime.current = null;
      setCallDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Initialize window position (right side of screen)
  useEffect(() => {
    if (isCallActive && position.x === 0 && position.y === 0) {
      setPosition({
        x: window.innerWidth - 320, // 320px from right edge
        y: 100 // 100px from top
      });
    }
  }, [isCallActive, position.x, position.y]);

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y))
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Debug logging
  useEffect(() => {
    console.log('🎥 [ProximityVideoCallUI] State update:', {
      isCallActive,
      participantsCount: participants.length,
      hasLocalStream: !!localStream,
      isInitialized,
      error
    });
  }, [isCallActive, participants.length, localStream, isInitialized, error]);

  if (!isCallActive) {
    return null; // Call UI only shows when there's an active call
  }

  const getVideoLayout = () => {
    if (isMinimized) return 'hidden';
    
    const totalParticipants = participants.length + (localStream ? 1 : 0);

    if (isExpanded) {
      if (totalParticipants <= 2) {
        return 'grid-cols-1 md:grid-cols-2';
      } else if (totalParticipants <= 4) {
        return 'grid-cols-2';
      } else {
        return 'grid-cols-3';
      }
    } else {
      // Compact mode - single column
      return 'grid-cols-1';
    }
  };

  const getWindowSize = () => {
    if (isMinimized) {
      return 'w-64 h-12';
    } else if (isExpanded) {
      return 'w-96 h-80';
    } else {
      return 'w-80 h-64'; // Default compact size
    }
  };

  return (
    <div 
      ref={windowRef}
      className={`fixed bg-gray-900 rounded-lg shadow-2xl border border-gray-700 z-50 ${getWindowSize()} ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Error banner */}
      {error && (
        <div className="absolute -top-12 left-0 right-0 z-50">
          <div className="bg-red-600 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
            <button onClick={clearError} className="ml-2 text-white hover:text-gray-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Call status header - draggable */}
      <div 
        className="bg-gray-800 px-3 py-2 rounded-t-lg border-b border-gray-700 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">
              {isMinimized ? 'Video Call' : `Video Call (${participants.length + 1})`}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isMinimized && callDuration > 0 && (
              <div className="text-gray-300 text-xs">
                {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
                {(callDuration % 60).toString().padStart(2, '0')}
              </div>
            )}
            
            {/* Window controls */}
            <div className="flex items-center space-x-1">
              {/* Minimize/Restore button */}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="w-5 h-5 rounded hover:bg-gray-600 flex items-center justify-center transition-colors"
                title={isMinimized ? 'Restore' : 'Minimize'}
              >
                {isMinimized ? (
                  <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                )}
              </button>
              
              {/* Expand/Compact button */}
              {!isMinimized && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-5 h-5 rounded hover:bg-gray-600 flex items-center justify-center transition-colors"
                  title={isExpanded ? 'Compact' : 'Expand'}
                >
                  {isExpanded ? (
                    <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21l4-4 4 4" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3l4 4 4-4" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Video grid */}
      {!isMinimized && (
        <div className="p-3">
          <div className={`grid gap-2 ${getVideoLayout()}`}>
            {/* Local video (always first) */}
            {localStream && (
              <VideoStream
                stream={localStream}
                isLocal={true}
                username={username}
                isMuted={isMuted}
                isVideoOff={isCameraOff}
                className={`aspect-video ${isExpanded ? 'h-40' : 'h-24'}`}
              />
            )}

            {/* Remote participants */}
            {participants.map((participant) => (
              <VideoStream
                key={participant.userId}
                stream={participant.stream}
                username={participant.username}
                isMuted={!participant.isAudioEnabled}
                isVideoOff={!participant.isVideoEnabled}
                className={`aspect-video ${isExpanded ? 'h-40' : 'h-24'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Screen sharing indicator */}
      {!isMinimized && isScreenSharing && (
        <div className="px-3 pb-2">
          <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Screen Sharing</span>
          </div>
        </div>
      )}

      {/* Compact Call Controls */}
      {!isMinimized && (
        <div className="bg-gray-800 px-3 py-2 rounded-b-lg border-t border-gray-700">
          <div className="flex items-center justify-center space-x-2">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* Camera Button */}
            <button
              onClick={toggleCamera}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isCameraOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isCameraOff ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
              title="End call"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Auto-call notification - only show when not minimized */}
      {!isMinimized && (
        <div className="absolute -bottom-8 left-0 right-0">
          <div className="bg-blue-600/90 text-white px-2 py-1 rounded text-xs text-center">
            🔗 Proximity call • Move away to disconnect
          </div>
        </div>
      )}
    </div>
  );
};

export default ProximityVideoCallUI;