"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getTokenData, clearTokenData } from '@/utils/auth';
import { useProximityVideoCall } from '@/hooks/useProximityVideoCall';
import ProximityVideoCallUI from '@/components/ProximityVideoCallUI';
import websocketService from '@/services/websocket';

interface User {
  id: string;
  username: string;
  x: number;
  y: number;
  isCurrentUser?: boolean;
}

interface SpaceElement {
  id: string;
  elementId: string;
  x: number;
  y: number;
  static?: boolean;
  element: {
    id: string;
    width: number;
    height: number;
    imageUrl?: string;
    static?: boolean;
  };
}

interface Space {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: string | null;
}

interface Chatroom {
  id: string;
  name: string;
  description?: string;
  spaceId: string;
  creatorId: string;
  createdAt: string;
  creator: {
    id: string;
    username: string;
  };
  _count: {
    members: number;
  };
}

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  user: {
    id: string;
    username: string;
  };
  chatroomId: string;
  type: 'text' | 'image' | 'file';
  createdAt: string;
}

export default function SpacePage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.id as string;

  const [space, setSpace] = useState<Space | null>(null);
  const [elements, setElements] = useState<SpaceElement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Not Connected');
  const [showActiveUsers, setShowActiveUsers] = useState(true);
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);

  // Chat system state
  const [showChat, setShowChat] = useState(false);
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([]);
  const [activeChatroom, setActiveChatroom] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChatrooms, setIsLoadingChatrooms] = useState(false);
  const [chatError, setChatError] = useState('');
  const [showCreateChatroom, setShowCreateChatroom] = useState(false);
  const [showJoinChatroom, setShowJoinChatroom] = useState(false);
  const [joinChatroomId, setJoinChatroomId] = useState('');
  const [joinChatroomPassword, setJoinChatroomPassword] = useState('');

  // Create chatroom form state
  const [newChatroomName, setNewChatroomName] = useState('');
  const [newChatroomDescription, setNewChatroomDescription] = useState('');
  const [newChatroomPassword, setNewChatroomPassword] = useState('');
  const [isCreatingChatroom, setIsCreatingChatroom] = useState(false);

  // Grid system constants
  const GRID_SIZE = 20; // Each grid cell is 20x20 pixels
  const PROXIMITY_DISTANCE = 2; // 2 tiles distance for video calls

  // Video call integration
  const shouldEnableVideoCalls = currentUser && currentUser.id && currentUser.username;
  const proximityVideoCall = useProximityVideoCall();

  // Initialize proximity video call system
  useEffect(() => {
    if (shouldEnableVideoCalls && currentUser?.id && !proximityVideoCall.isInitialized) {
      console.log('🚀 [DEBUG] Initializing proximity video call system:', {
        shouldEnableVideoCalls,
        currentUserId: currentUser.id,
        currentUsername: currentUser.username,
        isInitialized: proximityVideoCall.isInitialized,
        isConnected
      });
      
      // Make sure WebSocket service is injected
      if (isConnected) {
        console.log('🔌 [DEBUG] Injecting WebSocket service into proximity video call manager');
        // The hook should handle this, but let's make sure
      }
      
      proximityVideoCall.initialize(currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldEnableVideoCalls, currentUser?.id, currentUser?.username, proximityVideoCall.isInitialized, proximityVideoCall.initialize, isConnected]);

  // Calculate nearby users for proximity video calls
  const calculateNearbyUsers = useCallback((currentPos: { x: number; y: number }, allUsers: User[], currentUserId: string) => {
    if (!currentPos) return [];
    
    const currentGridX = Math.round(currentPos.x / GRID_SIZE);
    const currentGridY = Math.round(currentPos.y / GRID_SIZE);
    
    return allUsers.filter(user => {
      if (user.id === currentUserId) return false;
      
      const userGridX = Math.round(user.x / GRID_SIZE);
      const userGridY = Math.round(user.y / GRID_SIZE);
      
      const distance = Math.abs(currentGridX - userGridX) + Math.abs(currentGridY - userGridY);
      return distance <= PROXIMITY_DISTANCE;
    });
  }, []);

  // Update nearby users when position changes
  useEffect(() => {
    if (currentUser) {
      const nearby = calculateNearbyUsers(currentUser, users, currentUser.id);
      console.log('🎯 [DEBUG] Proximity calculation:', {
        currentUser: { id: currentUser.id, username: currentUser.username, x: currentUser.x, y: currentUser.y },
        allUsers: users.map(u => ({ id: u.id, username: u.username, x: u.x, y: u.y })),
        nearbyUsers: nearby.map(u => ({ id: u.id, username: u.username, x: u.x, y: u.y })),
        proximityDistance: PROXIMITY_DISTANCE,
        gridSize: GRID_SIZE
      });
      
      setNearbyUsers(prev => {
        // Only update if the nearby users actually changed
        if (prev.length !== nearby.length || 
            !prev.every(prevUser => nearby.some(newUser => newUser.id === prevUser.id))) {
          console.log('🔄 [DEBUG] Nearby users changed:', { 
            previous: prev.map(u => u.username), 
            new: nearby.map(u => u.username) 
          });
          return nearby;
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.x, currentUser?.y, currentUser?.id, users, calculateNearbyUsers]);

  // Separate effect for updating proximity video call system
  useEffect(() => {
    if (shouldEnableVideoCalls && nearbyUsers.length >= 0) {
      console.log('🎥 [DEBUG] Updating proximity video call system:', {
        shouldEnableVideoCalls,
        nearbyUsersCount: nearbyUsers.length,
        nearbyUsers: nearbyUsers.map(u => ({ id: u.id, username: u.username, x: u.x, y: u.y })),
        currentUser: currentUser ? { id: currentUser.id, username: currentUser.username, x: currentUser.x, y: currentUser.y } : null,
        isInitialized: proximityVideoCall.isInitialized,
        isCallActive: proximityVideoCall.isCallActive
      });
      proximityVideoCall.handleNearbyUsers(nearbyUsers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyUsers, shouldEnableVideoCalls, proximityVideoCall.handleNearbyUsers, currentUser, proximityVideoCall.isInitialized, proximityVideoCall.isCallActive]);

  // User movement handler
  const handleUserMove = useCallback((x: number, y: number) => {
    if (!currentUser || !space) return;

    // Validate input coordinates
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      console.error('❌ Invalid coordinates received:', { x, y });
      return;
    }

    // Validate movement bounds
    const maxPixelX = space.width - GRID_SIZE;
    const maxPixelY = space.height - GRID_SIZE;
    
    const clampedX = Math.max(GRID_SIZE, Math.min(maxPixelX, x));
    const clampedY = Math.max(GRID_SIZE, Math.min(maxPixelY, y));

    // Send movement to WebSocket service if connected
    if (isConnected) {
      const gridX = Math.round(clampedX / GRID_SIZE);
      const gridY = Math.round(clampedY / GRID_SIZE);
      
      websocketService.send('move', { x: gridX, y: gridY });
      
      // Update proximity video call system
      if (shouldEnableVideoCalls) {
        proximityVideoCall.updatePosition(clampedX, clampedY, 0);
      }
    } else {
      // If not connected, update locally only
      setCurrentUser(prev => prev ? { ...prev, x: clampedX, y: clampedY } : null);
      
      if (shouldEnableVideoCalls) {
        proximityVideoCall.updatePosition(clampedX, clampedY, 0);
      }
    }
  }, [currentUser, space, isConnected, shouldEnableVideoCalls, proximityVideoCall]);

  // Keyboard movement controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!currentUser || !space) return;

      const moveDistance = 20;
      let newX = currentUser.x;
      let newY = currentUser.y;

      if (typeof newX !== 'number' || typeof newY !== 'number') return;

      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          newY = Math.max(GRID_SIZE, currentUser.y - moveDistance);
          event.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          newY = Math.min(space.height - GRID_SIZE, currentUser.y + moveDistance);
          event.preventDefault();
          break;
        case 'ArrowLeft':
        case 'KeyA':
          newX = Math.max(GRID_SIZE, currentUser.x - moveDistance);
          event.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          newX = Math.min(space.width - GRID_SIZE, currentUser.x + moveDistance);
          event.preventDefault();
          break;
        default:
          return;
      }

      if ((newX !== currentUser.x || newY !== currentUser.y) && !isNaN(newX) && !isNaN(newY)) {
        handleUserMove(newX, newY);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentUser, space, handleUserMove]);

  const fetchSpaceData = useCallback(async () => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      // Check space access
      const membershipResponse = await fetch(`http://localhost:8000/api/v1/space/room/join-room/${spaceId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      const membershipData = await membershipResponse.json();
      if (!membershipResponse.ok) {
        setError(membershipData.message || 'Failed to access space');
        return;
      }

      // Fetch space data
      const spaceResponse = await fetch(`http://localhost:8000/api/v1/space/${spaceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!spaceResponse.ok) {
        throw new Error('Failed to fetch space data');
      }

      const spaceData = await spaceResponse.json();
      
      const spaceInfo = {
        id: spaceData.id,
        name: spaceData.name,
        width: spaceData.width,
        height: spaceData.height,
        thumbnail: spaceData.thumbnail,
      };

      setSpace(spaceInfo);
      setElements(spaceData.elements || []);

      // Initialize current user
      const userTokenData = getTokenData();
      if (userTokenData?.user) {
        const centerX = spaceInfo.width / 2;
        const centerY = spaceInfo.height / 2;
        
        setCurrentUser({
          id: userTokenData.user.id,
          username: userTokenData.user.username,
          x: centerX,
          y: centerY,
          isCurrentUser: true
        });
      }

    } catch (err) {
      console.error('Error fetching space data:', err);
      setError('Failed to load space data');
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, router]);

  useEffect(() => {
    if (spaceId) {
      fetchSpaceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]); // fetchSpaceData is intentionally omitted to prevent re-renders  
const handleConnectToWebSocket = async () => {
    if (isConnected) return;
    
    const tokenData = getTokenData();
    if (!tokenData?.token || !spaceId) {
      setError('Missing authentication or space ID');
      return;
    }

    try {
      setConnectionStatus('Connecting...');
      
      await websocketService.joinSpace(spaceId, tokenData.token);
      
      setConnectionStatus('Connected');
      setIsConnected(true);
      
      setupWebSocketEventListeners();
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setError('Failed to connect to live session');
      setConnectionStatus('Error');
    }
  };

  const setupWebSocketEventListeners = () => {
    websocketService.on('space-joined', (payload: { spawn?: { x?: number; y?: number }; users?: Array<{ userId: string; username?: string; x: number; y: number }> }) => {
      const spawnGridX = payload.spawn?.x || 1;
      const spawnGridY = payload.spawn?.y || 1;
      const pixelX = spawnGridX * GRID_SIZE;
      const pixelY = spawnGridY * GRID_SIZE;
      
      if (currentUser) {
        setCurrentUser(prev => prev ? { ...prev, x: pixelX, y: pixelY } : null);
      }
      
      const otherUsers = (payload.users || []).map((user: { userId: string; username?: string; x: number; y: number }) => ({
        id: user.userId,
        username: user.username || `User_${user.userId?.slice(0, 8) || 'Unknown'}`,
        x: user.x * GRID_SIZE,
        y: user.y * GRID_SIZE
      }));
      setUsers(otherUsers);
      setConnectionStatus('In Space');
    });

    websocketService.on('user-joined-space', (payload: { userId: string; username?: string; x?: number; y?: number }) => {
      const newUser = {
        id: payload.userId,
        username: payload.username || `User_${payload.userId?.slice(0, 8) || 'Unknown'}`,
        x: (payload.x || 1) * GRID_SIZE,
        y: (payload.y || 1) * GRID_SIZE
      };
      setUsers(prev => [...prev, newUser]);
    });

    websocketService.on('user-moved', (payload: { userId: string; x: number; y: number }) => {
      const movedPixelX = payload.x * GRID_SIZE;
      const movedPixelY = payload.y * GRID_SIZE;
      
      if (currentUser && payload.userId === currentUser.id) {
        setCurrentUser(prev => {
          if (!prev || (prev.x === movedPixelX && prev.y === movedPixelY)) {
            return prev; // No change needed
          }
          return { ...prev, x: movedPixelX, y: movedPixelY };
        });
      }
      
      setUsers(prev => prev.map(user => {
        if (user.id === payload.userId) {
          if (user.x === movedPixelX && user.y === movedPixelY) {
            return user; // No change needed
          }
          return { ...user, x: movedPixelX, y: movedPixelY };
        }
        return user;
      }));
    });

    websocketService.on('user-left', (payload: { userId: string }) => {
      setUsers(prev => prev.filter(user => user.id !== payload.userId));
    });

    websocketService.on('move-rejected', (payload: { userId: string; x: number; y: number }) => {
      if (currentUser && payload.userId === currentUser.id) {
        setCurrentUser(prev => prev ? {
          ...prev,
          x: payload.x * GRID_SIZE,
          y: payload.y * GRID_SIZE
        } : null);
      }
    });

    websocketService.on('error', (payload: { message?: string }) => {
      setError(payload.message || 'WebSocket error occurred');
    });

    // Chat event listeners
    websocketService.on('chat-message-received', (payload: { 
      messageId: string; 
      chatroomId: string; 
      userId: string; 
      username: string; 
      content: string; 
      timestamp: string;
      type?: string;
      createdAt?: string;
    }) => {
      const chatroomId = payload.chatroomId;
      const newMessage: ChatMessage = {
        id: payload.messageId,
        content: payload.content,
        userId: payload.userId,
        user: { 
          id: payload.userId, 
          username: payload.username 
        },
        chatroomId: chatroomId,
        type: (payload.type as 'text' | 'image' | 'file') || 'text',
        createdAt: payload.createdAt || payload.timestamp
      };
      
      setChatMessages(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(chatroomId) || [];
        newMap.set(chatroomId, [...existing, newMessage]);
        return newMap;
      });
    });

    websocketService.on('chat-joined', (payload: { chatroomId: string }) => {
      console.log('✅ Chat joined:', payload);
    });

    websocketService.on('chat-error', (payload: { message?: string }) => {
      console.error('❌ Chat error:', payload);
      setChatError(payload.message || 'Chat error occurred');
    });
  };

  // Chat functions
  const loadChatrooms = useCallback(async () => {
    if (!spaceId || !isConnected) return;
    
    setIsLoadingChatrooms(true);
    setChatError('');
    
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        setChatError('Authentication required');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/v1/chatroom/space/${spaceId}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`
        }
      });
      
      const data = await response.json();
      
      if (data.status === 200) {
        setChatrooms(data.data || []);
      } else {
        setChatError(data.message || 'Failed to load chatrooms');
      }
    } catch (error) {
      console.error('❌ Failed to load chatrooms:', error);
      setChatError('Failed to load chatrooms');
    } finally {
      setIsLoadingChatrooms(false);
    }
  }, [spaceId, isConnected]);

  const createChatroom = useCallback(async () => {
    if (!spaceId || !newChatroomName.trim() || !newChatroomPassword.trim()) return;
    
    setIsCreatingChatroom(true);
    setChatError('');
    
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        setChatError('Authentication required');
        return;
      }

      const response = await fetch('http://localhost:8000/api/v1/chatroom/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newChatroomName,
          description: newChatroomDescription,
          passcode: newChatroomPassword,
          roomid: spaceId
        })
      });
      
      const data = await response.json();
      
      if (data.status === 201) {
        // Reset form
        setNewChatroomName('');
        setNewChatroomDescription('');
        setNewChatroomPassword('');
        setShowCreateChatroom(false);
        
        // Reload chatrooms
        await loadChatrooms();
      } else {
        setChatError(data.message || 'Failed to create chatroom');
      }
    } catch (error) {
      console.error('❌ Failed to create chatroom:', error);
      setChatError('Failed to create chatroom');
    } finally {
      setIsCreatingChatroom(false);
    }
  }, [spaceId, newChatroomName, newChatroomDescription, newChatroomPassword, loadChatrooms]);

  const loadMessageHistory = useCallback(async (chatroomId: string) => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) return;

      const response = await fetch(`http://localhost:8000/api/v1/chatroom/${chatroomId}/messages`, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`
        }
      });
      const data = await response.json();
      if (data.status === 200) {
        const messages = data.data.map((msg: {
          id: string;
          content: string;
          userId: string;
          user: { id: string; username: string };
          type?: string;
          createdAt: string;
        }) => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          user: msg.user,
          chatroomId: chatroomId,
          type: msg.type || 'text',
          createdAt: msg.createdAt
        }));
        setChatMessages(prev => {
          const newMap = new Map(prev);
          newMap.set(chatroomId, messages);
          return newMap;
        });
      }
    } catch (error) {
      console.error('❌ Failed to load message history:', error);
    }
  }, []);

  const joinChatroom = useCallback(async (chatroomId: string, passcode: string) => {
    setChatError('');
    
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        setChatError('Authentication required');
        return false;
      }

      const response = await fetch(`http://localhost:8000/api/v1/chatroom/join/${chatroomId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ passcode })
      });
      
      const data = await response.json();
      
      if (response.status === 409) {
        // Already joined
        if (isConnected) {
          websocketService.send('chat-join', { chatroomId });
        }
        await loadMessageHistory(chatroomId);
        setActiveChatroom(chatroomId);
        return true;
      } else if (data.status === 200) {
        // Successfully joined
        if (isConnected) {
          websocketService.send('chat-join', { chatroomId });
        }
        await loadMessageHistory(chatroomId);
        setActiveChatroom(chatroomId);
        return true;
      } else {
        setChatError(data.message || 'Failed to join chatroom');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to join chatroom:', error);
      setChatError('Failed to join chatroom');
      return false;
    }
  }, [isConnected, loadMessageHistory]);

  const sendChatMessage = useCallback(() => {
    if (!activeChatroom || !chatInput.trim() || !isConnected) return;
    
    websocketService.send('chat-message', {
      chatroomId: activeChatroom,
      content: chatInput.trim(),
      type: 'text'
    });
    
    setChatInput('');
  }, [activeChatroom, chatInput, isConnected]);

  // Load chatrooms when connected
  useEffect(() => {
    if (isConnected && spaceId) {
      loadChatrooms();
    }
  }, [isConnected, spaceId, loadChatrooms]); 
 if (isLoading) {
    return <LoadingScreen message="Loading Space" />;
  }

  if (error) {
    return (
      <ProtectedRoute requiredRole="User">
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
            <p className="text-white mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="User">
      <div className="h-screen bg-gray-900 flex overflow-hidden">
        {/* Active Users Sidebar */}
        {showActiveUsers && (
          <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">Active Users</h2>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-400">{users.length + (currentUser ? 1 : 0)}</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-1">{space?.name}</p>
            </div>

            {/* Connection Status */}
            {!isConnected && (
              <div className="p-4 bg-yellow-900 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-200 text-sm font-medium">Not Connected</p>
                    <p className="text-yellow-300 text-xs">Join live session to see other users</p>
                  </div>
                  <button
                    onClick={handleConnectToWebSocket}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Connect
                  </button>
                </div>
              </div>
            )}

            {/* Users List */}
            <div className="flex-1 overflow-y-auto">
              {/* Current User */}
              {currentUser && (
                <div className="p-3 border-b border-gray-700 bg-blue-900/20">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {currentUser.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{currentUser.username}</p>
                      <p className="text-blue-400 text-xs">You • Position ({Math.round(currentUser.x/GRID_SIZE)}, {Math.round(currentUser.y/GRID_SIZE)})</p>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              )}

              {/* Other Users */}
              {users.map((user) => {
                const isNearby = nearbyUsers.some(nu => nu.id === user.id);
                return (
                  <div key={user.id} className={`p-3 border-b border-gray-700 ${isNearby ? 'bg-green-900/20' : ''}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isNearby ? 'bg-green-600' : 'bg-gray-600'
                      }`}>
                        <span className="text-white font-semibold text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{user.username}</p>
                        <div className="flex items-center space-x-2">
                          <p className="text-gray-400 text-xs">Position ({Math.round(user.x/GRID_SIZE)}, {Math.round(user.y/GRID_SIZE)})</p>
                          {isNearby && (
                            <span className="text-green-400 text-xs bg-green-900/50 px-2 py-0.5 rounded">
                              📹 Nearby
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    </div>
                  </div>
                );
              })}

              {/* Empty State */}
              {users.length === 0 && isConnected && (
                <div className="p-8 text-center">
                  <div className="text-gray-500 text-4xl mb-4">👥</div>
                  <p className="text-gray-400">No other users in this space</p>
                  <p className="text-gray-500 text-sm mt-2">Invite friends to join!</p>
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Status: {connectionStatus}</span>
                <button
                  onClick={() => setShowActiveUsers(false)}
                  className="text-gray-400 hover:text-white"
                  title="Hide sidebar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Space Area */}
        <div className="flex-1 relative">
          {/* Space Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gray-800/90 backdrop-blur-sm border-b border-gray-700">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                {!showActiveUsers && (
                  <button
                    onClick={() => setShowActiveUsers(true)}
                    className="text-gray-400 hover:text-white"
                    title="Show active users"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                <div>
                  <h1 className="text-white font-bold text-xl">{space?.name}</h1>
                  <p className="text-gray-400 text-sm">
                    {space?.width} × {space?.height} • {users.length + (currentUser ? 1 : 0)} users online
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Proximity Indicator */}
                {nearbyUsers.length > 0 && (
                  <div className="bg-green-600/20 border border-green-600/50 rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-sm font-medium">
                        {nearbyUsers.length} nearby user{nearbyUsers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Chat Toggle Button */}
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showChat
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50'
                      : 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                  }`}
                  title="Toggle Chat"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Chat</span>
                    {chatrooms.length > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                        {chatrooms.length}
                      </span>
                    )}
                  </div>
                </button>

                {/* Connection Status */}
                <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  isConnected 
                    ? 'bg-green-600/20 text-green-400 border border-green-600/50' 
                    : 'bg-red-600/20 text-red-400 border border-red-600/50'
                }`}>
                  {connectionStatus}
                </div>

                {/* Exit Button */}
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Exit Space
                </button>
              </div>
            </div>
          </div>

          {/* Space Canvas */}
          <div className="absolute inset-0 pt-20">
            <SpaceCanvas
              space={space}
              elements={elements}
              users={users}
              currentUser={currentUser}
              nearbyUsers={nearbyUsers}
              onUserMove={handleUserMove}
            />
          </div>

          {/* Movement Instructions */}
          <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 text-white">
              <h3 className="font-semibold mb-2">Movement Controls</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>↑ W - Move Up</div>
                <div>↓ S - Move Down</div>
                <div>← A - Move Left</div>
                <div>→ D - Move Right</div>
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Get within 2 tiles of other users for video calls
              </p>
            </div>
          </div>
        </div>
        
        {/* Proximity Video Call UI - Small window on the right */}
        {shouldEnableVideoCalls && proximityVideoCall.isCallActive && (
          <div className="fixed top-24 right-4 z-50">
            <ProximityVideoCallUI
              userId={currentUser.id}
              username={currentUser.username}
              className="w-80 max-h-96"
            />
          </div>
        )}
        
        {/* Debug info for video call */}
        <div className="fixed top-4 left-4 z-50 bg-black/80 text-white p-2 rounded text-xs">
          <div>Video Calls Debug:</div>
          <div>shouldEnable: {shouldEnableVideoCalls ? 'true' : 'false'}</div>
          <div>isCallActive: {proximityVideoCall.isCallActive ? 'true' : 'false'}</div>
          <div>isInitialized: {proximityVideoCall.isInitialized ? 'true' : 'false'}</div>
          <div>nearbyUsers: {nearbyUsers.length}</div>
          <div>currentUser: {currentUser?.username || 'none'}</div>
          <div>currentPos: {currentUser ? `(${Math.round(currentUser.x/GRID_SIZE)}, ${Math.round(currentUser.y/GRID_SIZE)})` : 'none'}</div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="fixed bottom-4 right-4 z-40 w-96 h-96 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Space Chat</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCreateChatroom(true)}
                  className="text-gray-400 hover:text-white p-1 rounded"
                  title="Create Chatroom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowJoinChatroom(true)}
                  className="text-gray-400 hover:text-white p-1 rounded"
                  title="Join Chatroom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-white p-1 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 flex flex-col min-h-0">
              {!activeChatroom ? (
                /* Chatroom List */
                <div className="flex-1 overflow-y-auto p-4">
                  {isLoadingChatrooms ? (
                    <div className="text-center text-gray-400 py-8">Loading chatrooms...</div>
                  ) : chatrooms.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-4xl mb-4">💬</div>
                      <p>No chatrooms available</p>
                      <p className="text-sm mt-2">Create one to start chatting!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chatrooms.map((chatroom) => (
                        <div
                          key={chatroom.id}
                          className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 cursor-pointer transition-colors"
                          onClick={() => {
                            const password = prompt(`Enter password for "${chatroom.name}":`);
                            if (password) {
                              joinChatroom(chatroom.id, password);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="text-white font-medium">{chatroom.name}</h4>
                              {chatroom.description && (
                                <p className="text-gray-400 text-sm mt-1">{chatroom.description}</p>
                              )}
                              <div className="flex items-center space-x-2 mt-2">
                                <span className="text-xs text-gray-500">by {chatroom.creator.username}</span>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs text-gray-500">{chatroom._count.members} members</span>
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Active Chat */
                <>
                  {/* Chat Header */}
                  <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setActiveChatroom(null)}
                        className="text-gray-400 hover:text-white p-1 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div>
                        <h4 className="text-white font-medium">
                          {chatrooms.find(c => c.id === activeChatroom)?.name || 'Chat'}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {(chatMessages.get(activeChatroom) || []).map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.userId === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg ${
                            message.userId === currentUser?.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-white'
                          }`}
                        >
                          {message.userId !== currentUser?.id && (
                            <div className="text-xs text-gray-300 mb-1">{message.user.username}</div>
                          )}
                          <div className="text-sm">{message.content}</div>
                          <div className="text-xs text-gray-300 mt-1">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input */}
                  <div className="p-3 border-t border-gray-700">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Error Message */}
            {chatError && (
              <div className="p-3 bg-red-900/50 border-t border-red-700">
                <div className="text-red-300 text-sm">{chatError}</div>
              </div>
            )}
          </div>
        )}    
    {/* Create Chatroom Modal */}
        {showCreateChatroom && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
              <h3 className="text-white font-semibold text-lg mb-4">Create Chatroom</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Name *</label>
                  <input
                    type="text"
                    value={newChatroomName}
                    onChange={(e) => setNewChatroomName(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter chatroom name"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Description</label>
                  <textarea
                    value={newChatroomDescription}
                    onChange={(e) => setNewChatroomDescription(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                    placeholder="Enter description (optional)"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Password *</label>
                  <input
                    type="password"
                    value={newChatroomPassword}
                    onChange={(e) => setNewChatroomPassword(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateChatroom(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createChatroom}
                  disabled={!newChatroomName.trim() || !newChatroomPassword.trim() || isCreatingChatroom}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                >
                  {isCreatingChatroom ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Join Chatroom Modal */}
        {showJoinChatroom && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
              <h3 className="text-white font-semibold text-lg mb-4">Join Chatroom</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Chatroom ID</label>
                  <input
                    type="text"
                    value={joinChatroomId}
                    onChange={(e) => setJoinChatroomId(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter chatroom ID"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Password</label>
                  <input
                    type="password"
                    value={joinChatroomPassword}
                    onChange={(e) => setJoinChatroomPassword(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowJoinChatroom(false);
                    setJoinChatroomId('');
                    setJoinChatroomPassword('');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (joinChatroomId.trim() && joinChatroomPassword.trim()) {
                      joinChatroom(joinChatroomId, joinChatroomPassword).then((success) => {
                        if (success) {
                          setShowJoinChatroom(false);
                          setJoinChatroomId('');
                          setJoinChatroomPassword('');
                        }
                      });
                    }
                  }}
                  disabled={!joinChatroomId.trim() || !joinChatroomPassword.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// Space Canvas Component
interface SpaceCanvasProps {
  space: Space | null;
  elements: SpaceElement[];
  users: User[];
  currentUser: User | null;
  nearbyUsers: User[];
  onUserMove: (x: number, y: number) => void;
}

const SpaceCanvas: React.FC<SpaceCanvasProps> = ({
  space,
  elements,
  users,
  currentUser,
  nearbyUsers,
  onUserMove
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0.8);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const GRID_SIZE = 20;

  // Draw the space
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !space) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 80; // Account for header

    // Clear canvas
    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Apply transformations
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw grid
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 1 / scale;
    
    for (let x = 0; x <= space.width; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, space.height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= space.height; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(space.width, y);
      ctx.stroke();
    }

    // Draw space boundary
    ctx.strokeStyle = '#6b7280'; // gray-500
    ctx.lineWidth = 2 / scale;
    ctx.strokeRect(0, 0, space.width, space.height);

    // Draw elements
    elements.forEach(element => {
      ctx.fillStyle = '#4b5563'; // gray-600
      ctx.fillRect(
        element.x,
        element.y,
        element.element.width,
        element.element.height
      );
      
      if (element.element.imageUrl) {
        // TODO: Load and draw images
      }
    });

    // Draw users
    users.forEach(user => {
      const isNearby = nearbyUsers.some(nu => nu.id === user.id);
      
      // Draw proximity circle for nearby users
      if (isNearby) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'; // green-500 with opacity
        ctx.strokeStyle = '#22c55e'; // green-500
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        ctx.arc(user.x + 10, user.y + 10, GRID_SIZE * 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      
      // Draw user avatar
      ctx.fillStyle = isNearby ? '#22c55e' : '#6b7280'; // green-500 or gray-500
      ctx.beginPath();
      ctx.arc(user.x + 10, user.y + 10, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw username
      ctx.fillStyle = '#ffffff';
      ctx.font = `${12 / scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(user.username, user.x + 10, user.y - 5);
    });

    // Draw current user
    if (currentUser) {
      // Draw proximity range
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; // blue-500 with opacity
      ctx.strokeStyle = '#3b82f6'; // blue-500
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(currentUser.x + 10, currentUser.y + 10, GRID_SIZE * 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Draw current user avatar
      ctx.fillStyle = '#3b82f6'; // blue-500
      ctx.beginPath();
      ctx.arc(currentUser.x + 10, currentUser.y + 10, 10, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw username
      ctx.fillStyle = '#ffffff';
      ctx.font = `${14 / scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`${currentUser.username} (You)`, currentUser.x + 10, currentUser.y - 8);
    }

    // Restore context
    ctx.restore();
  }, [space, elements, users, currentUser, nearbyUsers, scale, offset]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!currentUser || !space || isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    // Snap to grid
    const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;

    // Validate bounds
    if (gridX >= 0 && gridX < space.width && gridY >= 0 && gridY < space.height) {
      onUserMove(gridX, gridY);
    }
  };

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
      />
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-2 space-y-2">
        <button
          onClick={() => setScale(prev => Math.min(3, prev * 1.2))}
          className="block w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
        >
          +
        </button>
        <button
          onClick={() => setScale(prev => Math.max(0.1, prev / 1.2))}
          className="block w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
        >
          -
        </button>
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="block w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
        >
          1:1
        </button>
      </div>
    </div>
  );
};