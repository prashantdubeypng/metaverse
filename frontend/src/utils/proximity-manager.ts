import { 
  Position3D, 
  User 
} from '@/types/video-call';

export class ProximityManager {
  private websocket: WebSocket | null = null;
  private currentPosition: Position3D = { x: 0, y: 0, z: 0 };
  private nearbyUsers: Map<string, User> = new Map();
  private proximityRange: number = 2; // 2 units for 2 tiles/blocks
  
  // Event listeners with simpler type handling
  private eventListeners: Record<string, ((data: unknown) => void)[]> = {};

  constructor(proximityRange: number = 2) {
    // Keep default at 2; parameter retained for future configurability
    this.proximityRange = proximityRange;
  }

  initialize(websocket: WebSocket): void {
    this.websocket = websocket;
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
    if (!this.websocket) return;

    this.websocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'proximity-update':
          this.handleProximityUpdate(message.payload);
          break;
        case 'user-moved':
          this.handleUserMoved(message.payload);
          break;
      }
    });
  }

  updatePosition(x: number, y: number, z: number = 0): void {
    this.currentPosition = { x, y, z };
    
    // Send position update to server
    if (this.websocket) {
      this.websocket.send(JSON.stringify({
        type: 'position-update',
        payload: {
          position: this.currentPosition,
          timestamp: Date.now()
        }
      }));
    }

    // Check proximity with current nearby users
    this.checkProximityChanges();
  }

  private handleProximityUpdate(data: { nearbyUsers: User[]; userPosition: Position3D }): void {
    const previousNearbyUsers = new Set(this.nearbyUsers.keys());
    const currentNearbyUsers = new Set(data.nearbyUsers.map(user => user.id));

    // Find users who entered range
    data.nearbyUsers.forEach(user => {
      if (!previousNearbyUsers.has(user.id)) {
        const distance = this.calculateDistance(this.currentPosition, user);
        this.emit('user-entered-range', { user, distance });
      }
      this.nearbyUsers.set(user.id, user);
    });

    // Find users who left range
    previousNearbyUsers.forEach(userId => {
      if (!currentNearbyUsers.has(userId)) {
        this.nearbyUsers.delete(userId);
        this.emit('user-left-range', { userId });
      }
    });

    // Update current position if provided
    if (data.userPosition) {
      this.currentPosition = data.userPosition;
    }

    this.emit('proximity-update', { nearbyUsers: data.nearbyUsers });
  }

  private handleUserMoved(data: { userId: string; position: Position3D; timestamp: number }): void {
    const user = this.nearbyUsers.get(data.userId);
    if (user) {
      // Update user position
      user.x = data.position.x;
      user.y = data.position.y;
      
      // Check if user is still in range
      const distance = this.calculateDistance(this.currentPosition, data.position);
      if (distance > this.proximityRange) {
        // User moved out of range
        this.nearbyUsers.delete(data.userId);
        this.emit('user-left-range', { userId: data.userId });
      } else {
        // Update user in nearby users
        this.nearbyUsers.set(data.userId, user);
      }
      
      // Emit updated nearby users list
      this.emit('proximity-update', { nearbyUsers: Array.from(this.nearbyUsers.values()) });
    }
  }

  private checkProximityChanges(): void {
    const usersInRange: User[] = [];
    const usersOutOfRange: string[] = [];

    this.nearbyUsers.forEach((user, userId) => {
      const distance = this.calculateDistance(this.currentPosition, user);
      
      if (distance <= this.proximityRange) {
        usersInRange.push(user);
      } else {
        usersOutOfRange.push(userId);
      }
    });

    // Remove users who are now out of range
    usersOutOfRange.forEach(userId => {
      this.nearbyUsers.delete(userId);
      this.emit('user-left-range', { userId });
    });

    if (usersOutOfRange.length > 0 || usersInRange.length !== this.nearbyUsers.size) {
      this.emit('proximity-update', { nearbyUsers: usersInRange });
    }
  }

  private calculateDistance(pos1: Position3D, pos2: Position3D | User): number {
    const p2 = 'x' in pos2 ? { x: pos2.x, y: pos2.y, z: 0 } : pos2;
    
    const dx = pos1.x - p2.x;
    const dy = pos1.y - p2.y;
    const dz = (pos1.z || 0) - (p2.z || 0);
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Event emitter methods with simpler typing
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback: (data: unknown) => void): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data: unknown): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  // Utility methods
  getNearbyUsers(): User[] {
    return Array.from(this.nearbyUsers.values());
  }

  getCurrentPosition(): Position3D {
    return { ...this.currentPosition };
  }

  getProximityRange(): number {
    return this.proximityRange;
  }

  setProximityRange(range: number): void {
    this.proximityRange = range;
    this.checkProximityChanges();
  }

  isUserInRange(userId: string): boolean {
    return this.nearbyUsers.has(userId);
  }

  getUserDistance(userId: string): number | null {
    const user = this.nearbyUsers.get(userId);
    if (!user) return null;
    
    return this.calculateDistance(this.currentPosition, user);
  }

  getVisualRangeIndicator(): { center: Position3D; radius: number } {
    return {
      center: { ...this.currentPosition },
      radius: this.proximityRange
    };
  }
}
