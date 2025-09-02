import 'dotenv/config';
import { createClient, RedisClientType } from 'redis';

export class RedisService {
    private client: RedisClientType;
    private publisher: RedisClientType;
    private subscriber: RedisClientType;
    private static instance: RedisService;

    private constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        
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
            console.error('❌ Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('🔗 Redis Client Connected');
        });

        // Publisher events
        this.publisher.on('error', (err) => {
            console.error('❌ Redis Publisher Error:', err);
        });

        this.publisher.on('connect', () => {
            console.log('📤 Redis Publisher Connected');
        });

        // Subscriber events
        this.subscriber.on('error', (err) => {
            console.error('❌ Redis Subscriber Error:', err);
        });

        this.subscriber.on('connect', () => {
            console.log('📥 Redis Subscriber Connected');
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
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
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
            console.log('🔌 All Redis connections closed');
        } catch (error) {
            console.error('❌ Error disconnecting from Redis:', error);
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
            console.log(`📡 [REDIS PUB] Published message to channel: ${channel}`);
        } catch (error) {
            console.error('❌ Failed to publish message to Redis:', error);
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
                    console.log(`📥 [REDIS SUB] Received message from channel: ${channel}`);
                    callback(parsedMessage);
                } catch (error) {
                    console.error('❌ Error parsing Redis message:', error);
                }
            });
            
            console.log(`🎧 [REDIS SUB] Subscribed to channel: ${channel}`);
        } catch (error) {
            console.error(`❌ Failed to subscribe to channel: chatroom:${chatroomId}`, error);
            throw error;
        }
    }

    // Unsubscribe from chatroom
    public async unsubscribeFromChatroom(chatroomId: string): Promise<void> {
        try {
            const channel = `chatroom:${chatroomId}`;
            await this.subscriber.unsubscribe(channel);
            console.log(`🔇 [REDIS UNSUB] Unsubscribed from channel: ${channel}`);
        } catch (error) {
            console.error(`❌ Failed to unsubscribe from channel: chatroom:${chatroomId}`, error);
        }
    }

    // Store user's active chatrooms in Redis
    public async addUserToChatroom(userId: string, chatroomId: string): Promise<void> {
        try {
            const key = `user:${userId}:chatrooms`;
            await this.client.sAdd(key, chatroomId);
            
            // Set expiration (24 hours)
            await this.client.expire(key, 86400);
            
            console.log(`👤 [REDIS SET] Added user ${userId} to chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to add user to chatroom in Redis:', error);
        }
    }

    // Remove user from chatroom in Redis
    public async removeUserFromChatroom(userId: string, chatroomId: string): Promise<void> {
        try {
            const key = `user:${userId}:chatrooms`;
            await this.client.sRem(key, chatroomId);
            console.log(`👤 [REDIS REM] Removed user ${userId} from chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to remove user from chatroom in Redis:', error);
        }
    }

    // Get user's active chatrooms
    public async getUserChatrooms(userId: string): Promise<string[]> {
        try {
            const key = `user:${userId}:chatrooms`;
            const chatrooms = await this.client.sMembers(key);
            return chatrooms;
        } catch (error) {
            console.error('❌ Failed to get user chatrooms from Redis:', error);
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
            
            console.log(`🟢 [REDIS ONLINE] User ${username} is online in chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to add online user to Redis:', error);
        }
    }

    // Remove online user from chatroom
    public async removeOnlineUserFromChatroom(chatroomId: string, userId: string): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:online`;
            await this.client.hDel(key, userId);
            console.log(`🔴 [REDIS OFFLINE] User ${userId} went offline in chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to remove online user from Redis:', error);
        }
    }

    // Get online users in chatroom
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

    // Cache recent messages (optional - for quick loading)
    public async cacheRecentMessages(chatroomId: string, messages: any[]): Promise<void> {
        try {
            const key = `chatroom:${chatroomId}:recent`;
            const messageData = JSON.stringify(messages);
            
            await this.client.setEx(key, 1800, messageData); // 30 minutes cache
            console.log(`💾 [REDIS CACHE] Cached recent messages for chatroom ${chatroomId}`);
        } catch (error) {
            console.error('❌ Failed to cache messages in Redis:', error);
        }
    }

    // Get cached recent messages
    public async getCachedRecentMessages(chatroomId: string): Promise<any[] | null> {
        try {
            const key = `chatroom:${chatroomId}:recent`;
            const cachedData = await this.client.get(key);
            
            if (cachedData) {
                console.log(`💾 [REDIS HIT] Retrieved cached messages for chatroom ${chatroomId}`);
                return JSON.parse(cachedData);
            }
            
            return null;
        } catch (error) {
            console.error('❌ Failed to get cached messages from Redis:', error);
            return null;
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