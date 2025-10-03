"use client";

import React, { useState } from 'react';
import { User, Position3D } from '@/types/video-call';
import Image from 'next/image';

interface NearbyUser extends User {
  position: Position3D;
  distance: number;
  isInCallRange: boolean;
  isCurrentlyInCall: boolean;
  isOnline: boolean;
}

interface NearbyUsersPanelProps {
  nearbyUsers: NearbyUser[];
  currentUserPosition: Position3D;
  onInitiateCall: (userId: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const NearbyUsersPanel: React.FC<NearbyUsersPanelProps> = ({
  nearbyUsers,
  currentUserPosition,
  onInitiateCall,
  isMinimized = false,
  onToggleMinimize
}) => {
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [filterOnline, setFilterOnline] = useState<boolean>(true);

  const sortedUsers = [...nearbyUsers]
    .filter(user => !filterOnline || user.isOnline)
    .sort((a, b) => {
      if (sortBy === 'distance') {
        return a.distance - b.distance;
      }
      return a.username.localeCompare(b.username);
    });

  const getDistanceColor = (distance: number, isInCallRange: boolean): string => {
    if (!isInCallRange) return 'text-gray-400';
    if (distance <= 3) return 'text-green-600';
    if (distance <= 7) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getStatusIcon = (user: NearbyUser) => {
    if (user.isCurrentlyInCall) {
      return (
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" title="In call" />
      );
    }
    if (user.isInCallRange && user.isOnline) {
      return (
        <div className="w-3 h-3 bg-green-500 rounded-full" title="Available for call" />
      );
    }
    if (user.isOnline) {
      return (
        <div className="w-3 h-3 bg-blue-500 rounded-full" title="Online" />
      );
    }
    return (
      <div className="w-3 h-3 bg-gray-400 rounded-full" title="Offline" />
    );
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border">
        <button
          onClick={onToggleMinimize}
          className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <div className="flex -space-x-2">
            {sortedUsers.slice(0, 3).map((user) => (
              <div key={user.id} className="relative">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.username}
                    width={24}
                    height={24}
                    className="rounded-full border-2 border-white"
                  />
                ) : (
                  <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white text-xs">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="text-sm font-medium">
            {nearbyUsers.length} nearby
          </span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 w-80 bg-white rounded-lg shadow-lg border max-h-96 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Nearby Users
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {nearbyUsers.length} users
            </span>
            {onToggleMinimize && (
              <button
                onClick={onToggleMinimize}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'distance' | 'name')}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="distance">By Distance</option>
              <option value="name">By Name</option>
            </select>
          </div>
          
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={filterOnline}
              onChange={(e) => setFilterOnline(e.target.checked)}
              className="rounded"
            />
            <span>Online only</span>
          </label>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto">
        {sortedUsers.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <p>No users nearby</p>
          </div>
        ) : (
          <div className="divide-y">
            {sortedUsers.map((user) => (
              <div key={user.id} className="p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {user.avatar ? (
                        <Image
                          src={user.avatar}
                          alt={user.username}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1">
                        {getStatusIcon(user)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.username}
                      </p>
                      <p className={`text-xs ${getDistanceColor(user.distance, user.isInCallRange)}`}>
                        {user.distance.toFixed(1)} units away
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center space-x-2">
                    {user.isInCallRange && user.isOnline && !user.isCurrentlyInCall ? (
                      <button
                        onClick={() => onInitiateCall(user.id)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                        title="Start video call"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    ) : user.isCurrentlyInCall ? (
                      <div className="p-2 bg-gray-200 rounded-full" title="User is in a call">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                        </svg>
                      </div>
                    ) : !user.isInCallRange ? (
                      <div className="p-2 bg-gray-200 rounded-full" title="Too far for video call">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="p-2 bg-gray-200 rounded-full" title="User is offline">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 5.636l12.728 12.728M5.636 18.364l12.728-12.728" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            Your position: ({currentUserPosition.x.toFixed(1)}, {currentUserPosition.y.toFixed(1)}, {(currentUserPosition.z || 0).toFixed(1)})
          </span>
          <span className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Call range: 10 units</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default NearbyUsersPanel;
