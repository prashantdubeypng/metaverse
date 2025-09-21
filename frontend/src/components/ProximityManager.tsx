import { useEffect, useState, useCallback } from 'react';
import { User } from '@/types/video-call';
import { useProximityVideoCall } from '@/hooks/useProximityVideoCall';
import websocketService from '../services/websocket';

interface ProximityManagerProps {
  userId: string;
  username: string;
  currentPosition: { x: number; y: number; z?: number };
  onNearbyUsersChange?: (users: User[]) => void;
}

interface NearbyUser extends User {
  distance: number;
  isInVideoCallRange: boolean;
}

const ProximityManager: React.FC<ProximityManagerProps> = ({
  userId,
  username, // Used for debugging (currently unused but kept for interface consistency)
  currentPosition,
  onNearbyUsersChange
}) => {
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [isProximityActive, setIsProximityActive] = useState(false);

  const {
    updatePosition,
    handleNearbyUsers,
    isInitialized,
    initialize,
  } = useProximityVideoCall();

  const GRID_SIZE = 20; // Each grid cell is 20x20 pixels (must match space page)
  const VIDEO_CALL_RANGE_TILES = 2; // 2 tiles for video call activation
  const PROXIMITY_RANGE_TILES = 10; // 10 tiles for proximity detection
  const VIDEO_CALL_RANGE = VIDEO_CALL_RANGE_TILES * GRID_SIZE; // 40 pixels
  const PROXIMITY_RANGE = PROXIMITY_RANGE_TILES * GRID_SIZE; // 200 pixels

  /**
   * Calculate distance between two positions
   */
  const calculateDistance = useCallback((pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  /**
   * Initialize proximity video call system
   */
  useEffect(() => {
    if (!isInitialized && userId) {
      initialize(userId);
    }
  }, [userId, initialize, isInitialized]);

  /**
   * Update position when user moves
   */
  useEffect(() => {
    if (isInitialized) {
      updatePosition(currentPosition.x, currentPosition.y, currentPosition.z || 0);
    }
  }, [currentPosition.x, currentPosition.y, currentPosition.z, updatePosition, isInitialized]);

  /**
   * Handle WebSocket proximity updates
   */
  useEffect(() => {
    const handleProximityUpdate = (data: {
      nearbyUsers: Array<{
        id: string;
        username: string;
        x: number;
        y: number;
        isOnline: boolean;
      }>;
    }) => {
      const usersWithDistance: NearbyUser[] = data.nearbyUsers
        .filter(user => user.id !== userId && user.isOnline)
        .map(user => {
          const distance = calculateDistance(currentPosition, { x: user.x, y: user.y });
          return {
            id: user.id,
            username: user.username,
            x: user.x,
            y: user.y,
            isOnline: true,
            distance,
            isInVideoCallRange: distance <= VIDEO_CALL_RANGE,
          };
        })
        .filter(user => user.distance <= PROXIMITY_RANGE)
        .sort((a, b) => a.distance - b.distance);

      setNearbyUsers(usersWithDistance);

      // Update video call system with users in video call range
      const usersInVideoRange = usersWithDistance.filter(user => user.isInVideoCallRange);
      console.log(`🎥 [VIDEO CALL TRIGGER] ${usersInVideoRange.length} users in video call range, triggering handleNearbyUsers`);
      handleNearbyUsers(usersInVideoRange);

      // Notify parent component
      onNearbyUsersChange?.(usersWithDistance);
    };

    const handleUserJoined = (data: {
      userId: string;
      username: string;
      x: number;
      y: number;
    }) => {
      if (data.userId === userId) return;

      // Convert from grid coordinates to pixel coordinates
      const pixelX = data.x * GRID_SIZE;
      const pixelY = data.y * GRID_SIZE;
      const distance = calculateDistance(currentPosition, { x: pixelX, y: pixelY });
      
      console.log(`👤 [PROXIMITY] User ${data.username} (${data.userId}) joined at grid(${data.x}, ${data.y}) = pixel(${pixelX}, ${pixelY}), distance: ${distance.toFixed(1)}px (${(distance/GRID_SIZE).toFixed(1)} tiles)`);
      
      if (distance <= PROXIMITY_RANGE) {
        setNearbyUsers(prev => {
          const existing = prev.find(u => u.id === data.userId);
          if (existing) {
            return prev.map(u => u.id === data.userId ? {
              ...u,
              username: data.username,
              x: pixelX,
              y: pixelY,
              distance,
              isInVideoCallRange: distance <= VIDEO_CALL_RANGE,
            } : u);
          } else {
            const newUser: NearbyUser = {
              id: data.userId,
              username: data.username,
              x: pixelX,
              y: pixelY,
              isOnline: true,
              distance,
              isInVideoCallRange: distance <= VIDEO_CALL_RANGE,
            };
            
            if (distance <= VIDEO_CALL_RANGE) {
              console.log(`🎥 [VIDEO RANGE] New user ${data.username} is within video call range! Distance: ${distance.toFixed(1)}px (${(distance/GRID_SIZE).toFixed(1)} tiles)`);
            }
            
            return [...prev, newUser].sort((a, b) => a.distance - b.distance);
          }
        });
      }
    };

    const handleUserLeft = (data: { userId: string }) => {
      setNearbyUsers(prev => prev.filter(u => u.id !== data.userId));
    };

    const handleUserMoved = (data: {
      userId: string;
      x: number;
      y: number;
    }) => {
      if (data.userId === userId) return;

      // Convert from grid coordinates to pixel coordinates
      const pixelX = data.x * GRID_SIZE;
      const pixelY = data.y * GRID_SIZE;
      const distance = calculateDistance(currentPosition, { x: pixelX, y: pixelY });

      console.log(`🎯 [PROXIMITY] User ${data.userId} moved to grid(${data.x}, ${data.y}) = pixel(${pixelX}, ${pixelY}), distance: ${distance.toFixed(1)}px (${(distance/GRID_SIZE).toFixed(1)} tiles)`);

      setNearbyUsers(prev => {
        if (distance > PROXIMITY_RANGE) {
          // User moved out of proximity range
          console.log(`🚫 [PROXIMITY] User ${data.userId} moved out of proximity range (${distance.toFixed(1)}px > ${PROXIMITY_RANGE}px)`);
          return prev.filter(u => u.id !== data.userId);
        } else {
          // Update user position
          const existing = prev.find(u => u.id === data.userId);
          if (existing) {
            const wasInVideoRange = existing.isInVideoCallRange;
            const nowInVideoRange = distance <= VIDEO_CALL_RANGE;
            
            if (!wasInVideoRange && nowInVideoRange) {
              console.log(`🎥 [VIDEO RANGE] User ${data.userId} entered video call range! Distance: ${distance.toFixed(1)}px (${(distance/GRID_SIZE).toFixed(1)} tiles)`);
            } else if (wasInVideoRange && !nowInVideoRange) {
              console.log(`📤 [VIDEO RANGE] User ${data.userId} left video call range. Distance: ${distance.toFixed(1)}px (${(distance/GRID_SIZE).toFixed(1)} tiles)`);
            }
            
            return prev.map(u => u.id === data.userId ? {
              ...u,
              x: pixelX,
              y: pixelY,
              distance,
              isInVideoCallRange: distance <= VIDEO_CALL_RANGE,
            } : u).sort((a, b) => a.distance - b.distance);
          } else if (distance <= PROXIMITY_RANGE) {
            console.log(`👋 [PROXIMITY] New user ${data.userId} detected in proximity range! Distance: ${distance.toFixed(1)}px (${(distance/GRID_SIZE).toFixed(1)} tiles)`);
            const newUser: NearbyUser = {
              id: data.userId,
              username: `User_${data.userId.slice(0, 8)}`, // We'll get the real username from other events
              x: pixelX,
              y: pixelY,
              isOnline: true,
              distance,
              isInVideoCallRange: distance <= VIDEO_CALL_RANGE,
            };
            return [...prev, newUser].sort((a, b) => a.distance - b.distance);
          }
          return prev;
        }
      });
    };

    // Set up WebSocket listeners
    websocketService.on('proximity-update', handleProximityUpdate);
    websocketService.on('user-joined-space', handleUserJoined);
    websocketService.on('user-left-space', handleUserLeft);
    websocketService.on('user-moved', handleUserMoved);

    setIsProximityActive(true);

    // Cleanup
    return () => {
      websocketService.off('proximity-update', handleProximityUpdate);
      websocketService.off('user-joined-space', handleUserJoined);
      websocketService.off('user-left-space', handleUserLeft);
      websocketService.off('user-moved', handleUserMoved);
      setIsProximityActive(false);
    };
  }, [userId, currentPosition, calculateDistance, handleNearbyUsers, onNearbyUsersChange, PROXIMITY_RANGE, VIDEO_CALL_RANGE]);

  /**
   * Send proximity heartbeat every 5 seconds
   */
  useEffect(() => {
    if (!isProximityActive) return;

    const interval = setInterval(() => {
      websocketService.emit('proximity-heartbeat', {
        userId,
        position: currentPosition,
        timestamp: Date.now(),
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, currentPosition, isProximityActive]);

  /**
   * Trigger video call system when nearby users change
   */
  useEffect(() => {
    const usersInVideoRange = nearbyUsers.filter(u => u.isInVideoCallRange);
    console.log(`🔄 [VIDEO TRIGGER] Nearby users updated: ${nearbyUsers.length} total, ${usersInVideoRange.length} in video range`);
    
    if (usersInVideoRange.length > 0) {
      console.log('🎥 [TRIGGERING VIDEO] Users in video call range:', usersInVideoRange.map(u => ({
        id: u.id,
        username: u.username,
        distance: u.distance.toFixed(1) + 'px',
        tiles: (u.distance / GRID_SIZE).toFixed(1)
      })));
    }
    
    handleNearbyUsers(usersInVideoRange);
    onNearbyUsersChange?.(nearbyUsers);
  }, [nearbyUsers, handleNearbyUsers, onNearbyUsersChange, GRID_SIZE]);

  /**
   * Debug: Log nearby users changes
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const usersInVideoRange = nearbyUsers.filter(u => u.isInVideoCallRange);
      const usersInProximity = nearbyUsers.filter(u => !u.isInVideoCallRange);
      
      if (usersInVideoRange.length > 0) {
        console.log('🎥 Users in video call range (≤2 tiles):', usersInVideoRange.map(u => ({
          username: u.username,
          distancePixels: u.distance.toFixed(1),
          distanceTiles: (u.distance / GRID_SIZE).toFixed(1)
        })));
      }
      
      if (usersInProximity.length > 0) {
        console.log('👥 Users in proximity (>2 tiles, ≤10 tiles):', usersInProximity.map(u => ({
          username: u.username,
          distancePixels: u.distance.toFixed(1),
          distanceTiles: (u.distance / GRID_SIZE).toFixed(1)
        })));
      }
    }
  }, [nearbyUsers, GRID_SIZE]);

  // This component doesn't render anything visible - it's a service component
  return null;
};

export default ProximityManager;