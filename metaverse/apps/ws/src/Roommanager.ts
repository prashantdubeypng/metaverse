import { User } from "./User";
import { outgoingmessage } from "./types";
import { RedisService } from "./RedisService";

export class Roommanager {
    rooms: Map<string, User[]> = new Map();
    static instance: Roommanager;
    private redisService: RedisService;

    private constructor() {
        this.rooms = new Map();
        this.redisService = RedisService.getInstance();
    }

    static getInstance(): Roommanager {
        if (!this.instance) {
            this.instance = new Roommanager();
        }
        return this.instance;
    }

    public async addUser(spaceId: string, user: User): Promise<void> {
        if (!this.rooms.has(spaceId)) {
            this.rooms.set(spaceId, []);
        }
        
        // Check if user is already in the room
        const existingUsers = this.rooms.get(spaceId)!;
        if (!existingUsers.find(u => u.id === user.id)) {
            this.rooms.set(spaceId, [...existingUsers, user]);
            console.log(`Added user ${user.id} to space ${spaceId}. Total users: ${existingUsers.length + 1}`);
            
            // Persist to Redis
            const userId = user.getUserId();
            const username = user.getUsername();
            if (userId && username) {
                await this.redisService.saveUserInSpace(spaceId, userId, {
                    username,
                    x: user.getX(),
                    y: user.getY(),
                    connectionId: user.id
                });
            }
        }
    }

    public async removeUser(user: User, spaceId: string): Promise<void> {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        
        const filteredUsers = this.rooms.get(spaceId)?.filter(u => u.id !== user.id) ?? [];
        this.rooms.set(spaceId, filteredUsers);
        
        // Remove from Redis
        const userId = user.getUserId();
        if (userId) {
            await this.redisService.removeUserFromSpace(spaceId, userId);
        }
        
        // Remove empty rooms
        if (filteredUsers.length === 0) {
            this.rooms.delete(spaceId);
            console.log(`Removed empty space ${spaceId}`);
        } else {
            console.log(`Removed user ${user.id} from space ${spaceId}. Remaining users: ${filteredUsers.length}`);
        }
    }

    public broadCast(message: outgoingmessage, excludeUser: User, spaceId: string): void {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        
        const users = this.rooms.get(spaceId)!;
        let broadcastCount = 0;
        
        users.forEach(user => {
            if (user.id !== excludeUser.id && user.isConnected()) {
                user.send(message);
                broadcastCount++;
            }
        });
        
        console.log(`Broadcasted ${message.type} to ${broadcastCount} users in space ${spaceId}`);
    }

    public getSpaceUsers(spaceId: string): User[] {
        return this.rooms.get(spaceId) ?? [];
    }

    public getUserCount(spaceId: string): number {
        return this.rooms.get(spaceId)?.length ?? 0;
    }

    public getAllSpaces(): string[] {
        return Array.from(this.rooms.keys());
    }

    public getTotalUsers(): number {
        let total = 0;
        this.rooms.forEach(users => {
            total += users.length;
        });
        return total;
    }

    public getStats(): { 
        totalSpaces: number; 
        totalUsers: number; 
        spacesWithUsers: Array<{ spaceId: string; userCount: number }> 
    } {
        const spacesWithUsers = Array.from(this.rooms.entries()).map(([spaceId, users]) => ({
            spaceId,
            userCount: users.length
        }));

        return {
            totalSpaces: this.rooms.size,
            totalUsers: this.getTotalUsers(),
            spacesWithUsers
        };
    }

    public async cleanupDisconnectedUsers(): Promise<void> {
        let cleanedCount = 0;
        
        this.rooms.forEach(async (users, spaceId) => {
            const connectedUsers = users.filter(user => user.isConnected());
            
            if (connectedUsers.length !== users.length) {
                cleanedCount += users.length - connectedUsers.length;
                
                // Remove disconnected users from Redis
                const disconnectedUsers = users.filter(user => !user.isConnected());
                for (const user of disconnectedUsers) {
                    const userId = user.getUserId();
                    if (userId) {
                        await this.redisService.removeUserFromSpace(spaceId, userId);
                    }
                }
                
                if (connectedUsers.length === 0) {
                    this.rooms.delete(spaceId);
                } else {
                    this.rooms.set(spaceId, connectedUsers);
                }
            }
            
            // Clean up stale users from Redis (not updated in 5 minutes)
            await this.redisService.cleanupStaleUsersInSpace(spaceId);
        });
        
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} disconnected users`);
        }
    }

    // Get users from Redis (for reconnection scenario)
    public async getUsersFromRedis(spaceId: string): Promise<Array<{
        userId: string;
        username: string;
        x: number;
        y: number;
    }>> {
        const redisUsers = await this.redisService.getUsersInSpace(spaceId);
        return redisUsers.map(user => ({
            userId: user.userId,
            username: user.username,
            x: user.x,
            y: user.y
        }));
    }

    // Update user position in Redis
    public async updateUserPositionInRedis(spaceId: string, userId: string, x: number, y: number): Promise<void> {
        await this.redisService.updateUserPosition(spaceId, userId, x, y);
    }
}