import { Position3D, User, PROXIMITY_RANGE, POSITION_UPDATE_INTERVAL, PROXIMITY_CHECK_INTERVAL } from '../types/video-call.js';
import { isValidPosition3D, calculateDistance } from '../utils/validation.js';

// Simple EventEmitter implementation for browser compatibility
class SimpleEventEmitter {
  private events: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  removeAllListeners(): void {
    this.events.clear();
  }
}

/**
 * Client-side proximity manager for peer-to-peer discovery
 * Handles position tracking and nearby user detection with fixed 10-unit range
 */
export class ProximityManager extends SimpleEventEmitter {
  private currentPosition: Position3D | null = null;
  private nearbyUsers: Map<string, User> = new Map();
  private positionUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private proximityCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isActive: boolean = false;

  // WebSocket connection for real-time updates (to be injected)
  private socketConnection: any = null;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize proximity manager with socket connection
   */
  initialize(socketConnection: any): void {
    this.socketConnection = socketConnection;
    this.setupSocketHandlers();
  }

  /**
   * Start proximity tracking
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.startPositionUpdates();
    this.startProximityChecks();
    this.emit('proximity-manager-started');
  }

  /**
   * Stop proximity tracking
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.stopPositionUpdates();
    this.stopProximityChecks();
    this.nearbyUsers.clear();
    this.emit('proximity-manager-stopped');
  }

  /**
   * Update current user position
   */
  updatePosition(x: number, y: number, z: number): void {
    const newPosition: Position3D = {
      x,
      y,
      z,
      timestamp: Date.now()
    };

    if (!isValidPosition3D(newPosition)) {
      throw new Error('Invalid position coordinates');
    }

    const previousPosition = this.currentPosition;
    this.currentPosition = newPosition;

    // Send position update to server if connected
    if (this.socketConnection && this.isActive) {
      this.socketConnection.emit('position-update', {
        position: newPosition,
        isAvailable: true // TODO: Get from user status
      });
    }

    // Check if position changed significantly (optimization)
    if (previousPosition && this.hasPositionChangedSignificantly(previousPosition, newPosition)) {
      this.emit('position-changed', newPosition);
    }
  }

  /**
   * Get current nearby users
   */
  getNearbyUsers(): User[] {
    return Array.from(this.nearbyUsers.values());
  }

  /**
   * Get current position
   */
  getCurrentPosition(): Position3D | null {
    return this.currentPosition;
  }

  /**
   * Check if a specific user is nearby
   */
  isUserNearby(userId: string): boolean {
    return this.nearbyUsers.has(userId);
  }

  /**
   * Get distance to a specific nearby user
   */
  getDistanceToUser(userId: string): number | null {
    const user = this.nearbyUsers.get(userId);
    if (!user || !this.currentPosition) {
      return null;
    }

    return calculateDistance(this.currentPosition, user.position);
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    this.on('nearby-users-updated', (users: User[]) => {
      this.handleNearbyUsersUpdate(users);
    });
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socketConnection) {
      return;
    }

    // Handle proximity updates from server
    this.socketConnection.on('proximity-update', (data: { nearbyUsers: User[] }) => {
      this.emit('nearby-users-updated', data.nearbyUsers);
    });

    // Handle individual user events
    this.socketConnection.on('user-entered-range', (data: { user: User }) => {
      this.handleUserEnteredRange(data.user);
    });

    this.socketConnection.on('user-left-range', (data: { userId: string }) => {
      this.handleUserLeftRange(data.userId);
    });

    // Handle connection events
    this.socketConnection.on('connect', () => {
      if (this.isActive && this.currentPosition) {
        // Re-send position on reconnection
        this.socketConnection.emit('position-update', {
          position: this.currentPosition,
          isAvailable: true
        });
      }
    });

