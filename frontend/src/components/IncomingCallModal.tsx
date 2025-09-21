"use client";

import React, { useState, useEffect } from 'react';
import { IncomingCall } from '@/types/video-call';
import Image from 'next/image';

interface IncomingCallModalProps {
  incomingCall: IncomingCall;
  onAccept: (callId: string) => void;
  onReject: (callId: string, reason?: string) => void;
  isVisible: boolean;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onReject,
  isVisible
}) => {
  const [timeElapsed, setTimeElapsed] = useState<number>(0);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - incomingCall.timestamp.getTime()) / 1000);
      setTimeElapsed(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, incomingCall.timestamp]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 animate-bounce">
        {/* Caller Info */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            {incomingCall.callerAvatar ? (
              <Image
                src={incomingCall.callerAvatar}
                alt={incomingCall.callerUsername}
                width={96}
                height={96}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">
                  {incomingCall.callerUsername.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {incomingCall.callerUsername}
          </h3>
          
          <p className="text-gray-600 mb-2">Incoming video call</p>
          
          <p className="text-sm text-gray-500">
            Ringing for {timeElapsed}s
          </p>
        </div>

        {/* Call Type Badge */}
        <div className="flex justify-center mb-6">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            {incomingCall.type === 'peer-to-peer' ? 'Direct Call' : 'Group Call'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          {/* Reject Button */}
          <button
            onClick={() => onReject(incomingCall.id, 'User declined')}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
            </svg>
            <span>Decline</span>
          </button>

          {/* Accept Button */}
          <button
            onClick={() => onAccept(incomingCall.id)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>Accept</span>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex justify-center space-x-4">
          <button
            onClick={() => onReject(incomingCall.id, 'User is busy')}
            className="text-gray-600 hover:text-gray-800 text-sm px-4 py-2 rounded transition-colors"
          >
            I&apos;m busy
          </button>
          <button
            onClick={() => onReject(incomingCall.id, 'Call back later')}
            className="text-gray-600 hover:text-gray-800 text-sm px-4 py-2 rounded transition-colors"
          >
            Call back later
          </button>
        </div>
      </div>

      {/* Ringing Animation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="relative w-full h-full">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-96 h-96 border-4 border-blue-500 rounded-full animate-ping opacity-20"></div>
          </div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-80 h-80 border-4 border-blue-400 rounded-full animate-ping opacity-30 animation-delay-500"></div>
          </div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-64 h-64 border-4 border-blue-300 rounded-full animate-ping opacity-40 animation-delay-1000"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
