import { Position3D, UserPosition, CallSession, SignalingMessage, User } from '../types/video-call.js';

// Position validation
export function isValidPosition3D(position: any): position is Position3D {
  return (
    typeof position === 'object' &&
    position !== null &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    typeof position.z === 'number' &&
    typeof position.timestamp === 'number' &&
    !isNaN(position.x) &&
    !isNaN(position.y) &&
    !isNaN(position.z) &&
    position.timestamp > 0
  );
}

export function isValidUserPosition(userPosition: any): userPosition is UserPosition {
  return (
    typeof userPosition === 'object' &&
    userPosition !== null &&
    typeof userPosition.userId === 'string' &&
    userPosition.userId.length > 0 &&
    isValidPosition3D(userPosition.position) &&
    typeof userPosition.isAvailable === 'boolean' &&
    userPosition.proximityRange === 10 // Fixed at 10 for MVP
  );
}

// User validation
export function isValidUser(user: any): user is User {
  return (
    typeof user === 'object' &&
    user !== null &&
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.username === 'string' &&
    user.username.length > 0 &&
    ['available', 'unavailable', 'in-call', 'do-not-disturb'].includes(user.status) &&
    isValidPosition3D(user.position) &&
    Array.isArray(user.blockedUsers) &&
    Array.isArray(user.friends) &&
    typeof user.privacySettings === 'object' &&
    typeof user.privacySettings.allowCallsFromStrangers === 'boolean' &&
    typeof user.privacySettings.proximityVisible === 'boolean'
  );
}

// Call session validation
export function isValidCallSession(callSession: any): callSession is CallSession {
  return (
    typeof callSession === 'object' &&
    callSession !== null &&
    typeof callSession.callId === 'string' &&
    callSession.callId.length > 0 &&
    callSession.type === 'peer-to-peer' &&
    Array.isArray(callSession.participants) &&
    callSession.participants.length === 2 &&
    callSession.participants.every((p: any) => typeof p === 'string' && p.length > 0) &&
    ['pending', 'connecting', 'active', 'ended'].includes(callSession.status) &&
    callSession.createdAt instanceof Date
  );
}

// Signaling message validation
export function isValidSignalingMessage(message: any): message is SignalingMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    ['offer', 'answer', 'ice-candidate', 'call-end'].includes(message.type) &&
    typeof message.callId === 'string' &&
    message.callId.length > 0 &&
    message.payload !== undefined &&
    message.timestamp instanceof Date
  );
}

// Distance calculation with validation
export function calculateDistance(pos1: Position3D, pos2: Position3D): number {
  if (!isValidPosition3D(pos1) || !isValidPosition3D(pos2)) {
    throw new Error('Invalid position data for distance calculation');
  }
  
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Check if two users are within proximity range
export function areUsersInRange(user1: UserPosition, user2: UserPosition): boolean {
  if (!isValidUserPosition(user1) || !isValidUserPosition(user2)) {
    return false;
  }
  
  const distance = calculateDistance(user1.position, user2.position);
  return distance <= 10; // Fixed 10-unit range for MVP
}

// Validate call eligibility between two users
export function canInitiateCall(fromUser: User, toUser: User): { canCall: boolean; reason?: string } {
  if (!isValidUser(fromUser) || !isValidUser(toUser)) {
    return { canCall: false, reason: 'Invalid user data' };
  }
  
  // Check if target user is available
  if (toUser.status === 'unavailable' || toUser.status === 'in-call') {
    return { canCall: false, reason: 'User is not available' };
  }
  
  // Check if user is blocked
  if (toUser.blockedUsers.includes(fromUser.id)) {
    return { canCall: false, reason: 'You are blocked by this user' };
  }
  
  // Check privacy settings
  if (!toUser.privacySettings.allowCallsFromStrangers && !toUser.friends.includes(fromUser.id)) {
    return { canCall: false, reason: 'User only accepts calls from friends' };
  }
  
  // Check proximity
  const fromUserPosition: UserPosition = {
    userId: fromUser.id,
    position: fromUser.position,
    isAvailable: fromUser.status === 'available',
    proximityRange: 10
  };
  
  const toUserPosition: UserPosition = {
    userId: toUser.id,
    position: toUser.position,
    isAvailable: toUser.status === 'available',
    proximityRange: 10
  };
  
  if (!areUsersInRange(fromUserPosition, toUserPosition)) {
    return { canCall: false, reason: 'User is not within range' };
  }
  
  return { canCall: true };
}