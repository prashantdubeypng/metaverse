/**
 * RoomManager - Centralized room/space management for WebSocket server
 * 
 * PURPOSE:
 * Manages user-to-room mappings, handles broadcasting, and now integrates
 * with Redis for cross-server state synchronization (BUG-031 fix).
 * 
 * ARCHITECTURE:
 * - In-memory Map for fast local lookups
 * - Redis integration for cross-server sync
 * - Automatic cleanup of disconnected users
 * - Connection registry integration
 * 
 * PATTERNS:
 * - Singleton pattern for global access
 * - Observer pattern for broadcasting
 * - Dual-storage (local + Redis) for performance + consistency
 * 
 * @author GitHub Copilot
 * @see docs/bugs/scalability/BUG-031-room-state-not-synced.md
 */

import { User } from "./User";
import { outgoingmessage, UserPosition } from "./types";
import { RedisService } from "./RedisService";

export class Roommanager {
    /**
     * In-memory room storage: spaceId -> User[]
     * Used for fast local access and broadcasting
     */
    rooms: Map<string, User[]> = new Map();
    
    /**
     * Singleton instance
     */
    static instance: Roommanager;
    
    /**
     * Redis service for cross-server synchronization
     */
    private redisService: RedisService | null = null;
    
    /**
     * Whether Redis integration is enabled
     */
    private redisEnabled: boolean = false;
    
    /**
     * Cleanup interval ID
     */
    private cleanupIntervalId: NodeJS.Timeout | null = null;

    private constructor() {
        this.rooms = new Map();
        this.initializeRedis();
        this.startPeriodicCleanup();
    }

    /**
     * Get singleton instance of RoomManager
     */
    static getInstance(): Roommanager {
        if (!this.instance) {
            this.instance = new Roommanager();
        }
        return this.instance;
    }
    
    /**
     * Initialize Redis service for cross-server sync
     * Gracefully handles Redis unavailability
     */
    private async initializeRedis(): Promise<void> {
        try {
            this.redisService = RedisService.getInstance();
            this.redisEnabled = true;
            console.log('✅ [RoomManager] Redis integration enabled');
        } catch (error) {
            console.warn('⚠️ [RoomManager] Redis not available, running in local-only mode');
            this.redisEnabled = false;
        }
    }
    
    /**
     * Start periodic cleanup of disconnected users
     * Runs every 30 seconds to clean stale connections
     */
    private startPeriodicCleanup(): void {
        this.cleanupIntervalId = setInterval(() => {
            this.cleanupDisconnectedUsers();
            
            // Also cleanup Redis if available
            if (this.redisEnabled && this.redisService) {
                this.redisService.cleanupStaleUsers().catch(err => {
                    console.error('❌ Redis cleanup failed:', err);
                });
            }
        }, 30000); // 30 seconds
        
        console.log('🔄 [RoomManager] Started periodic cleanup (30s interval)');
    }

    /**
     * Add user to a space
     * Updates both local storage and Redis for cross-server sync
     * 
     * @param spaceId - The space to add user to
     * @param user - The user to add
     */
    public async addUser(spaceId: string, user: User): Promise<void> {
        // Initialize room if it doesn't exist
        if (!this.rooms.has(spaceId)) {
            this.rooms.set(spaceId, []);
            
            // Subscribe to Redis space events for cross-server sync
            if (this.redisEnabled && this.redisService) {
                await this.subscribeToSpaceEvents(spaceId);
            }
        }
        
        // Check if user is already in the room (prevent duplicates)
        const existingUsers = this.rooms.get(spaceId)!;
        const existingUser = existingUsers.find(u => u.id === user.id);
        
        if (!existingUser) {
            // Add to local storage
            this.rooms.set(spaceId, [...existingUsers, user]);
            console.log(`✅ [RoomManager] Added user ${user.id} to space ${spaceId}. Total users: ${existingUsers.length + 1}`);
            
            // Sync to Redis for cross-server visibility
            if (this.redisEnabled && this.redisService) {
                const position = user.getPosition();
                if (position) {
                    await this.redisService.addUserToSpace(
                        spaceId, 
                        user.id, 
                        position.username,
                        position.x,
                        position.y
                    );
                }
            }
        } else {
            console.log(`⚠️ [RoomManager] User ${user.id} already in space ${spaceId}`);
        }
    }

