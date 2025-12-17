/**
 * RedisService - Centralized Redis operations for the WebSocket server
 * 
 * PURPOSE:
 * This service manages all Redis operations including:
 * - Chat room pub/sub messaging
 * - User presence tracking
 * - Room state management (BUG-031 fix)
 * - Connection registry for multi-server deployments
 * - Message caching for quick loading
 * 
 * ARCHITECTURE:
 * - Main client: General Redis operations (get, set, etc.)
 * - Publisher: Dedicated for publishing messages (non-blocking)
 * - Subscriber: Dedicated for subscriptions (blocking listener)
 * 
 * DATA STRUCTURES:
 * - user:{userId}:chatrooms -> Set of chatroom IDs
 * - chatroom:{chatroomId}:online -> Hash of online users
 * - chatroom:{chatroomId}:recent -> Cached recent messages
 * - space:{spaceId}:users -> Hash of users with positions
 * - space:{spaceId}:state -> Hash of space metadata
 * - conn:{userId} -> Hash of connection info
 * 
 * @author GitHub Copilot
 * @see docs/bugs/scalability/BUG-031-room-state-not-synced.md
 */

import 'dotenv/config';
import { createClient, RedisClientType } from 'redis';

/**
 * User position data stored in Redis
 */
interface UserPositionData {
    userId: string;
    username: string;
    x: number;
    y: number;
    lastUpdate: number;
    serverId?: string;
}

/**
 * Space state stored in Redis
 */
interface SpaceState {
    spaceId: string;
    userCount: number;
    lastActivity: number;
    serverId: string;
}

export class RedisService {
    private client: RedisClientType;
    private publisher: RedisClientType;
    private subscriber: RedisClientType;
    private static instance: RedisService;
    
    /** Server ID for multi-server identification */
    private serverId: string;
    
    /** TTL for user position data (5 minutes) */
    private readonly USER_POSITION_TTL = 300;
    
    /** TTL for space state (1 hour) */
    private readonly SPACE_STATE_TTL = 3600;

    private constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        
        // Generate unique server ID for this instance
        this.serverId = `ws-${process.pid}-${Date.now()}`;
        
        // Main client for general operations
        this.client = createClient({ url: redisUrl });
        
        // Dedicated publisher for pub/sub (non-blocking)
        this.publisher = createClient({ url: redisUrl });
        
        // Dedicated subscriber for pub/sub (has blocking listener)
        this.subscriber = createClient({ url: redisUrl });
        
