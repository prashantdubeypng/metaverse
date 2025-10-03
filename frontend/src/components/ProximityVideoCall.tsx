"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useProximityVideoCall } from '@/hooks/useProximityVideoCall';

interface ProximityVideoCallProps {
  userId: string;
  className?: string;
}

const ProximityVideoCall: React.FC<ProximityVideoCallProps> = ({
  userId,
  className = ''
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callDurationDisplay, setCallDurationDisplay] = useState('00:00');

  // Use hook (no arguments per implementation)
  const {
    isCallActive,
    participants,
    localStream,
    isMuted,
    isCameraOff,
    error,
    endCall,
    toggleMute,
    toggleCamera,
    clearError,
    initialize,
    isInitialized
  } = useProximityVideoCall();

  // Initialize on mount with userId
  useEffect(() => {
    if (!isInitialized && userId) {
      initialize(userId);
    }
  }, [isInitialized, initialize, userId]);

  // Derivations
  const otherParticipant = participants[0];
  const remoteStream = otherParticipant?.stream || null;
  const isVideoEnabled = !isCameraOff; // original UI expectation

  // Update local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Update remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Update call duration display
  // Derive call duration locally (since hook doesn't expose callDuration)
  const callStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isCallActive) {
      callStartRef.current = null;
      setCallDurationDisplay('00:00');
      return;
    }
    if (!callStartRef.current) {
      callStartRef.current = Date.now();
    }
    const interval = setInterval(() => {
      if (callStartRef.current) {
        const elapsed = Math.floor((Date.now() - callStartRef.current) / 1000);
        const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const ss = (elapsed % 60).toString().padStart(2, '0');
        setCallDurationDisplay(`${mm}:${ss}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Don't render if not in call
  if (!isCallActive) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-40 w-80 bg-gray-900 rounded-xl shadow-xl overflow-hidden border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {otherParticipant?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-white text-xs font-medium leading-tight">{otherParticipant?.username || 'Participant'}</p>
            <p className="text-gray-400 text-[10px] font-mono">{callDurationDisplay}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <span className="px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px]">Proximity</span>
          <button
            onClick={endCall}
            className="p-1 rounded hover:bg-red-600/20 text-red-400 hover:text-red-300 transition"
            title="End call"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="relative h-48 bg-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80">
            <div className="w-14 h-14 bg-gray-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-white text-xl font-semibold">
                {otherParticipant?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <p className="text-gray-300 text-xs">Connecting...</p>
          </div>
        )}
        {/* Local PiP */}
        <div className="absolute bottom-2 right-2 w-24 h-16 bg-gray-700 rounded-md overflow-hidden border border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
          )}
          <div className="absolute bottom-0 left-0 text-[9px] text-white bg-black/50 px-1 rounded-tr">You</div>
        </div>
        {/* Proximity indicator dot */}
        <div className="absolute top-2 left-2 flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-[10px]">Close</span>
        </div>
      </div>

      {/* Controls */}
      <div className="p-2 flex items-center justify-around bg-gray-800 border-t border-gray-700">
        <button
          onClick={toggleMute}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <button
          onClick={toggleCamera}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            !isVideoEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
          }`}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          )}
        </button>
        <button
          onClick={endCall}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition"
          title="End call"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
          </svg>
        </button>
      </div>

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-x-0 top-10 mx-2 bg-red-600/90 text-white px-2 py-1 rounded text-[10px] flex items-center justify-between">
          <span className="truncate pr-2">{error}</span>
          <button onClick={clearError} className="text-white hover:text-gray-200">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProximityVideoCall;