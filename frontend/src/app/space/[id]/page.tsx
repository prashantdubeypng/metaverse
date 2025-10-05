"use client";
import { ENV, ENDPOINTS } from '@/CONFIG/env.config';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import OfficeSpaceViewer from '@/components/OfficeSpaceViewer';
import LoadingScreen from '@/components/LoadingScreen';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getTokenData, clearTokenData } from '@/utils/auth';
// Video call imports
import { useVideoCall } from '@/hooks/useVideoCall';
import { useProximityVideoCall } from '@/hooks/useProximityVideoCall';
import VideoCallInterface from '@/components/VideoCallInterface';
import IncomingCallModal from '@/components/IncomingCallModal';
import NearbyUsersPanel from '@/components/NearbyUsersPanel';
import ProximityManager from '@/components/ProximityManager';
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
  hasPassword: boolean;
  memberCount?: number;
}

interface BackendChatroomResponse {
  id: string;
  name: string;
  description?: string | null;
  spaceId: string;
  creatorId: string;
  createdAt: string;
  passcode?: string | null;
  creator?: {
    id: string;
    username: string;
  };
  _count?: {
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
  timestamp?: Date;
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
  const [showGrid] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Not Connected');

  // Comprehensive Chat System State
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([]);
  const [activeChatrooms, setActiveChatrooms] = useState<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [selectedChatroom, setSelectedChatroom] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [showCreateChatroomModal, setShowCreateChatroomModal] = useState(false);
  const [showJoinChatroomModal, setShowJoinChatroomModal] = useState(false);
  const [pendingChatroomId, setPendingChatroomId] = useState<string | null>(null);
  const [chatroomPassword, setChatroomPassword] = useState('');
  const [isLoadingChatrooms, setIsLoadingChatrooms] = useState(false);
  const [chatError, setChatError] = useState<string>('');
  
  // Create chatroom form state
  const [newChatroomName, setNewChatroomName] = useState('');
  const [newChatroomDescription, setNewChatroomDescription] = useState('');
  const [newChatroomPassword, setNewChatroomPassword] = useState('');
  const [isCreatingChatroom, setIsCreatingChatroom] = useState(false);

  // Grid system constants
  const GRID_SIZE = 20; // Each grid cell is 20x20 pixels

  // Video call integration - only initialize when user data is available
  const shouldEnableVideoCalls = currentUser && currentUser.id && currentUser.username;
  
  const videoCallData = useVideoCall({
    currentUser: shouldEnableVideoCalls ? {
      id: currentUser.id,
      username: currentUser.username,
      x: currentUser.x,
      y: currentUser.y,
      isCurrentUser: true
    } : { id: '', username: '', x: 0, y: 0 },
  webSocketUrl: ENV.WS_URL
  });

  // Proximity video call integration
  const proximityVideoCall = useProximityVideoCall();

  // Initialize proximity video call system
  useEffect(() => {
    if (shouldEnableVideoCalls && currentUser?.id) {
      proximityVideoCall.initialize(currentUser.id);
    }
  }, [shouldEnableVideoCalls, currentUser?.id, proximityVideoCall]);

  // Extract video call data
  const {
    callState,
    nearbyUsers,
    incomingCall,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall
  } = shouldEnableVideoCalls ? videoCallData : {
    callState: 'idle' as const,
    nearbyUsers: [],
    incomingCall: null,
    localStream: null,
    remoteStream: null,
    initiateCall: async () => {},
    acceptCall: async () => {},
    rejectCall: async () => {},
    endCall: async () => {}
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup handled by websocket service
    };
  }, []);

  // User movement handler
  const handleUserMove = useCallback((x: number, y: number) => {
    console.log('handleUserMove called with:', { x, y, currentUser, space: space ? { width: space.width, height: space.height } : null });
    
    if (!currentUser || !space) {
      console.log('Missing currentUser or space:', { currentUser: !!currentUser, space: !!space });
      return;
    }

    // Validate input coordinates
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      console.error('Invalid coordinates received:', { x, y, typeof_x: typeof x, typeof_y: typeof y });
      return;
    }

    // Validate movement bounds (using pixel coordinates)
    const maxPixelX = space.width - GRID_SIZE; // Leave one grid size padding from edge
    const maxPixelY = space.height - GRID_SIZE;
    
    const clampedX = Math.max(GRID_SIZE, Math.min(maxPixelX, x)); // Start from GRID_SIZE, not 20
    const clampedY = Math.max(GRID_SIZE, Math.min(maxPixelY, y));

    console.log('Clamped coordinates:', { 
      original: { x, y }, 
      clamped: { x: clampedX, y: clampedY }, 
      bounds: { maxX: maxPixelX, maxY: maxPixelY }
    });

    // Send movement to WebSocket service if connected (don't update locally, wait for server confirmation)
    if (isConnected) {
      // Convert pixel coordinates to grid coordinates for backend
      // Use Math.floor instead of Math.round to prevent rounding errors
      // Example: pixel 790 → 39.5 → floor(39.5) = 39 (valid) vs round(39.5) = 40 (rejected)
      const gridX = Math.floor(clampedX / GRID_SIZE);
      const gridY = Math.floor(clampedY / GRID_SIZE);
      
      websocketService.send('move', { 
        x: gridX, 
        y: gridY 
      });
      
      // Update proximity video call system
      if (shouldEnableVideoCalls) {
        proximityVideoCall.updatePosition(clampedX, clampedY, 0);
      }
      
      console.log(`Sent movement request - Pixel: (${clampedX}, ${clampedY}) → Grid: (${gridX}, ${gridY})`);
    } else {
      // If not connected, update locally only
      setCurrentUser(prev => prev ? {
        ...prev,
        x: clampedX,
        y: clampedY
      } : null);
      
      // Update proximity video call system even when offline for local testing
      if (shouldEnableVideoCalls) {
        proximityVideoCall.updatePosition(clampedX, clampedY, 0);
      }
      
      console.log(`Local movement to: ${clampedX}, ${clampedY} (not connected)`);
    }
  }, [currentUser, space, isConnected, shouldEnableVideoCalls, proximityVideoCall]);

  // Keyboard movement controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      console.log('Key pressed:', event.code, event.key);
      
      if (!currentUser || !space) {
        console.log('Cannot move - missing currentUser or space:', { currentUser: !!currentUser, space: !!space });
        return;
      }

      // Debug: Check current user state
      console.log('Keyboard input:', { 
        key: event.code, 
        currentUser: { x: currentUser.x, y: currentUser.y }, 
        space: { width: space.width, height: space.height } 
      });

      const moveDistance = 20; // pixels to move per keypress
      let newX = currentUser.x;
      let newY = currentUser.y;

      // Ensure current position values are numbers
      if (typeof newX !== 'number' || typeof newY !== 'number') {
        console.error('Invalid current position:', { x: newX, y: newY });
        return;
      }

      // Validate space dimensions
      if (!space.width || !space.height || typeof space.width !== 'number' || typeof space.height !== 'number') {
        console.error('Invalid space dimensions:', { width: space.width, height: space.height });
        console.log('Using fallback dimensions: 400x400');
        // Use fallback dimensions if not provided
        const fallbackWidth = 400;
        const fallbackHeight = 400;
        
        switch (event.code) {
          case 'ArrowUp':
            newY = Math.max(GRID_SIZE, currentUser.y - moveDistance);
            console.log('Arrow Up (fallback) - oldY:', currentUser.y, 'newY:', newY);
            event.preventDefault();
            break;
          case 'ArrowDown':
            newY = Math.min(fallbackHeight - GRID_SIZE, currentUser.y + moveDistance);
            console.log('Arrow Down (fallback) - oldY:', currentUser.y, 'newY:', newY);
            event.preventDefault();
            break;
          case 'ArrowLeft':
            newX = Math.max(GRID_SIZE, currentUser.x - moveDistance);
            console.log('Arrow Left (fallback) - oldX:', currentUser.x, 'newX:', newX);
            event.preventDefault();
            break;
          case 'ArrowRight':
            newX = Math.min(fallbackWidth - GRID_SIZE, currentUser.x + moveDistance);
            console.log('Arrow Right (fallback) - oldX:', currentUser.x, 'newX:', newX);
            event.preventDefault();
            break;
          default:
            return; // Don't handle other keys
        }
      } else {
        switch (event.code) {
          case 'ArrowUp':
            newY = Math.max(GRID_SIZE, currentUser.y - moveDistance);
            console.log('Arrow Up - oldY:', currentUser.y, 'newY:', newY);
            event.preventDefault();
            break;
          case 'ArrowDown':
            newY = Math.min(space.height - GRID_SIZE, currentUser.y + moveDistance);
            console.log('Arrow Down - oldY:', currentUser.y, 'newY:', newY, 'maxY:', space.height - GRID_SIZE);
            event.preventDefault();
            break;
          case 'ArrowLeft':
            newX = Math.max(GRID_SIZE, currentUser.x - moveDistance);
            console.log('Arrow Left - oldX:', currentUser.x, 'newX:', newX);
            event.preventDefault();
            break;
          case 'ArrowRight':
            newX = Math.min(space.width - GRID_SIZE, currentUser.x + moveDistance);
            console.log('Arrow Right - oldX:', currentUser.x, 'newX:', newX, 'maxX:', space.width - GRID_SIZE);
            event.preventDefault();
            break;
          default:
            return; // Don't handle other keys
        }
      }

      // Only move if position actually changed and values are valid
      if ((newX !== currentUser.x || newY !== currentUser.y) && !isNaN(newX) && !isNaN(newY)) {
        console.log('Moving from:', { x: currentUser.x, y: currentUser.y }, 'to:', { x: newX, y: newY });
        handleUserMove(newX, newY);
      } else {
        console.log('Invalid movement or no change:', { newX, newY, currentX: currentUser.x, currentY: currentUser.y });
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyPress);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentUser, space, handleUserMove]);

  const fetchSpaceData = useCallback(async () => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      // First, check if user has access to this space
      const membershipUrl = `${ENDPOINTS.space.base}/room/join-room/${spaceId}`;
      console.log('🔍 [DEBUG] Fetching membership URL:', membershipUrl);
      console.log('🔍 [DEBUG] ENDPOINTS.space.base:', ENDPOINTS.space.base);
      console.log('🔍 [DEBUG] ENV.API_URL:', ENV.API_URL);
      
  const membershipResponse = await fetch(membershipUrl, {
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

      // Then fetch space data and elements
  const spaceResponse = await fetch(`${ENDPOINTS.space.base}/${spaceId}`, {
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
      console.log('Raw space data from backend:', spaceData);
      
      // Extract space info and elements from the response
      const spaceInfo = {
        id: spaceData.id,
        name: spaceData.name,
        width: 1900,
        height: 900,
        thumbnail: spaceData.thumbnail,
      };

      console.log('Processed space info:', spaceInfo);
      setSpace(spaceInfo);
      setElements(spaceData.elements || []);

      // Initialize current user at center of space (will be updated by WebSocket spawn)
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

      // Users will be populated via WebSocket when connected

    } catch (err) {
      console.error('Error fetching space data:', err);
      setError('Failed to load space data');
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, router]);

  // Load space data when component mounts
  useEffect(() => {
    if (spaceId) {
      fetchSpaceData();
    }
  }, [spaceId, fetchSpaceData]);

  // ========================================
  // COMPREHENSIVE CHAT SYSTEM IMPLEMENTATION
  // ========================================

  // Load available chatrooms for current space
  const loadChatrooms = useCallback(async () => {
    if (!spaceId) return;
    
    setIsLoadingChatrooms(true);
    setChatError('');
    
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        setChatError('Authentication required');
        return;
      }

  const response = await fetch(`${ENDPOINTS.chatroom.base}/space/${spaceId}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`
        }
      });
      
      const data = await response.json();
      
      if (data.status === 200) {
        console.log('Raw backend chatroom data:', data.data);
        
        // Map backend response (Prisma shape) to frontend interface
        const mappedChatrooms = (data.data || []).map((room: BackendChatroomResponse) => {
          console.log('Mapping individual room:', room);
          return {
            id: room.id,
            name: room.name,
            description: room.description ?? undefined,
            spaceId: room.spaceId,
            creatorId: room.creatorId,
            createdAt: room.createdAt,
            hasPassword: !!room.passcode,
            memberCount: room._count?.members ?? 0
          } as Chatroom;
        });
        
        console.log('Mapped chatrooms:', mappedChatrooms);
        setChatrooms(mappedChatrooms);
        console.log('Loaded chatrooms:', mappedChatrooms);
      } else {
        setChatError(data.message || 'Failed to load chatrooms');
      }
    } catch (error) {
      console.error('Failed to load chatrooms:', error);
      setChatError('Failed to load chatrooms');
    } finally {
      setIsLoadingChatrooms(false);
    }
  }, [spaceId]);

  // Create new chatroom
  const createChatroom = useCallback(async (name: string, description: string, passcode: string) => {
    if (!spaceId) return null;
    
    setIsCreatingChatroom(true);
    setChatError('');
    
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        setChatError('Authentication required');
        return null;
      }

  const response = await fetch(`${ENDPOINTS.chatroom.base}/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          description: description,
          passcode: passcode,
          roomid: spaceId
        })
      });
      
      const data = await response.json();
      
      if (data.message === 'success') {
        console.log('Chatroom created:', data.data);
        await loadChatrooms(); // Refresh list
        return data.data;
      } else {
        setChatError(data.message || 'Failed to create chatroom');
        return null;
      }
    } catch (error) {
      console.error('Failed to create chatroom:', error);
      setChatError('Failed to create chatroom');
      return null;
    } finally {
      setIsCreatingChatroom(false);
    }
  }, [spaceId, loadChatrooms]);

  // Load message history (moved above joinChatroom so it can be safely referenced)
  const loadMessageHistory = useCallback(async (chatroomId: string) => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) return;

  const response = await fetch(`${ENDPOINTS.chatroom.base}/${chatroomId}/messages`, {
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
          createdAt: msg.createdAt,
          timestamp: new Date(msg.createdAt)
        }));
        setChatMessages(prev => {
          const newMap = new Map(prev);
          newMap.set(chatroomId, messages);
          return newMap;
        });
        console.log('Loaded message history for chatroom:', chatroomId, messages);
      }
    } catch (error) {
      console.error('Failed to load message history:', error);
    }
  }, []);

  // Join chatroom with passcode
  const joinChatroom = useCallback(async (chatroomId: string, passcode: string) => {
    setChatError('');
    
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        setChatError('Authentication required');
        return false;
      }

      // Join via HTTP API
  const response = await fetch(`${ENDPOINTS.chatroom.base}/join/${chatroomId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ passcode })
      });
      
      const data = await response.json();
      
      // Handle different response statuses
      if (response.status === 409) {
        // User already joined this chatroom
        console.log('Already joined chatroom:', chatroomId);
        
        // Still proceed with local state updates and WebSocket join
        if (isConnected) {
          websocketService.send('chat-join', { chatroomId });
        }
        
        // Load message history
        await loadMessageHistory(chatroomId);
        
        // Add to active chatrooms
        setActiveChatrooms(prev => new Set([...prev, chatroomId]));
        setSelectedChatroom(chatroomId);
        setShowChatWindow(true);
        
        console.log('Rejoined chatroom:', chatroomId);
        return true;
      } else if (data.status === 200 || data.message === 'sucess') {
        // Successfully joined for the first time
        if (isConnected) {
          websocketService.send('chat-join', { chatroomId });
        }
        
        // Load message history
        await loadMessageHistory(chatroomId);
        
        // Add to active chatrooms
        setActiveChatrooms(prev => new Set([...prev, chatroomId]));
        setSelectedChatroom(chatroomId);
        setShowChatWindow(true);
        
        console.log('Joined chatroom:', chatroomId);
        return true;
      } else {
        setChatError(data.message || 'Failed to join chatroom');
        return false;
      }
    } catch (error) {
      console.error('Failed to join chatroom:', error);
      setChatError('Failed to join chatroom');
      return false;
    }
  }, [isConnected, loadMessageHistory]);

  // (duplicate loadMessageHistory removed)

  // Send chat message
  const sendChatMessage = useCallback((chatroomId: string, content: string, type: 'text' | 'image' | 'file' = 'text') => {
    if (!activeChatrooms.has(chatroomId)) {
      console.error('Not in chatroom:', chatroomId);
      setChatError('Not connected to this chatroom');
      return;
    }
    
    if (!isConnected) {
      console.error('WebSocket not connected');
      setChatError('Connection lost');
      return;
    }
    
    websocketService.send('chat-message', {
      chatroomId,
      content,
      type
    });
    
    console.log('Sent chat message:', { chatroomId, content, type });
  }, [activeChatrooms, isConnected]);

  // Leave chatroom (currently unused but available for future functionality)
  const _leaveChatroom = useCallback((chatroomId: string) => {
    if (isConnected) {
      websocketService.send('chat-leave', { chatroomId });
    }
    
    setActiveChatrooms(prev => {
      const newSet = new Set(prev);
      newSet.delete(chatroomId);
      return newSet;
    });
    
    setChatMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(chatroomId);
      return newMap;
    });
    
    if (selectedChatroom === chatroomId) {
      setSelectedChatroom(null);
    }
    
    console.log('Left chatroom:', chatroomId);
  }, [isConnected, selectedChatroom]);

  // Load chatrooms when space is loaded
  useEffect(() => {
    if (space && isConnected) {
      loadChatrooms();
    }
  }, [space, isConnected, loadChatrooms]);

  const handleConnectToWebSocket = async () => {
    if (isConnected) {
      console.log('Already connected to WebSocket');
      return;
    }
    
    const tokenData = getTokenData();
    if (!tokenData?.token || !spaceId) {
      setError('Missing authentication or space ID');
      return;
    }

    try {
      setConnectionStatus('Connecting...');
      
      // Use unified websocket service properly
      await websocketService.joinSpace(spaceId, tokenData.token);
      
      console.log('WebSocket connected & joined space');
      setConnectionStatus('Connected');
      setIsConnected(true);
      
      // Set up event listeners via the service (not direct socket manipulation)
      setupWebSocketEventListeners();
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setError('Failed to connect to live session');
      setConnectionStatus('Error');
    }
  };

  // Separate function to set up all WebSocket event listeners
  const setupWebSocketEventListeners = () => {
    // Space events
    websocketService.on('space-joined', (payload: { spawn?: { x?: number; y?: number }; users?: Array<{ userId: string; username?: string; x: number; y: number }> }) => {
      console.log('Successfully joined space at:', payload.spawn);
      
      // Update current user position to spawn point
      const spawnGridX = payload.spawn?.x || 1;
      const spawnGridY = payload.spawn?.y || 1;
      const pixelX = spawnGridX * GRID_SIZE;
      const pixelY = spawnGridY * GRID_SIZE;
      
      if (currentUser) {
        setCurrentUser(prev => prev ? {
          ...prev,
          x: pixelX,
          y: pixelY
        } : null);
        console.log('Current user position updated - Grid:', { x: spawnGridX, y: spawnGridY }, 'Pixel:', { x: pixelX, y: pixelY });
      }
      
      // Set other users in the space
      console.log('[DEBUG] Received users from space-joined:', payload.users);
      const otherUsers = (payload.users || []).map((user: { userId: string; username?: string; x: number; y: number }) => ({
        id: user.userId,
        username: user.username || `User_${user.userId?.slice(0, 8) || 'Unknown'}`,
        x: user.x * GRID_SIZE,
        y: user.y * GRID_SIZE
      }));
      console.log('[DEBUG] Processed other users:', otherUsers);
      setUsers(otherUsers);
      setConnectionStatus('In Space');
    });

    websocketService.on('user-joined-space', (payload: { userId: string; username?: string; spawn?: { x?: number; y?: number }; x?: number; y?: number }) => {
      console.log('New user joined:', payload);
      // Extract coordinates from either spawn object or direct properties for backward compatibility
      const gridX = payload.spawn?.x ?? payload.x ?? 1;
      const gridY = payload.spawn?.y ?? payload.y ?? 1;
      const newUser = {
        id: payload.userId,
        username: payload.username || `User_${payload.userId?.slice(0, 8) || 'Unknown'}`,
        x: gridX * GRID_SIZE,
        y: gridY * GRID_SIZE
      };
      console.log(`[NEW USER] Added user ${newUser.username} at grid (${gridX}, ${gridY}) → pixel (${newUser.x}, ${newUser.y})`);
      setUsers(prev => [...prev, newUser]);
    });

    websocketService.on('user-moved', (payload: { userId: string; x: number; y: number }) => {
      console.log('User moved:', payload);
      const movedPixelX = payload.x * GRID_SIZE;
      const movedPixelY = payload.y * GRID_SIZE;
      
      console.log(`[USER-MOVED] Converting Grid: (${payload.x}, ${payload.y}) → Pixel: (${movedPixelX}, ${movedPixelY})`);
      
      if (currentUser && payload.userId === currentUser.id) {
        console.log(`[CURRENT USER] Before update - x: ${currentUser.x}, y: ${currentUser.y}`);
        console.log(`[CURRENT USER] After update  - x: ${movedPixelX}, y: ${movedPixelY}`);
        setCurrentUser(prev => {
          if (prev) {
            console.log(`[SET CURRENT USER] Updating from (${prev.x}, ${prev.y}) to (${movedPixelX}, ${movedPixelY})`);
          }
          return prev ? {
            ...prev,
            x: movedPixelX,
            y: movedPixelY
          } : null;
        });
      }
      
      setUsers(prev => prev.map(user => 
        user.id === payload.userId 
          ? { ...user, x: movedPixelX, y: movedPixelY }
          : user
      ));
    });

    websocketService.on('user-left', (payload: { userId: string }) => {
      console.log('User left:', payload);
      setUsers(prev => prev.filter(user => user.id !== payload.userId));
    });

    websocketService.on('move-rejected', (payload: { userId: string; x: number; y: number }) => {
      console.log('Movement rejected:', payload);
      // Backend sends grid coordinates, convert to pixels
      const rejectedPixelX = payload.x * GRID_SIZE;
      const rejectedPixelY = payload.y * GRID_SIZE;
      console.log(`[MOVE REJECTED] Restoring position - Grid: (${payload.x}, ${payload.y}) → Pixel: (${rejectedPixelX}, ${rejectedPixelY})`);
      
      if (currentUser && payload.userId === currentUser.id) {
        setCurrentUser(prev => prev ? {
          ...prev,
          x: rejectedPixelX,
          y: rejectedPixelY
        } : null);
      }
    });

    // Chat events
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
      console.log('Chat message received:', payload);
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
        createdAt: payload.createdAt || payload.timestamp,
        timestamp: new Date(payload.createdAt || payload.timestamp || Date.now())
      };
      
      setChatMessages(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(chatroomId) || [];
        newMap.set(chatroomId, [...existing, newMessage]);
        return newMap;
      });
    });

    // Additional chat event handlers...
    websocketService.on('chat-joined', (payload: { chatroomId: string }) => {
      console.log('Chat joined:', payload);
      setActiveChatrooms(prev => new Set([...prev, payload.chatroomId]));
    });

    websocketService.on('chat-error', (payload: { message?: string }) => {
      console.error('Chat error:', payload);
      setChatError(payload.message || 'Chat error occurred');
    });

    websocketService.on('error', (payload: { message?: string }) => {
      console.error('WebSocket error:', payload);
      setError(payload.message || 'WebSocket error');
    });
  };

  const handleDisconnectWebSocket = () => {
    websocketService.disconnect();
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    setUsers([]); // Clear other users when disconnecting
    setChatMessages(new Map()); // Clear chat messages when disconnecting
    setShowChatWindow(false); // Hide chat when disconnecting
    setSelectedChatroom(null); // Clear selected chatroom
    setActiveChatrooms(new Set()); // Clear active chatrooms
  };

  // ========================================
  // SIMPLIFIED CHAT SYSTEM HANDLERS
  // ========================================

  const handleSendMessage = () => {
    if (!chatInput.trim() || !isConnected || !selectedChatroom) return;
    
    sendChatMessage(selectedChatroom, chatInput.trim());
    setChatInput('');
  };

  const handleCreateChatroom = async () => {
    if (!newChatroomName.trim()) {
      setChatError('Chatroom name is required');
      return;
    }
    
    const result = await createChatroom(
      newChatroomName.trim(),
      newChatroomDescription.trim(),
      newChatroomPassword.trim()
    );
    
    if (result) {
      setNewChatroomName('');
      setNewChatroomDescription('');
      setNewChatroomPassword('');
      setShowCreateChatroomModal(false);
    }
  };

  const handleJoinChatroom = async (chatroomId: string, hasPassword: boolean) => {
    // Check if already in this chatroom
    if (activeChatrooms.has(chatroomId)) {
      console.log('Already in chatroom:', chatroomId);
      setSelectedChatroom(chatroomId);
      setShowChatWindow(true);
      return;
    }
    
    if (hasPassword) {
      setPendingChatroomId(chatroomId);
      setShowJoinChatroomModal(true);
    } else {
      await joinChatroom(chatroomId, '');
    }
  };

  const handleJoinWithPassword = async () => {
    if (!pendingChatroomId) return;
    
    // Check if already in this chatroom
    if (activeChatrooms.has(pendingChatroomId)) {
      console.log('Already in chatroom:', pendingChatroomId);
      setSelectedChatroom(pendingChatroomId);
      setShowChatWindow(true);
      setPendingChatroomId(null);
      setChatroomPassword('');
      setShowJoinChatroomModal(false);
      return;
    }
    
    const success = await joinChatroom(pendingChatroomId, chatroomPassword);
    if (success) {
      setPendingChatroomId(null);
      setChatroomPassword('');
      setShowJoinChatroomModal(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading Space..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600">Space not found</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRole="User">
      <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
        {/* Compact Header */}
        <div className="bg-black/80 text-white p-2 flex justify-between items-center z-50 relative">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center text-sm"
            >
              ← Dashboard
            </button>
            <h1 className="text-lg font-bold">{space.name}</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className="text-xs">{connectionStatus}</span>
            </div>
            
            {/* Compact Chat Button */}
            {isConnected && (
              <button
                onClick={() => {
                  setShowChatWindow(true);
                  loadChatrooms();
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1 text-sm"
              >
                <span>💬</span>
                <span>Chat</span>
              </button>
            )}
            
            <button
              onClick={isConnected ? handleDisconnectWebSocket : handleConnectToWebSocket}
              className={`px-3 py-1 rounded font-medium transition-colors text-sm ${
                isConnected 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isConnected ? 'Disconnect' : 'Join Live'}
            </button>
          </div>
        </div>

        {/* Full Screen Office Space */}
        <div className="flex-1 relative">
          {/* Debug info for troubleshooting */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50">
            <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
            <div>Current User: {currentUser ? `${currentUser.username} (${currentUser.x}, ${currentUser.y})` : 'None'}</div>
            <div>Other Users: {users.length}</div>
            <div>Total Users: {currentUser ? users.length + 1 : users.length}</div>
          </div>
          
          <OfficeSpaceViewer
            space={space}
            elements={elements}
            users={currentUser ? [...users, { ...currentUser, isCurrentUser: true }] : users}
            currentUser={currentUser || undefined}
            onUserMove={handleUserMove}
            scale={0.6}
            showGrid={showGrid}
            interactive={true}
            className="w-full h-full"
          />
        </div>

        {/* Video Call UI Components */}
        {shouldEnableVideoCalls && (
          <>
            {/* Proximity Manager - handles auto-connections based on position */}
            <ProximityManager
              userId={currentUser.id}
              username={currentUser.username}
              currentPosition={{ x: currentUser.x, y: currentUser.y, z: 0 }}
              allUsers={[...users, { ...currentUser, isCurrentUser: true }]}
              onNearbyUsersChange={(nearbyUsers) => {
                console.log('[SPACE PAGE] Nearby users updated:', nearbyUsers);
              }}
            />

            {/* Proximity Video Call UI */}
            <ProximityVideoCallUI 
              userId={currentUser.id}
              username={currentUser.username}
            />

            {/* Legacy Video Call Components - keeping for compatibility */}
            {/* Nearby Users Panel */}
            {nearbyUsers.length > 0 && (
              <div className="fixed top-4 right-4 z-40">
                <NearbyUsersPanel
                  nearbyUsers={nearbyUsers.map(user => ({
                    ...user,
                    isOnline: user.isOnline ?? true
                  }))}
                  currentUserPosition={currentUser ? { x: currentUser.x, y: currentUser.y, z: 0 } : { x: 0, y: 0, z: 0 }}
                  onInitiateCall={(userId: string) => initiateCall(userId)}
                />
              </div>
            )}

            {/* Video Call Interface */}
            {callState === 'active' && (localStream || remoteStream) && (
              <div className="fixed top-4 left-4 z-40">
                <VideoCallInterface
                  callSession={{
                    id: `active-call-${Date.now()}`,
                    callerId: currentUser?.id || '',
                    calleeId: '',
                    status: 'active',
                    startTime: new Date(),
                    type: 'peer-to-peer'
                  }}
                  localStream={localStream}
                  remoteStream={remoteStream}
                  isMuted={false}
                  isCameraOn={true}
                  isScreenSharing={false}
                  onEndCall={endCall}
                  onToggleMute={() => {}}
                  onToggleCamera={() => {}}
                  onStartScreenShare={() => {}}
                  onStopScreenShare={() => {}}
                />
              </div>
            )}

            {/* Incoming Call Modal */}
            {incomingCall && (
              <IncomingCallModal
                incomingCall={incomingCall}
                onAccept={(callId: string) => acceptCall(callId)}
                onReject={(callId: string) => rejectCall(callId, 'User declined')}
                isVisible={true}
              />
            )}
          </>
        )}

        {/* Chat Window Modal */}
        {showChatWindow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-6xl h-5/6 flex">
              {/* Left Sidebar - Chatrooms List */}
              <div className={`${selectedChatroom ? 'w-1/3' : 'w-full'} bg-gray-50 rounded-l-lg border-r`}>
                <div className="p-4 border-b bg-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Chat Rooms</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCreateChatroomModal(true)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Create Room
                      </button>
                      <button
                        onClick={() => {
                          setShowChatWindow(false);
                          setSelectedChatroom(null);
                          setChatMessages(new Map());
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 h-full overflow-y-auto">
                  {isLoadingChatrooms ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading chatrooms...</p>
                    </div>
                  ) : chatError ? (
                    <div className="text-center py-8">
                      <div className="text-red-500 mb-2">⚠️</div>
                      <p className="text-red-600 font-medium">{chatError}</p>
                      <button
                        onClick={loadChatrooms}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Retry
                      </button>
                    </div>
                  ) : chatrooms.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No chatrooms available</p>
                      <p className="text-sm text-gray-400">Create your first chatroom to start chatting</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatrooms.map((chatroom) => {
                        console.log('🔍 Rendering chatroom:', chatroom);
                        return (
                        <div
                          key={chatroom.id}
                          onClick={() => handleJoinChatroom(chatroom.id, chatroom.hasPassword)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedChatroom === chatroom.id
                              ? 'bg-blue-100 border-blue-300'
                              : 'bg-white hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {chatroom.hasPassword ? '🔒' : '🌐'} {chatroom.name || 'Unnamed Room'}
                              </h4>
                              {chatroom.description && (
                                <p className="text-sm text-gray-500">{chatroom.description}</p>
                              )}
                              <p className="text-xs text-gray-400">
                                {chatroom.memberCount || 0} member(s) {chatroom.hasPassword && '• Password protected'}
                              </p>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Chat Interface */}
              {selectedChatroom && (
                <div className="w-2/3 flex flex-col">
                  {/* Chat Header */}
                  <div className="p-4 border-b bg-gray-50">
                    <h4 className="font-semibold text-gray-900">
                      {chatrooms.find(c => c.id === selectedChatroom)?.name || 'Chat Room'}
                    </h4>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {!selectedChatroom || !chatMessages.get(selectedChatroom) || chatMessages.get(selectedChatroom)?.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <p>💬 No messages yet...</p>
                        <p className="text-sm">Start the conversation!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {chatMessages.get(selectedChatroom)?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${
                              msg.userId === currentUser?.id ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                msg.userId === currentUser?.id
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-900 border'
                              }`}
                            >
                              <div className="text-xs opacity-75 mb-1">
                                {msg.user.username} • {msg.timestamp ? msg.timestamp.toLocaleTimeString() : new Date(msg.createdAt).toLocaleTimeString()}
                              </div>
                              <div className="text-sm">{msg.content}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="p-4 border-t">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={500}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Password Modal */}
        {showJoinChatroomModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Enter Chatroom Password</h3>
              <input
                type="password"
                value={chatroomPassword}
                onChange={(e) => setChatroomPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && pendingChatroomId) {
                    handleJoinWithPassword();
                  }
                }}
                placeholder="Enter password..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowJoinChatroomModal(false);
                    setChatroomPassword('');
                    setPendingChatroomId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinWithPassword}
                  disabled={!chatroomPassword.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Chatroom Modal */}
        {showCreateChatroomModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Create New Chatroom</h3>
              
              {/* Room Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name *
                </label>
                <input
                  type="text"
                  value={newChatroomName}
                  onChange={(e) => setNewChatroomName(e.target.value)}
                  placeholder="Enter chatroom name..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newChatroomDescription}
                  onChange={(e) => setNewChatroomDescription(e.target.value)}
                  placeholder="Enter chatroom description..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password (optional)
                </label>
                <input
                  type="password"
                  value={newChatroomPassword}
                  onChange={(e) => setNewChatroomPassword(e.target.value)}
                  placeholder="Leave empty for public room..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {newChatroomPassword ? 'This will be a private room' : 'This will be a public room'}
                </p>
              </div>

              {/* Error Display */}
              {chatError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{chatError}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowCreateChatroomModal(false);
                    setNewChatroomName('');
                    setNewChatroomDescription('');
                    setNewChatroomPassword('');
                    setChatError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isCreatingChatroom}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateChatroom}
                  disabled={!newChatroomName.trim() || isCreatingChatroom}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingChatroom ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
