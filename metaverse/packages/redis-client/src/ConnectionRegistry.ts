/**
 * ConnectionRegistry - Redis-based connection tracking for WebSocket servers
 * 
 * PURPOSE:
 * This module provides a centralized registry for tracking user connections
 * across multiple WebSocket server instances. It enables:
 * - Multi-server deployments with load balancing
 * - Page refresh recovery (BUG-032)
 * - User presence tracking across the system
 * - Connection deduplication (prevent multiple connections per user)
 * 
 * DATA STRUCTURES IN REDIS:
 * - conn:{userId} -> Hash: { serverId, spaceId, connectedAt, lastHeartbeat, socketId }
 * - server:{serverId}:connections -> Set of userIds connected to this server
 * - space:{spaceId}:users -> Set of userIds currently in this space
 * - conn:pending:{userId} -> String: temporary reconnection token (TTL: 30s)
 * 
 * USAGE:
 * ```typescript
 * const registry = new ConnectionRegistry(redisClient);
 * await registry.registerConnection(userId, serverId, spaceId);
 * const userInfo = await registry.getConnection(userId);
 * await registry.setReconnectionToken(userId, token);
 * const isValid = await registry.validateReconnectionToken(userId, token);
 * ```
 * 
 * @author GitHub Copilot
 * @see docs/bugs/BUG-032-page-refresh-connection-loss.md
 */

import { createClient, RedisClientType } from 'redis';

/**
 * Connection information stored for each user
 */
export interface ConnectionInfo {
  /** Unique identifier of the user */
  userId: string;
  /** ID of the WebSocket server handling this connection */
  serverId: string;
  /** ID of the space the user is currently in (null if not in a space) */
  spaceId: string | null;
  /** ISO timestamp when the connection was established */
  connectedAt: string;
  /** ISO timestamp of the last heartbeat received */
  lastHeartbeat: string;
  /** Unique socket identifier for this connection */
  socketId: string;
  /** User's current X position in the space (grid coordinates) */
  positionX?: number;
  /** User's current Y position in the space (grid coordinates) */
  positionY?: number;
}

/**
 * Options for creating a reconnection token
 */
export interface ReconnectionTokenOptions {
  /** Token time-to-live in seconds (default: 30) */
  ttlSeconds?: number;
}

/**
 * Result of validating a reconnection token
 */
export interface ReconnectionValidationResult {
  /** Whether the token is valid */
  valid: boolean;
  /** The space ID the user was in (if valid) */
  spaceId?: string;
  /** The position the user was at (if valid) */
  position?: { x: number; y: number };
}

/**
 * ConnectionRegistry - Manages user connection state across WebSocket servers
 * 
 * This class provides methods for registering, tracking, and cleaning up
 * WebSocket connections using Redis as a centralized store. It supports
 * multi-server deployments and enables page refresh recovery.
 */
export class ConnectionRegistry {
  private redis: RedisClientType;
  private serverId: string;
  
  /** Time-to-live for connection records in seconds (5 minutes) */
  private readonly CONNECTION_TTL = 300;
  
  /** Time-to-live for reconnection tokens in seconds (30 seconds) */
  private readonly RECONNECTION_TOKEN_TTL = 30;
  
  /** Redis key prefixes for different data types */
  private readonly KEYS = {
    CONNECTION: 'conn:',
    SERVER_CONNECTIONS: 'server:',
    SPACE_USERS: 'space:',
    RECONNECTION_TOKEN: 'conn:pending:',
    HEARTBEAT: 'conn:heartbeat:',
  } as const;

  /**
   * Creates a new ConnectionRegistry instance
   * 
   * @param redis - Connected Redis client instance
   * @param serverId - Unique identifier for this WebSocket server
   */
  constructor(redis: RedisClientType, serverId: string) {
    this.redis = redis;
    this.serverId = serverId;
  }

  /**
   * Creates a new ConnectionRegistry with a fresh Redis connection
   * 
   * @param redisUrl - Redis connection URL (e.g., 'redis://localhost:6379')
   * @param serverId - Unique identifier for this WebSocket server
   * @returns Promise resolving to a connected ConnectionRegistry instance
   */
  static async create(redisUrl: string, serverId: string): Promise<ConnectionRegistry> {
    const redis = createClient({ url: redisUrl }) as RedisClientType;
    await redis.connect();
    return new ConnectionRegistry(redis, serverId);
  }

  // ==========================================================================
  // CONNECTION REGISTRATION & TRACKING
  // ==========================================================================

