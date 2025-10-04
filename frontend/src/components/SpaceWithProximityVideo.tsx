import { ENV } from '@/CONFIG/env.config';
"use client";

import React, { useState, useEffect, useRef } from 'react';
import ProximityVideoCall from './ProximityVideoCall';

interface SpaceWithProximityVideoProps {
  userId: string;
  username: string;
  spaceId: string;
  // Add your existing space props here
}

const SpaceWithProximityVideo: React.FC<SpaceWithProximityVideoProps> = ({
  userId,
  username,
  spaceId
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    // Replace with your actual WebSocket URL
  const wsUrl = ENV.WS_URL;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);
      
      // Send join message (adapt to your existing protocol)
      ws.send(JSON.stringify({
        type: 'join-space',
        payload: {
          userId,
          username,
          spaceId
        }
      }));
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Handle your existing WebSocket messages
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle your existing message types
        switch (data.type) {
          case 'user-joined-space':
            console.log('User joined:', data.payload);
            break;
          case 'user-moved':
            console.log('User moved:', data.payload);
            break;
          case 'user-left':
            console.log('User left:', data.payload);
            break;
          // Video call messages are handled by the ProximityVideoCall component
          case 'video-call-start':
          case 'video-call-signaling':
          case 'video-call-end':
          case 'users-in-video-call':
            // These will be handled by the useProximityVideoCall hook
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [userId, username, spaceId]);

  // Function to send user movement (call this when user moves)
  // sendUserMovement currently unused; remove or implement when integrating movement sync

  return (
    <div className="relative w-full h-full">
      {/* Your existing space/room UI goes here */}
      <div className="space-content">
        {/* 
          Replace this with your existing SpaceViewer or room component
          Make sure to call sendUserMovement(x, y) when the user moves
        */}
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Space: {spaceId}</h2>
            <p className="text-gray-600 mb-2">User: {username}</p>
            <p className="text-sm text-gray-500">
              WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                🎥 Proximity video calling is active!
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Move within 2 tiles of another user to start a video call automatically
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Proximity Video Call Overlay */}
      <ProximityVideoCall
        userId={userId}
      />

      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-2 rounded-lg text-sm">
          Disconnected
        </div>
      )}
    </div>
  );
};

export default SpaceWithProximityVideo;