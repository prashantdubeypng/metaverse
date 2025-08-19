import { Socket } from "socket.io";
import Redis from "ioredis";

interface UserConnection {
  socketId: string;
  userId: string;
  username: string;
  joinedAt: number;
  lastActivity: number;
  rooms: Set<string>;
}

export class ConnectionManager {
  private connections: Map<string, UserConnection> = new Map(); // socketId -> UserConnection
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private roomUsers: Map<string, Set<string>> = new Map(); // roomId -> Set of userIds
  private redis: Redis;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 300000; // 5 minutes
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(redis: Redis) {
    this.redis = redis;
    this.startHeartbeat();
  }

  // Add a new connection
  addConnection(socket: Socket): void {
    const connection: UserConnection = {
      socketId: socket.id,
      userId: socket.userId!,
      username: socket.username!,
      joinedAt: Date.now(),
      lastActivity: Date.now(),
      rooms: new Set()
    };

    this.connections.set(socket.id, connection);

    // Track user's multiple sockets (for multiple tabs/devices)
    if (!this.userSockets.has(socket.userId!)) {
      this.userSockets.set(socket.userId!, new Set());
    }
    this.userSockets.get(socket.userId!)!.add(socket.id);

    console.log(`Added connection: ${socket.id} for user ${socket.userId}`);
    this.publishConnectionEvent('user_connected', {
      userId: socket.userId,
      username: socket.username,
      socketId: socket.id,
      timestamp: Date.now()
    });
  }

  // Remove a connection
  removeConnection(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    const { userId, username, rooms } = connection;

    // Remove from all rooms
    rooms.forEach(roomId => {
      this.leaveRoom(socketId, roomId);
    });

    // Remove from user's socket set
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.connections.delete(socketId);

    console.log(`Removed connection: ${socketId} for user ${userId}`);
    this.publishConnectionEvent('user_disconnected', {
      userId,
      username,
      socketId,
      timestamp: Date.now()
    });
  }

  // Join a room
  joinRoom(socketId: string, roomId: string): boolean {
    const connection = this.connections.get(socketId);
    if (!connection) return false;

    connection.rooms.add(roomId);
    connection.lastActivity = Date.now();

    // Track room users
    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Set());
    }
    this.roomUsers.get(roomId)!.add(connection.userId);

    this.publishRoomEvent('user_joined_room', {
      userId: connection.userId,
      username: connection.username,
      roomId,
      timestamp: Date.now()
    });

    return true;
  }

  // Leave a room
  leaveRoom(socketId: string, roomId: string): boolean {
    const connection = this.connections.get(socketId);
    if (!connection) return false;

    connection.rooms.delete(roomId);
    connection.lastActivity = Date.now();

    // Remove from room users if no other sockets of this user are in the room
    const userSocketsInRoom = this.getUserSocketsInRoom(connection.userId, roomId);
    if (userSocketsInRoom.length === 0) {
      this.roomUsers.get(roomId)?.delete(connection.userId);
      if (this.roomUsers.get(roomId)?.size === 0) {
        this.roomUsers.delete(roomId);
      }

      this.publishRoomEvent('user_left_room', {
        userId: connection.userId,
        username: connection.username,
        roomId,
        timestamp: Date.now()
      });
    }

    return true;
  }

  // Update user activity
  updateActivity(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  // Get all sockets for a user
  getUserSockets(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) || []);
  }

  // Get rooms for a specific socket
  getUserRooms(socketId: string): string[] {
    const connection = this.connections.get(socketId);
    return connection ? Array.from(connection.rooms) : [];
  }

  // Get user sockets in a specific room
  getUserSocketsInRoom(userId: string, roomId: string): string[] {
    const userSockets = this.getUserSockets(userId);
    return userSockets.filter(socketId => {
      const connection = this.connections.get(socketId);
      return connection?.rooms.has(roomId);
    });
  }

  // Get all users in a room
  getRoomUsers(roomId: string): string[] {
    return Array.from(this.roomUsers.get(roomId) || []);
  }

  // Get active users in a room (recently active)
  getActiveRoomUsers(roomId: string, withinMs: number = 300000): string[] {
    const allUsers = this.getRoomUsers(roomId);
    const now = Date.now();
    
    return allUsers.filter(userId => {
      const userSockets = this.getUserSockets(userId);
      return userSockets.some(socketId => {
        const connection = this.connections.get(socketId);
        return connection && (now - connection.lastActivity) < withinMs;
      });
    });
  }

  // Get connection stats
  getStats(): {
    totalConnections: number;
    totalUsers: number;
    totalRooms: number;
    averageRoomsPerUser: number;
  } {
    const totalConnections = this.connections.size;
    const totalUsers = this.userSockets.size;
    const totalRooms = this.roomUsers.size;
    const totalUserRooms = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.rooms.size, 0);
    
    return {
      totalConnections,
      totalUsers,
      totalRooms,
      averageRoomsPerUser: totalUsers > 0 ? totalUserRooms / totalUsers : 0
    };
  }

  // Cleanup inactive connections
  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const inactiveConnections: string[] = [];

    this.connections.forEach((connection, socketId) => {
      if (now - connection.lastActivity > this.CONNECTION_TIMEOUT) {
        inactiveConnections.push(socketId);
      }
    });

    inactiveConnections.forEach(socketId => {
      console.log(`Cleaning up inactive connection: ${socketId}`);
      this.removeConnection(socketId);
    });

    if (inactiveConnections.length > 0) {
      console.log(`Cleaned up ${inactiveConnections.length} inactive connections`);
    }
  }

  // Start heartbeat monitoring
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.cleanupInactiveConnections();
      this.publishStats();
    }, this.HEARTBEAT_INTERVAL);
  }

  // Stop heartbeat monitoring
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Publish connection events to Redis
  private async publishConnectionEvent(event: string, data: any): Promise<void> {
    try {
      await this.redis.publish('chat:connections', JSON.stringify({
        event,
        data,
        serviceId: process.env.SERVICE_ID || 'chat-service-1',
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to publish connection event:', error);
    }
  }

  // Publish room events to Redis
  private async publishRoomEvent(event: string, data: any): Promise<void> {
    try {
      await this.redis.publish('chat:rooms', JSON.stringify({
        event,
        data,
        serviceId: process.env.SERVICE_ID || 'chat-service-1',
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to publish room event:', error);
    }
  }

  // Publish stats to Redis
  private async publishStats(): Promise<void> {
    try {
      const stats = this.getStats();
      await this.redis.publish('chat:stats', JSON.stringify({
        serviceId: process.env.SERVICE_ID || 'chat-service-1',
        stats,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to publish stats:', error);
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.stopHeartbeat();
    
    // Notify about all disconnections
    for (const [socketId] of this.connections) {
      this.removeConnection(socketId);
    }
    
    console.log('ConnectionManager shutdown complete');
  }
}