  /**
   * Registers a new user connection with the registry
   * 
   * This method:
   * 1. Checks for existing connections and cleans them up
   * 2. Stores connection info in a Redis hash
   * 3. Adds the user to the server's connection set
   * 4. Adds the user to the space's user set (if in a space)
   * 5. Sets a TTL on the connection record
   * 
   * @param userId - Unique identifier of the connecting user
   * @param socketId - Unique identifier of the WebSocket connection
   * @param spaceId - ID of the space the user is joining (optional)
   * @returns Promise resolving to the created ConnectionInfo
   * 
   * @example
   * ```typescript
   * const conn = await registry.registerConnection(
   *   'user-123',
   *   'socket-abc',
   *   'space-xyz'
   * );
   * console.log(`User connected at ${conn.connectedAt}`);
   * ```
   */
  async registerConnection(
    userId: string,
    socketId: string,
    spaceId?: string
  ): Promise<ConnectionInfo> {
    const now = new Date().toISOString();
    const connKey = this.KEYS.CONNECTION + userId;
    
    // Check for existing connection
    const existing = await this.getConnection(userId);
    if (existing) {
      console.log(`[ConnectionRegistry] Cleaning up existing connection for user ${userId}`);
      await this.removeConnection(userId);
    }
    
    // Create connection info object
    const connectionInfo: ConnectionInfo = {
      userId,
      serverId: this.serverId,
      spaceId: spaceId || null,
      connectedAt: now,
      lastHeartbeat: now,
      socketId,
    };
    
    // Store connection info as hash
    await this.redis.hSet(connKey, {
      userId,
      serverId: this.serverId,
      spaceId: spaceId || '',
      connectedAt: now,
      lastHeartbeat: now,
      socketId,
    });
    
    // Set TTL on connection (will be refreshed by heartbeats)
    await this.redis.expire(connKey, this.CONNECTION_TTL);
    
    // Add to server's connection set
    await this.redis.sAdd(
      `${this.KEYS.SERVER_CONNECTIONS}${this.serverId}:connections`,
      userId
    );
    
    // Add to space's user set if joining a space
    if (spaceId) {
      await this.redis.sAdd(
        `${this.KEYS.SPACE_USERS}${spaceId}:users`,
        userId
      );
    }
    
    console.log(`[ConnectionRegistry] Registered connection: user=${userId}, server=${this.serverId}, space=${spaceId || 'none'}`);
    return connectionInfo;
  }

  /**
   * Retrieves connection information for a user
   * 
   * @param userId - The user ID to look up
   * @returns Promise resolving to ConnectionInfo or null if not found
   */
  async getConnection(userId: string): Promise<ConnectionInfo | null> {
    const connKey = this.KEYS.CONNECTION + userId;
    const data = await this.redis.hGetAll(connKey);
    
    if (!data || !data.userId) {
      return null;
    }
    
    return {
      userId: data.userId,
      serverId: data.serverId,
      spaceId: data.spaceId || null,
      connectedAt: data.connectedAt,
      lastHeartbeat: data.lastHeartbeat,
      socketId: data.socketId,
      positionX: data.positionX ? parseInt(data.positionX, 10) : undefined,
      positionY: data.positionY ? parseInt(data.positionY, 10) : undefined,
    };
  }

  /**
   * Removes a user's connection from the registry
   * 
   * This method cleans up:
   * - The connection hash
   * - The server's connection set
   * - The space's user set
   * - Any pending reconnection tokens
   * 
   * @param userId - The user ID to remove
   */
  async removeConnection(userId: string): Promise<void> {
    const connKey = this.KEYS.CONNECTION + userId;
    
    // Get current connection info for cleanup
    const conn = await this.getConnection(userId);
    
    if (conn) {
      // Remove from server's connection set
      await this.redis.sRem(
        `${this.KEYS.SERVER_CONNECTIONS}${conn.serverId}:connections`,
        userId
      );
      
      // Remove from space's user set
      if (conn.spaceId) {
        await this.redis.sRem(
          `${this.KEYS.SPACE_USERS}${conn.spaceId}:users`,
          userId
        );
      }
    }
    
    // Remove connection hash
    await this.redis.del(connKey);
    
    // Remove any reconnection token
    await this.redis.del(this.KEYS.RECONNECTION_TOKEN + userId);
    
    console.log(`[ConnectionRegistry] Removed connection for user ${userId}`);
  }