        this.setupEventHandlers();
    }

    public static getInstance(): RedisService {
        if (!this.instance) {
            this.instance = new RedisService();
        }
        return this.instance;
    }
    
    /**
     * Get the server ID for this instance
     */
    public getServerId(): string {
        return this.serverId;
    }

    private setupEventHandlers(): void {
        // Main client events
        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('✅ Redis Client Connected');
        });

        // Publisher events
        this.publisher.on('error', (err) => {
            console.error('❌ Redis Publisher Error:', err);
        });

        this.publisher.on('connect', () => {
            console.log('✅ Redis Publisher Connected');
        });

        // Subscriber events
        this.subscriber.on('error', (err) => {
            console.error('❌ Redis Subscriber Error:', err);
        });

        this.subscriber.on('connect', () => {
            console.log('✅ Redis Subscriber Connected');
        });
    }

    public async connect(): Promise<void> {
        try {
            await Promise.all([
                this.client.connect(),
                this.publisher.connect(),
                this.subscriber.connect()
            ]);
            console.log('✅ All Redis connections established');
            console.log(`📍 Server ID: ${this.serverId}`);
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            // Clean up server-specific data before disconnect
            await this.cleanupServerData();
            
            await Promise.all([
                this.client.disconnect(),
                this.publisher.disconnect(),
                this.subscriber.disconnect()
            ]);
            console.log('✅ All Redis connections closed');
        } catch (error) {
            console.error('❌ Error disconnecting from Redis:', error);
        }
    }

    // ==========================================================================
    // CHAT ROOM OPERATIONS
    // ==========================================================================

    /**
     * Publish chat message to Redis channel for real-time distribution
     */
    public async publishChatMessage(chatroomId: string, message: any): Promise<void> {
        try {
            const channel = `chatroom:${chatroomId}`;
            const messageData = JSON.stringify({
                ...message,
                timestamp: Date.now()
            });
            
            await this.publisher.publish(channel, messageData);
            console.log(`📤 [REDIS PUB] Published message to channel: ${channel}`);
        } catch (error) {
            console.error('❌ Failed to publish message to Redis:', error);
            throw error;
        }
    }

    /**
     * Subscribe to chatroom messages for real-time updates
     */
    public async subscribeToChatroom(chatroomId: string, callback: (message: any) => void): Promise<void> {
        try {
            const channel = `chatroom:${chatroomId}`;
            
            await this.subscriber.subscribe(channel, (message) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    console.log(`📥 [REDIS SUB] Received message from channel: ${channel}`);
                    callback(parsedMessage);
                } catch (error) {
                    console.error('❌ Error parsing Redis message:', error);
                }
            });
            
            console.log(`✅ [REDIS SUB] Subscribed to channel: ${channel}`);
        } catch (error) {
            console.error(`❌ Failed to subscribe to channel: chatroom:${chatroomId}`, error);
            throw error;
        }
    }

    /**
     * Unsubscribe from chatroom
     */
    public async unsubscribeFromChatroom(chatroomId: string): Promise<void> {
        try {
            const channel = `chatroom:${chatroomId}`;
            await this.subscriber.unsubscribe(channel);
            console.log(`✅ [REDIS UNSUB] Unsubscribed from channel: ${channel}`);
        } catch (error) {
            console.error(`❌ Failed to unsubscribe from channel: chatroom:${chatroomId}`, error);
        }
    }

    // ==========================================================================
    // USER CHATROOM MEMBERSHIP
    // ==========================================================================

    /**
     * Add user to a chatroom set
     */
    public async addUserToChatroom(userId: string, chatroomId: string): Promise<void> {
        try {
            const key = `user:${userId}:chatrooms`;
            await this.client.sAdd(key, chatroomId);
            await this.client.expire(key, 86400); // 24 hours
            
            console.log(`✅ [REDIS SET] Added user ${userId} to chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to add user to chatroom in Redis:', error);
        }
    }

    /**
     * Remove user from a chatroom set
     */
    public async removeUserFromChatroom(userId: string, chatroomId: string): Promise<void> {
        try {
            const key = `user:${userId}:chatrooms`;
            await this.client.sRem(key, chatroomId);
            console.log(`✅ [REDIS REM] Removed user ${userId} from chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to remove user from chatroom in Redis:', error);
        }
    }

    /**
     * Get all chatrooms a user is in
     */
    public async getUserChatrooms(userId: string): Promise<string[]> {
        try {
            const key = `user:${userId}:chatrooms`;
            return await this.client.sMembers(key);
        } catch (error) {
            console.error('❌ Failed to get user chatrooms from Redis:', error);
            return [];
        }
    }

    // ==========================================================================
    // ONLINE USER TRACKING
    // ==========================================================================

    /**
     * Add online user to chatroom
     */
    public async addOnlineUserToChatroom(chatroomId: string, userId: string, username: string): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:online`;
            const userData = JSON.stringify({ 
                userId, 
                username, 
                joinedAt: Date.now(),
                serverId: this.serverId 
            });
            
            await this.client.hSet(key, userId, userData);
            await this.client.expire(key, 3600); // 1 hour
            
            console.log(`✅ [REDIS ONLINE] User ${username} is online in chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to add online user to Redis:', error);
        }
    }

    /**
     * Remove online user from chatroom
     */
    public async removeOnlineUserFromChatroom(chatroomId: string, userId: string): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:online`;
            await this.client.hDel(key, userId);
            console.log(`✅ [REDIS OFFLINE] User ${userId} went offline in chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to remove online user from Redis:', error);
        }
    }

    /**
     * Get all online users in chatroom
     */
    public async getOnlineUsersInChatroom(chatroomId: string): Promise<any[]> {
        try {
            const key = `chatroom:${chatroomId}:online`;
            const users = await this.client.hGetAll(key);
            
            return Object.values(users).map(userData => JSON.parse(userData));
        } catch (error) {
            console.error('❌ Failed to get online users from Redis:', error);
            return [];
        }
    }

    // ==========================================================================
    // SPACE/ROOM STATE MANAGEMENT (BUG-031 FIX)
    // ==========================================================================

    /**
     * Add user to a space with position tracking
     * This enables multi-server synchronization
     */
    public async addUserToSpace(
        spaceId: string, 
        userId: string, 
        username: string, 
        x: number, 
        y: number
    ): Promise<void> {
        try {
            const key = `space:${spaceId}:users`;
            const userData: UserPositionData = {
                userId,
                username,
                x,
                y,
                lastUpdate: Date.now(),
                serverId: this.serverId
            };
            
            await this.client.hSet(key, userId, JSON.stringify(userData));
            await this.client.expire(key, this.USER_POSITION_TTL);
            
            // Update space state
            await this.updateSpaceState(spaceId);
            
            // Publish user joined event for cross-server notification
            await this.publishSpaceEvent(spaceId, 'user-joined', {
                userId,
                username,
                x,
                y,
                serverId: this.serverId
            });
            
            console.log(`✅ [REDIS SPACE] User ${username} added to space ${spaceId} at (${x}, ${y})`);
        } catch (error) {
            console.error('❌ Failed to add user to space in Redis:', error);
        }
    }

    /**
     * Update user position in a space
     */
    public async updateUserPosition(
        spaceId: string, 
        userId: string, 
        x: number, 
        y: number
    ): Promise<void> {
        try {
            const key = `space:${spaceId}:users`;
            const existingData = await this.client.hGet(key, userId);
            
            if (existingData) {
                const userData: UserPositionData = JSON.parse(existingData);
                userData.x = x;
                userData.y = y;
                userData.lastUpdate = Date.now();
                
                await this.client.hSet(key, userId, JSON.stringify(userData));
                await this.client.expire(key, this.USER_POSITION_TTL);
                
                // Publish position update for cross-server sync
                await this.publishSpaceEvent(spaceId, 'user-moved', {
                    userId,
                    x,
                    y,
                    serverId: this.serverId
                });
            }
        } catch (error) {
            console.error('❌ Failed to update user position in Redis:', error);
        }
    }

    /**
     * Remove user from a space
     */
    public async removeUserFromSpace(spaceId: string, userId: string): Promise<void> {
        try {
            const key = `space:${spaceId}:users`;
            
            // Get user data before removing
            const existingData = await this.client.hGet(key, userId);
            
            await this.client.hDel(key, userId);
            
            // Update space state
            await this.updateSpaceState(spaceId);
            
            // Publish user left event
            if (existingData) {
                const userData = JSON.parse(existingData);
                await this.publishSpaceEvent(spaceId, 'user-left', {
                    userId,
                    username: userData.username,
                    serverId: this.serverId
                });
            }
            
            console.log(`✅ [REDIS SPACE] User ${userId} removed from space ${spaceId}`);
        } catch (error) {
            console.error('❌ Failed to remove user from space in Redis:', error);
        }
    }

    /**
     * Get all users in a space with their positions
     */
    public async getSpaceUsers(spaceId: string): Promise<UserPositionData[]> {
        try {
            const key = `space:${spaceId}:users`;
            const users = await this.client.hGetAll(key);
            
            return Object.values(users).map(userData => JSON.parse(userData));
        } catch (error) {
            console.error('❌ Failed to get space users from Redis:', error);
            return [];
        }
    }

    /**
     * Get user count in a space
     */
    public async getSpaceUserCount(spaceId: string): Promise<number> {
        try {
            const key = `space:${spaceId}:users`;
            return await this.client.hLen(key);
        } catch (error) {
            console.error('❌ Failed to get space user count:', error);
            return 0;
        }
    }

    /**
     * Update space metadata
     */
    private async updateSpaceState(spaceId: string): Promise<void> {
        try {
            const userCount = await this.getSpaceUserCount(spaceId);
            const state: SpaceState = {
                spaceId,
                userCount,
                lastActivity: Date.now(),
                serverId: this.serverId
            };
            
            const key = `space:${spaceId}:state`;
            // Convert SpaceState to Record<string, string> for Redis hSet
            const redisState: Record<string, string> = {
                spaceId: state.spaceId,
                userCount: String(state.userCount),
                lastActivity: String(state.lastActivity),
                serverId: state.serverId
            };
            await this.client.hSet(key, redisState);
            await this.client.expire(key, this.SPACE_STATE_TTL);
        } catch (error) {
            console.error('❌ Failed to update space state:', error);
        }
    }

    /**
     * Publish space event for cross-server synchronization
     */
    private async publishSpaceEvent(
        spaceId: string, 
        eventType: string, 
        data: any
    ): Promise<void> {
        try {
            const channel = `space:${spaceId}:events`;
            const event = JSON.stringify({
                type: eventType,
                data,
                timestamp: Date.now(),
                originServerId: this.serverId
            });
            
            await this.publisher.publish(channel, event);
        } catch (error) {
            console.error('❌ Failed to publish space event:', error);
        }
    }

    /**
     * Subscribe to space events for cross-server sync
     */
    public async subscribeToSpaceEvents(
        spaceId: string, 
        callback: (event: { type: string; data: any; originServerId: string }) => void
    ): Promise<void> {
        try {
            const channel = `space:${spaceId}:events`;
            
            await this.subscriber.subscribe(channel, (message) => {
                try {
                    const event = JSON.parse(message);
                    
                    // Only process events from other servers
                    if (event.originServerId !== this.serverId) {
                        callback(event);
                    }
                } catch (error) {
                    console.error('❌ Error parsing space event:', error);
                }
            });
            
            console.log(`✅ [REDIS SUB] Subscribed to space events: ${spaceId}`);
        } catch (error) {
            console.error(`❌ Failed to subscribe to space events: ${spaceId}`, error);
        }
    }

    /**
     * Unsubscribe from space events
     */
    public async unsubscribeFromSpaceEvents(spaceId: string): Promise<void> {
        try {
            const channel = `space:${spaceId}:events`;
            await this.subscriber.unsubscribe(channel);
            console.log(`✅ [REDIS UNSUB] Unsubscribed from space events: ${spaceId}`);
        } catch (error) {
            console.error(`❌ Failed to unsubscribe from space events: ${spaceId}`, error);
        }
    }

    // ==========================================================================
    // MESSAGE CACHING
    // ==========================================================================

    /**
     * Cache recent messages for quick loading
     */
    public async cacheRecentMessages(chatroomId: string, messages: any[]): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:recent`;
            const messageData = JSON.stringify(messages);
            
            await this.client.setEx(key, 1800, messageData); // 30 minutes cache
            console.log(`✅ [REDIS CACHE] Cached recent messages for chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to cache messages in Redis:', error);
        }
    }

    /**
     * Get cached recent messages
     */
    public async getCachedRecentMessages(chatroomId: string): Promise<any[] | null> {
        try {
            const key = `chatroom:${chatroomId}:recent`;
            const cachedData = await this.client.get(key);
            
            if (cachedData) {
                console.log(`✅ [REDIS HIT] Retrieved cached messages for chatroom ${chatroomId}`);
                return JSON.parse(cachedData);
            }
            
            return null;
        } catch (error) {
            console.error('❌ Failed to get cached messages from Redis:', error);
            return null;
        }
    }

    // ==========================================================================
    // CLEANUP & HEALTH
    // ==========================================================================

    /**
     * Clean up data for this server instance (called on shutdown)
     */
    private async cleanupServerData(): Promise<void> {
        try {
            // Get all keys for this server's users
            const pattern = `space:*:users`;
            const keys = await this.client.keys(pattern);
            
            for (const key of keys) {
                const users = await this.client.hGetAll(key);
                
                for (const [userId, userData] of Object.entries(users)) {
                    const data = JSON.parse(userData);
                    if (data.serverId === this.serverId) {
                        await this.client.hDel(key, userId);
                        console.log(`🧹 Cleaned up user ${userId} from ${key}`);
                    }
                }
            }
            
            console.log(`✅ Server ${this.serverId} data cleaned up`);
        } catch (error) {
            console.error('❌ Failed to cleanup server data:', error);
        }
    }

    /**
     * Clean up stale users (no update in last 5 minutes)
     */
    public async cleanupStaleUsers(): Promise<number> {
        try {
            const staleThreshold = Date.now() - (this.USER_POSITION_TTL * 1000);
            let cleanedCount = 0;
            
            const pattern = `space:*:users`;
            const keys = await this.client.keys(pattern);
            
            for (const key of keys) {
                const users = await this.client.hGetAll(key);
                
                for (const [userId, userData] of Object.entries(users)) {
                    const data = JSON.parse(userData);
                    if (data.lastUpdate < staleThreshold) {
                        await this.client.hDel(key, userId);
                        cleanedCount++;
                    }
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} stale users`);
            }
            
            return cleanedCount;
        } catch (error) {
            console.error('❌ Failed to cleanup stale users:', error);
            return 0;
        }
    }

    /**
     * Health check
     */
    public async healthCheck(): Promise<{ status: string; latency: number; serverId: string }> {
        try {
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;
            
            return { status: 'healthy', latency, serverId: this.serverId };
        } catch (error) {
            return { status: 'unhealthy', latency: -1, serverId: this.serverId };
        }
    }
}