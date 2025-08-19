import React, { useState, useEffect } from 'react';
import { chatService } from '../services/chatService';

interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  isConnected: boolean;
  currentRoom: string | null;
  reconnectAttempts: number;
  socketId?: string;
}

const ConnectionStatusIndicator: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'disconnected',
    isConnected: false,
    currentRoom: null,
    reconnectAttempts: 0
  });

  useEffect(() => {
    // Initial status
    const status = chatService.getStatus();
    setConnectionStatus(prev => ({
      ...prev,
      ...status,
      status: status.isConnected ? 'connected' : 'disconnected'
    }));

    // Listen to connection status changes
    const unsubscribeConnection = chatService.onConnection((status) => {
      setConnectionStatus(prev => ({
        ...prev,
        status,
        isConnected: status === 'connected',
        ...(status === 'connected' && { reconnectAttempts: 0 })
      }));
    });

    // Update status periodically
    const statusInterval = setInterval(() => {
      const currentStatus = chatService.getStatus();
      setConnectionStatus(prev => ({
        ...prev,
        ...currentStatus
      }));
    }, 5000);

    return () => {
      unsubscribeConnection();
      clearInterval(statusInterval);
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return 'bg-green-500';
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return connectionStatus.currentRoom 
          ? `Connected to ${connectionStatus.currentRoom}` 
          : 'Connected to chat';
      case 'reconnecting':
        return `Reconnecting... (${connectionStatus.reconnectAttempts})`;
      case 'error':
        return 'Connection failed';
      default:
        return 'Disconnected';
    }
  };

  const handleReconnect = () => {
    chatService.forceReconnect();
  };

  const handleGetStats = () => {
    chatService.getRoomStats();
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      {/* Status Indicator */}
      <div className="flex items-center space-x-2">
        <div 
          className={`w-3 h-3 rounded-full ${getStatusColor()} ${
            connectionStatus.status === 'reconnecting' ? 'animate-pulse' : ''
          }`}
        />
        <span className="text-gray-700 dark:text-gray-300">
          {getStatusText()}
        </span>
      </div>

      {/* Action Buttons */}
      {connectionStatus.status === 'error' && (
        <button
          onClick={handleReconnect}
          className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          Reconnect
        </button>
      )}

      {connectionStatus.status === 'connected' && connectionStatus.currentRoom && (
        <button
          onClick={handleGetStats}
          className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
          title="Get room statistics"
        >
          Stats
        </button>
      )}

      {/* Socket ID (for debugging) */}
      {process.env.NODE_ENV === 'development' && connectionStatus.socketId && (
        <span className="text-xs text-gray-400 font-mono">
          {connectionStatus.socketId.slice(0, 8)}...
        </span>
      )}
    </div>
  );
};

export default ConnectionStatusIndicator;