    this.socketConnection.on('disconnect', () => {
      // Clear nearby users on disconnect
      this.nearbyUsers.clear();
      this.emit('proximity-cleared');
    });
  }

  /**
   * Start position update interval
   */
  private startPositionUpdates(): void {
    if (this.positionUpdateInterval !== null) {
      return;
    }

    this.positionUpdateInterval = setInterval(() => {
      if (this.currentPosition && this.socketConnection) {
        this.socketConnection.emit('position-heartbeat', {
          position: this.currentPosition,
          timestamp: Date.now()
        });
      }
    }, POSITION_UPDATE_INTERVAL);
  }

  /**
   * Stop position update interval
   */
  private stopPositionUpdates(): void {
    if (this.positionUpdateInterval !== null) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * Start proximity check interval
   */
  private startProximityChecks(): void {
    if (this.proximityCheckInterval !== null) {
      return;
    }

    this.proximityCheckInterval = setInterval(() => {
      this.performProximityCheck();
    }, PROXIMITY_CHECK_INTERVAL);
  }

  /**
   * Stop proximity check interval
   */
  private stopProximityChecks(): void {
    if (this.proximityCheckInterval !== null) {
      clearInterval(this.proximityCheckInterval);
      this.proximityCheckInterval = null;
    }
  }

  /**
   * Perform local proximity validation
   */
  private performProximityCheck(): void {
    if (!this.currentPosition) {
      return;
    }

    const usersToRemove: string[] = [];

    // Check if nearby users are still in range
    for (const [userId, user] of this.nearbyUsers) {
      const distance = calculateDistance(this.currentPosition, user.position);
      if (distance > PROXIMITY_RANGE) {
        usersToRemove.push(userId);
      }
    }

    // Remove users that are no longer in range
    for (const userId of usersToRemove) {
      this.nearbyUsers.delete(userId);
      this.emit('user-left-range', { userId });
    }

    if (usersToRemove.length > 0) {
      this.emit('proximity-updated', this.getNearbyUsers());
    }
  }

  /**
   * Handle nearby users update from server
   */
  private handleNearbyUsersUpdate(users: User[]): void {
    const previousUserIds = new Set(this.nearbyUsers.keys());
    const currentUserIds = new Set(users.map(u => u.id));

    // Find newly entered users
    const enteredUsers = users.filter(user => !previousUserIds.has(user.id));

    // Find users who left
    const leftUserIds = Array.from(previousUserIds).filter(id => !currentUserIds.has(id));

    // Update nearby users map
    this.nearbyUsers.clear();
    for (const user of users) {
      this.nearbyUsers.set(user.id, user);
    }

    // Emit events for changes
    for (const user of enteredUsers) {
      this.emit('user-entered-range', { user });
    }

    for (const userId of leftUserIds) {
      this.emit('user-left-range', { userId });
    }

    this.emit('proximity-updated', users);
  }

  /**
   * Handle individual user entering range
   */
  private handleUserEnteredRange(user: User): void {
    if (!this.nearbyUsers.has(user.id)) {
      this.nearbyUsers.set(user.id, user);
      this.emit('user-entered-range', { user });
      this.emit('proximity-updated', this.getNearbyUsers());
    }
  }

  /**
   * Handle individual user leaving range
   */
  private handleUserLeftRange(userId: string): void {
    if (this.nearbyUsers.has(userId)) {
      this.nearbyUsers.delete(userId);
      this.emit('user-left-range', { userId });
      this.emit('proximity-updated', this.getNearbyUsers());
    }
  }

  /**
   * Check if position changed significantly to avoid unnecessary updates
   */
  private hasPositionChangedSignificantly(oldPos: Position3D, newPos: Position3D): boolean {
    const distance = calculateDistance(oldPos, newPos);
    return distance > 1; // 1 unit threshold for significant change
  }

  /**
   * Get proximity manager status
   */
  getStatus(): {
    isActive: boolean;
    currentPosition: Position3D | null;
    nearbyUsersCount: number;
    hasSocketConnection: boolean;
  } {
    return {
      isActive: this.isActive,
      currentPosition: this.currentPosition,
      nearbyUsersCount: this.nearbyUsers.size,
      hasSocketConnection: !!this.socketConnection
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.socketConnection = null;
  }
}