import React, { useRef, useEffect, useState } from 'react';
import CallControls from './CallControls';
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

  if (!isCallActive) {
    return null; // Call UI only shows when there's an active call
  }

  const getVideoLayout = () => {
    const totalParticipants = participants.length + (localStream ? 1 : 0);

    if (totalParticipants <= 2) {
      return 'grid-cols-1 md:grid-cols-2';
    } else if (totalParticipants <= 4) {
      return 'grid-cols-2';
    } else {
      return 'grid-cols-3';
    }
  };

  return (
    <div className={`fixed inset-0 z-40 bg-black ${className}`}>
      {/* Error banner */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
            <button onClick={clearError} className="ml-2 text-white hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Call status header */}
      <div className="absolute top-4 left-4 z-50">
        <div className="bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              Proximity Call ({participants.length + 1} participant{participants.length !== 0 ? 's' : ''})
            </span>
          </div>
          {callDuration > 0 && (
            <div className="text-sm text-gray-300">
              {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
              {(callDuration % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </div>

      {/* Video grid */}
      <div className={`grid gap-4 p-4 h-full ${getVideoLayout()}`}>
        {/* Local video (always first) */}
        {localStream && (
          <VideoStream
            stream={localStream}
            isLocal={true}
            username={username}
            isMuted={isMuted}
            isVideoOff={isCameraOff}
            className="aspect-video"
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
            className="aspect-video"
          />
        ))}
      </div>

      {/* Screen sharing indicator */}
      {isScreenSharing && (
        <div className="absolute top-20 left-4 z-50">
          <div className="bg-blue-600 text-white px-3 py-1 rounded-lg flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Sharing Screen</span>
          </div>
        </div>
      )}

      {/* Participants list (when many participants) */}
      {participants.length > 3 && (
        <div className="absolute top-4 right-4 z-50">
          <div className="bg-black bg-opacity-60 text-white p-3 rounded-lg max-w-xs">
            <h4 className="text-sm font-medium mb-2">Participants ({participants.length + 1})</h4>
            <div className="space-y-1">
              <div className="text-xs flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{username} (You)</span>
              </div>
              {participants.map((participant) => (
                <div key={participant.userId} className="text-xs flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    participant.connectionState === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                  <span>{participant.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call Controls */}
      <CallControls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        isCallActive={isCallActive}
        onMuteToggle={toggleMute}
        onCameraToggle={toggleCamera}
        onScreenShareToggle={toggleScreenShare}
        onEndCall={endCall}
        callDuration={callDuration}
        showVolumeControl={true}
      />

      {/* Auto-call notification */}
      <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-blue-600 bg-opacity-90 text-white px-4 py-2 rounded-lg text-sm">
          🔗 Auto-connected via proximity • Move away to disconnect
        </div>
      </div>
    </div>
  );
};

export default ProximityVideoCallUI;