    /**
     * Remove user from a space
     * Updates both local storage and Redis
     * 
     * @param user - The user to remove
     * @param spaceId - The space to remove from
     */
    public async removeUser(user: User, spaceId: string): Promise<void> {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        
        // Remove from local storage
        const filteredUsers = this.rooms.get(spaceId)?.filter(u => u.id !== user.id) ?? [];
        this.rooms.set(spaceId, filteredUsers);
        
        // Remove from Redis
        if (this.redisEnabled && this.redisService) {
            await this.redisService.removeUserFromSpace(spaceId, user.id);
        }
        
        // Clean up empty rooms
        if (filteredUsers.length === 0) {
            this.rooms.delete(spaceId);
            
            // Unsubscribe from Redis events
            if (this.redisEnabled && this.redisService) {
                await this.redisService.unsubscribeFromSpaceEvents(spaceId);
            }
            
            console.log(`🗑️ [RoomManager] Removed empty space ${spaceId}`);
        } else {
            console.log(`✅ [RoomManager] Removed user ${user.id} from space ${spaceId}. Remaining users: ${filteredUsers.length}`);
        }
    }
    
    /**
     * Update user position
     * Syncs to Redis for cross-server visibility
     * 
     * @param spaceId - The space the user is in
     * @param userId - The user ID
     * @param x - New X coordinate (grid)
     * @param y - New Y coordinate (grid)
     */
    public async updateUserPosition(spaceId: string, userId: string, x: number, y: number): Promise<void> {
        // Sync to Redis for cross-server visibility
        if (this.redisEnabled && this.redisService) {
            await this.redisService.updateUserPosition(spaceId, userId, x, y);
        }
    }