  /**
   * Updates the user's position in their current space
   * 
   * @param userId - The user ID
   * @param x - Grid X coordinate
   * @param y - Grid Y coordinate
   */
  async updatePosition(userId: string, x: number, y: number): Promise<void> {
    const connKey = this.KEYS.CONNECTION + userId;
    
    await this.redis.hSet(connKey, {
      positionX: x.toString(),
      positionY: y.toString(),
    });
  }

  /**
   * Updates the user's current space
   * 
   * @param userId - The user ID
   * @param newSpaceId - The new space ID (or null to leave all spaces)
   * @param oldSpaceId - The previous space ID (optional, for cleanup)
   */
  async updateSpace(
    userId: string,
    newSpaceId: string | null,
    oldSpaceId?: string
  ): Promise<void> {
    const connKey = this.KEYS.CONNECTION + userId;
    
    // Remove from old space
    if (oldSpaceId) {
      await this.redis.sRem(
        `${this.KEYS.SPACE_USERS}${oldSpaceId}:users`,
        userId
      );
    }
    
    // Add to new space
    if (newSpaceId) {
      await this.redis.sAdd(
        `${this.KEYS.SPACE_USERS}${newSpaceId}:users`,
        userId
      );
      await this.redis.hSet(connKey, { spaceId: newSpaceId });
    } else {
      await this.redis.hSet(connKey, { spaceId: '' });
    }
  }

  // ==========================================================================
  // HEARTBEAT & HEALTH
  // ==========================================================================

  /**
   * Updates the heartbeat timestamp for a connection
   * 
   * This should be called periodically (e.g., every 30 seconds) to indicate
   * the connection is still alive. It also refreshes the TTL on the connection.
   * 
   * @param userId - The user ID
   * @returns Promise resolving to true if heartbeat was recorded, false if connection not found
   */
  async heartbeat(userId: string): Promise<boolean> {
    const connKey = this.KEYS.CONNECTION + userId;
    const exists = await this.redis.exists(connKey);
    
    if (!exists) {
      return false;
    }
    
    const now = new Date().toISOString();
    await this.redis.hSet(connKey, { lastHeartbeat: now });
    await this.redis.expire(connKey, this.CONNECTION_TTL);
    
    return true;
  }

  /**
   * Checks if a user is currently connected
   * 
   * @param userId - The user ID to check
   * @returns Promise resolving to true if connected
   */
  async isConnected(userId: string): Promise<boolean> {
    const connKey = this.KEYS.CONNECTION + userId;
    return (await this.redis.exists(connKey)) > 0;
  }

  /**
   * Gets the server ID handling a user's connection
   * 
   * @param userId - The user ID
   * @returns Promise resolving to server ID or null if not connected
   */
  async getServerForUser(userId: string): Promise<string | null> {
    const conn = await this.getConnection(userId);
    return conn?.serverId || null;
  }

  // ==========================================================================
  // RECONNECTION TOKEN MANAGEMENT (BUG-032 FIX)
  // ==========================================================================

  /**
   * Creates a reconnection token for a user
   * 
   * This is used to support page refresh recovery. When a connection is about
   * to be closed gracefully, we store the user's state temporarily so they can
   * reconnect and resume where they left off.
   * 
   * @param userId - The user ID
   * @param options - Token options (TTL, etc.)
   * @returns Promise resolving to the generated token
   */
  async createReconnectionToken(
    userId: string,
    options: ReconnectionTokenOptions = {}
  ): Promise<string> {
    const ttl = options.ttlSeconds || this.RECONNECTION_TOKEN_TTL;
    const token = this.generateToken();
    
    // Get current connection state to store with token
    const conn = await this.getConnection(userId);
    
    const tokenData = {
      token,
      userId,
      spaceId: conn?.spaceId || '',
      positionX: conn?.positionX?.toString() || '0',
      positionY: conn?.positionY?.toString() || '0',
      createdAt: new Date().toISOString(),
    };
    
    const tokenKey = this.KEYS.RECONNECTION_TOKEN + userId;
    await this.redis.hSet(tokenKey, tokenData);
    await this.redis.expire(tokenKey, ttl);
    
    console.log(`[ConnectionRegistry] Created reconnection token for user ${userId}, TTL=${ttl}s`);
    return token;
  }

