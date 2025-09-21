"use client";

import React, { useEffect, useRef, useState } from 'react';
import { VideoCallHandler } from '@/utils/VideoCallHandler';

interface VideoCallContainerProps {
  websocket: WebSocket | null;
  userId: string;
  username: string;
}

const VideoCallContainer: React.FC<VideoCallContainerProps> = ({
  websocket,
  userId,
  username: _username
}) => {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callStatus, setCallStatus] = useState('disconnected');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const videoCallHandlerRef = useRef<VideoCallHandler | null>(null);

  // Initialize VideoCallHandler when websocket is available
  useEffect(() => {
    if (!websocket || !userId) return;

    console.log('🎥 Initializing VideoCallHandler for user:', userId);
    const handler = new VideoCallHandler(websocket, userId);
    videoCallHandlerRef.current = handler;

    // Set video elements
    if (localVideoRef.current && remoteVideoRef.current) {
      handler.setVideoElements(localVideoRef.current, remoteVideoRef.current);
    }

    // Poll call status
    const statusInterval = setInterval(() => {
      const status = handler.getCallStatus();
      setIsInCall(status.isInCall);
      setCallStatus(status.connectionState);
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      if (handler.getCallStatus().isInCall) {
        handler.endCall();
      }
    };
  }, [websocket, userId]);

  // Set video elements when refs are ready
  useEffect(() => {
    if (videoCallHandlerRef.current && localVideoRef.current && remoteVideoRef.current) {
      videoCallHandlerRef.current.setVideoElements(localVideoRef.current, remoteVideoRef.current);
    }
  }, []);

  const handleEndCall = () => {
    if (videoCallHandlerRef.current) {
      videoCallHandlerRef.current.endCall();
    }
  };

  const handleToggleMute = () => {
    if (videoCallHandlerRef.current) {
      const muted = videoCallHandlerRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleToggleCamera = () => {
    if (videoCallHandlerRef.current) {
      const cameraOff = videoCallHandlerRef.current.toggleCamera();
      setIsCameraOff(cameraOff);
    }
  };

  // Don't render if not in call
  if (!isInCall) {
    return (
      <div id="video-call-container" style={{ display: 'none' }}>
        {/* Hidden video elements for the handler to use */}
        <video ref={localVideoRef} style={{ display: 'none' }} />
        <video ref={remoteVideoRef} style={{ display: 'none' }} />
      </div>
    );
  }

  return (
    <div 
      id="video-call-container" 
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{ display: isInCall ? 'flex' : 'none' }}
    >
      {/* Call Header */}
      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">📹</span>
          </div>
          <div>
            <h3 className="text-white font-semibold">Proximity Video Call</h3>
            <p className="text-gray-300 text-sm">Status: {callStatus}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1 rounded-full text-sm bg-green-600">
            <span className="text-white">Within 2 tiles</span>
          </div>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative">
        {/* Remote Video (Main) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
        />
        
        {/* Remote Video Placeholder */}
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-white text-2xl font-semibold">👤</span>
            </div>
            <p className="text-white text-lg">Connecting to nearby user...</p>
            <p className="text-gray-400 text-sm mt-2">
              You are within 2 tiles of each other
            </p>
          </div>
        </div>

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden border-2 border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isCameraOff && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
          )}
          <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1 rounded">
            You
          </div>
        </div>

        {/* Proximity Indicator */}
        <div className="absolute top-4 left-4 bg-green-600/90 text-white px-3 py-2 rounded-lg flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Auto-connected</span>
        </div>
      </div>

      {/* Call Controls */}
      <div className="bg-gray-900 p-6">
        <div className="flex items-center justify-center space-x-4">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Camera Button */}
          <button
            onClick={handleToggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isCameraOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {!isCameraOff ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
            title="End call"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
            </svg>
          </button>
        </div>

        {/* Auto-disconnect notice */}
        <div className="mt-4 text-center">
          <p className="text-gray-400 text-sm">
            Call will automatically end when you move more than 2 tiles apart
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoCallContainer;