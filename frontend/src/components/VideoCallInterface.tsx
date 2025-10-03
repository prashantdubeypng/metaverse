"use client";

import React, { useRef, useEffect, useState } from 'react';
import { CallSession, User } from '@/types/video-call';

interface VideoCallInterfaceProps {
  callSession: CallSession;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  remoteUser?: User;
}

const VideoCallInterface: React.FC<VideoCallInterfaceProps> = ({
  callSession,
  localStream,
  remoteStream,
  isMuted,
  isCameraOn,
  isScreenSharing,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  remoteUser
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callDuration, setCallDuration] = useState<string>('00:00');

  // Set up local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set up remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    const startTime = callSession.startTime.getTime();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [callSession.startTime]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Call Header */}
      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt={remoteUser.username} className="w-10 h-10 rounded-full" />
            ) : (
              <span className="text-white font-semibold">
                {remoteUser?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold">{remoteUser?.username || 'Unknown User'}</h3>
            <p className="text-gray-300 text-sm">{callDuration}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm ${
            callSession.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'
          }`}>
            <span className="text-white capitalize">{callSession.status}</span>
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
        {!remoteStream && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">
                  {remoteUser?.username?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <p className="text-white text-lg">Waiting for {remoteUser?.username || 'user'} to join...</p>
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isCameraOn && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Call Controls */}
      <div className="bg-gray-900 p-6">
        <div className="flex items-center justify-center space-x-4">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isMuted ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
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
            onClick={onToggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              !isCameraOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isCameraOn ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            )}
          </button>

          {/* Screen Share Button */}
          <button
            onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallInterface;