  /**
   * Validates a reconnection token and returns the stored state
   * 
   * @param userId - The user ID
   * @param token - The token to validate
   * @returns Promise resolving to validation result with stored state
   */
  async validateReconnectionToken(
    userId: string,
    token: string
  ): Promise<ReconnectionValidationResult> {
    const tokenKey = this.KEYS.RECONNECTION_TOKEN + userId;
    const data = await this.redis.hGetAll(tokenKey);
    
    if (!data || !data.token || data.token !== token) {
      return { valid: false };
    }
    
    // Token is valid, clean it up (one-time use)
    await this.redis.del(tokenKey);
    
    return {
      valid: true,
      spaceId: data.spaceId || undefined,
      position: {
        x: parseInt(data.positionX || '0', 10),
        y: parseInt(data.positionY || '0', 10),
      },
    };
  }

  /**
   * Generates a secure random token
   */
  private generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  // ==========================================================================
  // BULK OPERATIONS & QUERIES
  // ==========================================================================

  /**
   * Gets all users currently connected to this server
   * 
   * @returns Promise resolving to array of user IDs
   */
  async getServerConnections(): Promise<string[]> {
    const key = `${this.KEYS.SERVER_CONNECTIONS}${this.serverId}:connections`;
    return await this.redis.sMembers(key);
  }

  /**
   * Gets all users currently in a space
   * 
   * @param spaceId - The space ID
   * @returns Promise resolving to array of user IDs
   */
  async getSpaceUsers(spaceId: string): Promise<string[]> {
    const key = `${this.KEYS.SPACE_USERS}${spaceId}:users`;
    return await this.redis.sMembers(key);
  }

  /**
   * Gets the count of users in a space
   * 
   * @param spaceId - The space ID
   * @returns Promise resolving to user count
   */
  async getSpaceUserCount(spaceId: string): Promise<number> {
    const key = `${this.KEYS.SPACE_USERS}${spaceId}:users`;
    return await this.redis.sCard(key);
  }

  /**
   * Gets detailed connection info for all users in a space
   * 
   * @param spaceId - The space ID
   * @returns Promise resolving to array of ConnectionInfo objects
   */
  async getSpaceUsersWithDetails(spaceId: string): Promise<ConnectionInfo[]> {
    const userIds = await this.getSpaceUsers(spaceId);
    const connections: ConnectionInfo[] = [];
    
    for (const userId of userIds) {
      const conn = await this.getConnection(userId);
      if (conn) {
        connections.push(conn);
      }
    }
    
    return connections;
  }

  /**
   * Cleans up stale connections for this server
   * 
   * This should be called periodically to remove connections that have
   * expired (no heartbeat within CONNECTION_TTL).
   * 
   * @returns Promise resolving to number of connections cleaned up
   */
  async cleanupStaleConnections(): Promise<number> {
    const userIds = await this.getServerConnections();
    let cleanedUp = 0;
    
    for (const userId of userIds) {
      const connKey = this.KEYS.CONNECTION + userId;
      const exists = await this.redis.exists(connKey);
      
      if (!exists) {
        // Connection expired, clean up the server set
        await this.redis.sRem(
          `${this.KEYS.SERVER_CONNECTIONS}${this.serverId}:connections`,
          userId
        );
        cleanedUp++;
      }
    }
    
    if (cleanedUp > 0) {
      console.log(`[ConnectionRegistry] Cleaned up ${cleanedUp} stale connections`);
    }
    
    return cleanedUp;
  }

  /**
   * Removes all connections for this server (used during shutdown)
   * 
   * @returns Promise resolving when cleanup is complete
   */
  async removeAllServerConnections(): Promise<void> {
    const userIds = await this.getServerConnections();
    
    for (const userId of userIds) {
      await this.removeConnection(userId);
    }
    
    // Clear the server's connection set
    await this.redis.del(
      `${this.KEYS.SERVER_CONNECTIONS}${this.serverId}:connections`
    );
    
    console.log(`[ConnectionRegistry] Removed all connections for server ${this.serverId}`);
  }

  // ==========================================================================
  // CONNECTION STATISTICS
  // ==========================================================================

  /**
   * Gets statistics about connections
   */
  async getStats(): Promise<{
    serverConnections: number;
    totalKeys: number;
  }> {
    const serverConnections = await this.redis.sCard(
      `${this.KEYS.SERVER_CONNECTIONS}${this.serverId}:connections`
    );
    
    // Count all connection keys (approximate)
    const keys = await this.redis.keys(`${this.KEYS.CONNECTION}*`);
    
    return {
      serverConnections,
      totalKeys: keys.length,
    };
  }
}

// Export a singleton-friendly factory
export function createConnectionRegistry(
  redis: RedisClientType,
  serverId: string
): ConnectionRegistry {
  return new ConnectionRegistry(redis, serverId);
}

export default ConnectionRegistry;