    /**
     * Broadcast message to all users in a space (except sender)
     * 
     * @param message - The message to broadcast
     * @param excludeUser - User to exclude (usually the sender)
     * @param spaceId - The space to broadcast in
     */
    public broadCast(message: outgoingmessage, excludeUser: User, spaceId: string): void {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        
        const users = this.rooms.get(spaceId)!;
        let broadcastCount = 0;
        let failedCount = 0;
        
        users.forEach(user => {
            if (user.id !== excludeUser.id && user.isConnected()) {
                try {
                    user.send(message);
                    broadcastCount++;
                } catch (error) {
                    failedCount++;
                    console.error(`❌ Failed to send to user ${user.id}:`, error);
                }
            }
        });
        
        console.log(`📡 [RoomManager] Broadcasted ${message.type} to ${broadcastCount} users in space ${spaceId}${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
    }
    
    /**
     * Broadcast to all users in a space (including sender)
     * Useful for position sync and state updates
     * 
     * @param message - The message to broadcast
     * @param spaceId - The space to broadcast in
     */
    public broadCastToAll(message: outgoingmessage, spaceId: string): void {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        
        const users = this.rooms.get(spaceId)!;
        let count = 0;
        
        users.forEach(user => {
            if (user.isConnected()) {
                try {
                    user.send(message);
                    count++;
                } catch (error) {
                    console.error(`❌ Failed to send to user ${user.id}:`, error);
                }
            }
        });
        
        console.log(`📡 [RoomManager] Broadcasted ${message.type} to all ${count} users in space ${spaceId}`);
    }

    /**
     * Get all users in a space (local only)
     */
    public getSpaceUsers(spaceId: string): User[] {
        return this.rooms.get(spaceId) ?? [];
    }
    
    /**
     * Get all users in a space with positions
     * Returns simplified data for broadcasting
     */
    public getSpaceUsersWithPositions(spaceId: string): UserPosition[] {
        const users = this.rooms.get(spaceId) ?? [];
        return users
            .map(user => {
                const position = user.getPosition();
                if (position) {
                    return {
                        userId: user.getUserId() || user.id,
                        username: position.username,
                        x: position.x,
                        y: position.y
                    };
                }
                return null;
            })
            .filter((pos): pos is UserPosition => pos !== null);
    }
    
    /**
     * Get users from Redis (for cross-server visibility)
     * Includes users from all servers
     */
    public async getSpaceUsersFromRedis(spaceId: string): Promise<UserPosition[]> {
        if (!this.redisEnabled || !this.redisService) {
            return this.getSpaceUsersWithPositions(spaceId);
        }
        
        try {
            const redisUsers = await this.redisService.getSpaceUsers(spaceId);
            return redisUsers.map(u => ({
                userId: u.userId,
                username: u.username,
                x: u.x,
                y: u.y
            }));
        } catch (error) {
            console.error('❌ Failed to get users from Redis:', error);
            return this.getSpaceUsersWithPositions(spaceId);
        }
    }

    /**
     * Get all User objects in a space
     * BUG-029 FIX: Used for state refresh requests
     * 
     * @param spaceId - The space to get users from
     * @returns Array of User objects in the space
     */
    public getUsersInSpace(spaceId: string): User[] {
        return this.rooms.get(spaceId) || [];
    }

    /**
     * Get user count in a space (local only)
     */
    public getUserCount(spaceId: string): number {
        return this.rooms.get(spaceId)?.length ?? 0;
    }
    
    /**
     * Get user count from Redis (all servers)
     */
    public async getUserCountFromRedis(spaceId: string): Promise<number> {
        if (!this.redisEnabled || !this.redisService) {
            return this.getUserCount(spaceId);
        }
        
        try {
            return await this.redisService.getSpaceUserCount(spaceId);
        } catch (error) {
            return this.getUserCount(spaceId);
        }
    }

    /**
     * Get all space IDs
     */
    public getAllSpaces(): string[] {
        return Array.from(this.rooms.keys());
    }

    /**
     * Get total user count across all spaces
     */
    public getTotalUsers(): number {
        let total = 0;
        this.rooms.forEach(users => {
            total += users.length;
        });
        return total;
    }

    /**
     * Get comprehensive stats for monitoring
     */
    public getStats(): { 
        totalSpaces: number; 
        totalUsers: number; 
        spacesWithUsers: Array<{ spaceId: string; userCount: number }>;
        redisEnabled: boolean;
        serverId?: string;
    } {
        const spacesWithUsers = Array.from(this.rooms.entries()).map(([spaceId, users]) => ({
            spaceId,
            userCount: users.length
        }));

        return {
            totalSpaces: this.rooms.size,
            totalUsers: this.getTotalUsers(),
            spacesWithUsers,
            redisEnabled: this.redisEnabled,
            serverId: this.redisService?.getServerId()
        };
    }

    /**
     * Clean up disconnected users from all rooms
     * Called periodically to prevent memory leaks
     * 
     * BUG-021 FIX: Enhanced cleanup with broadcast to remaining users
     * When ghost users are detected and removed, remaining users are
     * notified via 'user-left' message so their UI updates immediately.
     */
    public cleanupDisconnectedUsers(): void {
        let cleanedCount = 0;
        const roomsToDelete: string[] = [];
        
        this.rooms.forEach((users, spaceId) => {
            const connectedUsers = users.filter(user => user.isConnected());
            const disconnectedUsers = users.filter(user => !user.isConnected());
            
            if (disconnectedUsers.length > 0) {
                cleanedCount += disconnectedUsers.length;
                
                if (connectedUsers.length === 0) {
                    roomsToDelete.push(spaceId);
                } else {
                    this.rooms.set(spaceId, connectedUsers);
                    
                    // BUG-021: Broadcast user-left to all remaining connected users
                    for (const disconnectedUser of disconnectedUsers) {
                        const userId = disconnectedUser.getUserId();
                        console.log(`👻 [BUG-021] Removing ghost user ${userId} from space ${spaceId}`);
                        
                        // Notify remaining users that this user has left
                        for (const connectedUser of connectedUsers) {
                            connectedUser.send({
                                type: 'user-left',
                                payload: {
                                    userId: userId,
                                    reason: 'ghost-cleanup',
                                    timestamp: Date.now()
                                }
                            });
                        }
                    }
                }
                
                // Remove from Redis as well
                if (this.redisEnabled && this.redisService) {
                    disconnectedUsers.forEach(user => {
                        this.redisService!.removeUserFromSpace(spaceId, user.id).catch(err => {
                            console.error(`❌ Failed to remove user ${user.id} from Redis:`, err);
                        });
                    });
                }
            }
        });
        
        // Delete empty rooms
        roomsToDelete.forEach(spaceId => {
            this.rooms.delete(spaceId);
            
            if (this.redisEnabled && this.redisService) {
                this.redisService.unsubscribeFromSpaceEvents(spaceId).catch(err => {
                    console.error(`❌ Failed to unsubscribe from space ${spaceId}:`, err);
                });
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`🧹 [BUG-021] Cleaned up ${cleanedCount} ghost users from ${roomsToDelete.length} empty rooms`);
        }
    }
    
    /**
     * Subscribe to Redis space events for cross-server sync
     */
    private async subscribeToSpaceEvents(spaceId: string): Promise<void> {
        if (!this.redisEnabled || !this.redisService) {
            return;
        }
        
        try {
            await this.redisService.subscribeToSpaceEvents(spaceId, (event) => {
                this.handleRedisSpaceEvent(spaceId, event);
            });
        } catch (error) {
            console.error(`❌ Failed to subscribe to space events for ${spaceId}:`, error);
        }
    }
    
    /**
     * Handle incoming Redis space events (from other servers)
     * Updates local state and broadcasts to local users
     */
    private handleRedisSpaceEvent(
        spaceId: string, 
        event: { type: string; data: any; originServerId: string }
    ): void {
        console.log(`📥 [RoomManager] Received Redis event: ${event.type} from server ${event.originServerId}`);
        
        switch (event.type) {
            case 'user-joined':
                // Broadcast to local users that someone joined on another server
                this.broadCastToAll({
                    type: 'user-joined',
                    payload: {
                        userId: event.data.userId,
                        username: event.data.username,
                        x: event.data.x,
                        y: event.data.y,
                        serverId: event.data.serverId
                    }
                }, spaceId);
                break;
                
            case 'user-moved':
                // Broadcast position update from another server
                this.broadCastToAll({
                    type: 'movement',
                    payload: {
                        userId: event.data.userId,
                        x: event.data.x,
                        y: event.data.y
                    }
                }, spaceId);
                break;
                
            case 'user-left':
                // Broadcast that user left from another server
                this.broadCastToAll({
                    type: 'user-left',
                    payload: {
                        userId: event.data.userId,
                        username: event.data.username
                    }
                }, spaceId);
                break;
                
            default:
                console.warn(`⚠️ Unknown Redis event type: ${event.type}`);
        }
    }
    
    /**
     * Graceful shutdown
     * Cleans up intervals and Redis subscriptions
     */
    public async shutdown(): Promise<void> {
        console.log('🛑 [RoomManager] Shutting down...');
        
        // Stop periodic cleanup
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = null;
        }
        
        // Unsubscribe from all Redis channels
        if (this.redisEnabled && this.redisService) {
            for (const spaceId of this.rooms.keys()) {
                await this.redisService.unsubscribeFromSpaceEvents(spaceId);
            }
        }
        
        console.log('✅ [RoomManager] Shutdown complete');
    }
}