import 'dotenv/config';
import { createClient, RedisClientType } from 'redis';

export class RedisService {
    private client: RedisClientType;
    private publisher: RedisClientType;
    private subscriber: RedisClientType;
    private static instance: RedisService;

    private constructor() {
        const redisUrl = process.env.REDIS_URL!;
        
        // Main client for general operations
        this.client = createClient({ url: redisUrl });
        
        // Dedicated publisher for pub/sub
        this.publisher = createClient({ url: redisUrl });
        
        // Dedicated subscriber for pub/sub
        this.subscriber = createClient({ url: redisUrl });
        
        this.setupEventHandlers();
    }

    public static getInstance(): RedisService {
        if (!this.instance) {
            this.instance = new RedisService();
        }
        return this.instance;
    }

    private setupEventHandlers(): void {
        // Main client events
        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('Redis Client Connected');
        });

        // Publisher events
        this.publisher.on('error', (err) => {
            console.error('Redis Publisher Error:', err);
        });

        this.publisher.on('connect', () => {
            console.log('Redis Publisher Connected');
        });

        // Subscriber events
        this.subscriber.on('error', (err) => {
            console.error('Redis Subscriber Error:', err);
        });

        this.subscriber.on('connect', () => {
            console.log('Redis Subscriber Connected');
        });
    }

    public async connect(): Promise<void> {
        try {
            await Promise.all([
                this.client.connect(),
                this.publisher.connect(),
                this.subscriber.connect()
            ]);
            console.log('All Redis connections established');
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            await Promise.all([
                this.client.disconnect(),
                this.publisher.disconnect(),
                this.subscriber.disconnect()
            ]);
            console.log('All Redis connections closed');
        } catch (error) {
            console.error('Error disconnecting from Redis:', error);
        }
    }

    // Publish chat message to Redis channel
    public async publishChatMessage(chatroomId: string, message: any): Promise<void> {
        try {
            const channel = `chatroom:${chatroomId}`;
            const messageData = JSON.stringify({
                ...message,
                timestamp: Date.now()
            });
            
            await this.publisher.publish(channel, messageData);
            console.log(`[REDIS PUB] Published message to channel: ${channel}`);
        } catch (error) {
            console.error('Failed to publish message to Redis:', error);
            throw error;
        }
    }

    // Subscribe to chatroom messages
    public async subscribeToChatroom(chatroomId: string, callback: (message: any) => void): Promise<void> {
        try {
            const channel = `chatroom:${chatroomId}`;
            
            await this.subscriber.subscribe(channel, (message) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    console.log(`[REDIS SUB] Received message from channel: ${channel}`);
                    callback(parsedMessage);
                } catch (error) {
                    console.error('Error parsing Redis message:', error);
                }
            });
            
            console.log(`[REDIS SUB] Subscribed to channel: ${channel}`);
        } catch (error) {
            console.error(`Failed to subscribe to channel: chatroom:${chatroomId}`, error);
            throw error;
        }
    }

    // Unsubscribe from chatroom
    public async unsubscribeFromChatroom(chatroomId: string): Promise<void> {
        try {
            const channel = `chatroom:${chatroomId}`;
            await this.subscriber.unsubscribe(channel);
            console.log(`[REDIS UNSUB] Unsubscribed from channel: ${channel}`);
        } catch (error) {
            console.error(`Failed to unsubscribe from channel: chatroom:${chatroomId}`, error);
        }
    }

    // Store user's active chatrooms in Redis
    public async addUserToChatroom(userId: string, chatroomId: string): Promise<void> {
        try {
            const key = `user:${userId}:chatrooms`;
            await this.client.sAdd(key, chatroomId);
            
            // Set expiration (24 hours)
            await this.client.expire(key, 86400);
            
            console.log(`[REDIS SET] Added user ${userId} to chatroom ${chatroomId}`);
        } catch (error) {
            console.error('Failed to add user to chatroom in Redis:', error);
        }
    }

    // Remove user from chatroom in Redis
    public async removeUserFromChatroom(userId: string, chatroomId: string): Promise<void> {
        try {
            const key = `user:${userId}:chatrooms`;
            await this.client.sRem(key, chatroomId);
            console.log(`[REDIS REM] Removed user ${userId} from chatroom ${chatroomId}`);
        } catch (error) {
            console.error('Failed to remove user from chatroom in Redis:', error);
        }
    }

    // Get user's active chatrooms
    public async getUserChatrooms(userId: string): Promise<string[]> {
        try {
            const key = `user:${userId}:chatrooms`;
            const chatrooms = await this.client.sMembers(key);
            return chatrooms;
        } catch (error) {
            console.error('Failed to get user chatrooms from Redis:', error);
            return [];
        }
    }

    // Store online users in a chatroom
    public async addOnlineUserToChatroom(chatroomId: string, userId: string, username: string): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:online`;
            const userData = JSON.stringify({ userId, username, joinedAt: Date.now() });
            
            await this.client.hSet(key, userId, userData);
            await this.client.expire(key, 3600); // 1 hour expiration
            
            console.log(`[REDIS ONLINE] User ${username} is online in chatroom ${chatroomId}`);
        } catch (error) {
            console.error('Failed to add online user to Redis:', error);
        }
    }

    // Remove online user from chatroom
    public async removeOnlineUserFromChatroom(chatroomId: string, userId: string): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:online`;
            await this.client.hDel(key, userId);
            console.log(`[REDIS OFFLINE] User ${userId} went offline in chatroom ${chatroomId}`);
        } catch (error) {
            console.error('Failed to remove online user from Redis:', error);
        }
    }

    // Get online users in chatroom
    public async getOnlineUsersInChatroom(chatroomId: string): Promise<any[]> {
        try {
            const key = `chatroom:${chatroomId}:online`;
            const users = await this.client.hGetAll(key);
            
            return Object.values(users).map(userData => JSON.parse(userData));
        } catch (error) {
            console.error('Failed to get online users from Redis:', error);
            return [];
        }
    }

    // Cache recent messages (optional - for quick loading)
    public async cacheRecentMessages(chatroomId: string, messages: any[]): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:recent`;
            const messageData = JSON.stringify(messages);
            
            await this.client.setEx(key, 1800, messageData); // 30 minutes cache
            console.log(`[REDIS CACHE] Cached recent messages for chatroom ${chatroomId}`);
        } catch (error) {
            console.error('Failed to cache messages in Redis:', error);
        }
    }

    // Get cached recent messages
    public async getCachedRecentMessages(chatroomId: string): Promise<any[] | null> {
        try {
            const key = `chatroom:${chatroomId}:recent`;
            const cachedData = await this.client.get(key);
            
            if (cachedData) {
                console.log(`[REDIS HIT] Retrieved cached messages for chatroom ${chatroomId}`);
                return JSON.parse(cachedData);
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get cached messages from Redis:', error);
            return null;
        }
    }

    // ============= SPACE/ROOM STATE MANAGEMENT =============
    
    // Save user state in a space (position, username, etc.)
    public async saveUserInSpace(spaceId: string, userId: string, userData: {
        username: string;
        x: number;
        y: number;
        connectionId: string;
    }): Promise<void> {
        try {
            const key = `space:${spaceId}:users`;
            const userDataJson = JSON.stringify({
                ...userData,
                lastUpdated: Date.now()
            });
            
            await this.client.hSet(key, userId, userDataJson);
            // Set expiry to 2 seconds as requested
            await this.client.expire(key, 2);
            
            // Also set individual user expiry with a separate key to avoid losing all users
            const userKey = `user:${spaceId}:${userId}`;
            await this.client.setEx(userKey, 2, userDataJson);
            
            console.log(`[REDIS SPACE] Saved user ${userData.username} in space ${spaceId} at (${userData.x}, ${userData.y}) with 2s expiry`);
        } catch (error) {
            console.error('Failed to save user in space to Redis:', error);
        }
    }

    // Remove user from space
    public async removeUserFromSpace(spaceId: string, userId: string): Promise<void> {
        try {
            const key = `space:${spaceId}:users`;
            await this.client.hDel(key, userId);
            
            // Also remove individual user key
            const userKey = `user:${spaceId}:${userId}`;
            await this.client.del(userKey);
            
            console.log(`[REDIS SPACE] Removed user ${userId} from space ${spaceId}`);
        } catch (error) {
            console.error('Failed to remove user from space in Redis:', error);
        }
    }

    // Get all users in a space
    public async getUsersInSpace(spaceId: string): Promise<Array<{
        userId: string;
        username: string;
        x: number;
        y: number;
        connectionId: string;
        lastUpdated: number;
    }>> {
        try {
            const key = `space:${spaceId}:users`;
            const usersData = await this.client.hGetAll(key);
            
            const users = Object.entries(usersData).map(([userId, dataJson]) => {
                const data = JSON.parse(dataJson);
                return {
                    userId,
                    ...data
                };
            });
            
            console.log(`[REDIS SPACE] Retrieved ${users.length} users from space ${spaceId}`);
            return users;
        } catch (error) {
            console.error('Failed to get users in space from Redis:', error);
            return [];
        }
    }

    // Update user position in space
    public async updateUserPosition(spaceId: string, userId: string, x: number, y: number): Promise<void> {
        try {
            const key = `space:${spaceId}:users`;
            const userDataJson = await this.client.hGet(key, userId);
            
            if (userDataJson) {
                const userData = JSON.parse(userDataJson);
                userData.x = x;
                userData.y = y;
                userData.lastUpdated = Date.now();
                
                const updatedDataJson = JSON.stringify(userData);
                await this.client.hSet(key, userId, updatedDataJson);
                await this.client.expire(key, 2); // 2 second expiry
                
                // Also update individual user key with 2 second expiry
                const userKey = `user:${spaceId}:${userId}`;
                await this.client.setEx(userKey, 2, updatedDataJson);
                
                console.log(`[REDIS SPACE] Updated position for user ${userId} in space ${spaceId} to (${x}, ${y}) with 2s expiry`);
            }
        } catch (error) {
            console.error('Failed to update user position in Redis:', error);
        }
    }

    // Refresh user expiry (heartbeat to keep user alive)
    public async refreshUserExpiry(spaceId: string, userId: string): Promise<void> {
        try {
            const key = `space:${spaceId}:users`;
            const userDataJson = await this.client.hGet(key, userId);
            
            if (userDataJson) {
                const userData = JSON.parse(userDataJson);
                userData.lastUpdated = Date.now();
                
                const updatedDataJson = JSON.stringify(userData);
                await this.client.hSet(key, userId, updatedDataJson);
                await this.client.expire(key, 2); // 2 second expiry
                
                // Also refresh individual user key
                const userKey = `user:${spaceId}:${userId}`;
                await this.client.setEx(userKey, 2, updatedDataJson);
                
                console.log(`[REDIS HEARTBEAT] Refreshed expiry for user ${userId} in space ${spaceId}`);
            }
        } catch (error) {
            console.error('Failed to refresh user expiry in Redis:', error);
        }
    }

    // Clean up stale users (not updated in last 5 minutes)
    public async cleanupStaleUsersInSpace(spaceId: string, maxAgeMs: number = 300000): Promise<number> {
        try {
            const key = `space:${spaceId}:users`;
            const usersData = await this.client.hGetAll(key);
            const now = Date.now();
            let cleanedCount = 0;
            
            for (const [userId, dataJson] of Object.entries(usersData)) {
                const userData = JSON.parse(dataJson);
                if (now - userData.lastUpdated > maxAgeMs) {
                    await this.client.hDel(key, userId);
                    cleanedCount++;
                    console.log(`[REDIS CLEANUP] Removed stale user ${userId} from space ${spaceId}`);
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`[REDIS CLEANUP] Cleaned up ${cleanedCount} stale users from space ${spaceId}`);
            }
            
            return cleanedCount;
        } catch (error) {
            console.error('Failed to cleanup stale users in Redis:', error);
            return 0;
        }
    }

    // Health check
    public async healthCheck(): Promise<{ status: string; latency: number }> {
        try {
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;
            
            return { status: 'healthy', latency };
        } catch (error) {
            return { status: 'unhealthy', latency: -1 };
        }
    }
}