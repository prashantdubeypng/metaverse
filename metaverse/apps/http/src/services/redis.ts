import Redis from 'ioredis';

// Redis client configuration
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
});

// Redis key prefixes
const KEYS = {
    CHATROOM: (id: string) => `chatroom:${id}`,
    CHATROOM_MEMBERS: (id: string) => `chatroom:${id}:members`,
    CHATROOM_ACTIVE: (id: string) => `chatroom:${id}:active`,
    USER_CHATROOMS: (userId: string) => `user:${userId}:chatrooms`,
    RECENT_MESSAGES: (chatroomId: string) => `chatroom:${chatroomId}:messages`,
    JOIN_REQUESTS: (chatroomId: string) => `chatroom:${chatroomId}:join_requests`,
    USER_JOIN_REQUESTS: (userId: string) => `user:${userId}:join_requests`,
    INVITATIONS: (userId: string) => `user:${userId}:invitations`,
    CHATROOM_INVITATIONS: (chatroomId: string) => `chatroom:${chatroomId}:invitations`,
    INVITATION_DATA: (invitationId: string) => `invitation:${invitationId}`,
    JOIN_REQUEST_DATA: (requestId: string) => `join_request:${requestId}`,
};

export interface ChatroomInfo {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    spaceId: string;
    isPrivate: boolean;
    createdAt: number;
}

export interface MessageInfo {
    id: string;
    content: string;
    userId: string;
    username: string;
    chatroomId: string;
    timestamp: number;
}

export interface JoinRequestData {
    id: string;
    userId: string;
    username: string;
    chatroomId: string;
    message?: string;
    requestedAt: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface InvitationData {
    id: string;
    userId: string;
    username: string;
    chatroomId: string;
    chatroomName: string;
    invitedBy: string;
    inviterUsername: string;
    message?: string;
    createdAt: number;
    expiresAt: number;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
}

export class RedisChatService {
    private redis: Redis;

    constructor() {
        this.redis = redis;
    }

    // Chatroom operations
    async createChatroom(chatroom: ChatroomInfo): Promise<void> {
        const key = KEYS.CHATROOM(chatroom.id);
        await this.redis.hset(key, {
            id: chatroom.id,
            name: chatroom.name,
            description: chatroom.description || '',
            ownerId: chatroom.ownerId,
            spaceId: chatroom.spaceId,
            isPrivate: chatroom.isPrivate.toString(),
            createdAt: chatroom.createdAt.toString(),
        });
        
        // Set expiration (24 hours)
        await this.redis.expire(key, 86400);
    }

    async getChatroomInfo(chatroomId: string): Promise<ChatroomInfo | null> {
        const key = KEYS.CHATROOM(chatroomId);
        const data = await this.redis.hgetall(key);
        
        if (!data.id) return null;
        
        return {
            id: data.id,
            name: data.name,
            description: data.description || undefined,
            ownerId: data.ownerId,
            spaceId: data.spaceId,
            isPrivate: data.isPrivate === 'true',
            createdAt: parseInt(data.createdAt),
        };
    }

    // Member operations
    async addUserToChatroom(chatroomId: string, userId: string, role: string = 'MEMBER'): Promise<void> {
        const membersKey = KEYS.CHATROOM_MEMBERS(chatroomId);
        const userChatroomsKey = KEYS.USER_CHATROOMS(userId);
        
        await Promise.all([
            this.redis.hset(membersKey, userId, role),
            this.redis.sadd(userChatroomsKey, chatroomId),
            this.redis.expire(membersKey, 86400),
            this.redis.expire(userChatroomsKey, 86400),
        ]);
    }

    async removeUserFromChatroom(chatroomId: string, userId: string): Promise<void> {
        const membersKey = KEYS.CHATROOM_MEMBERS(chatroomId);
        const userChatroomsKey = KEYS.USER_CHATROOMS(userId);
        const activeKey = KEYS.CHATROOM_ACTIVE(chatroomId);
        
        await Promise.all([
            this.redis.hdel(membersKey, userId),
            this.redis.srem(userChatroomsKey, chatroomId),
            this.redis.srem(activeKey, userId),
        ]);
    }

    async isUserMember(chatroomId: string, userId: string): Promise<boolean> {
        const membersKey = KEYS.CHATROOM_MEMBERS(chatroomId);
        const role = await this.redis.hget(membersKey, userId);
        return role !== null;
    }

    async getChatroomMembers(chatroomId: string): Promise<string[]> {
        const membersKey = KEYS.CHATROOM_MEMBERS(chatroomId);
        const members = await this.redis.hkeys(membersKey);
        return members;
    }

    async getUserRole(chatroomId: string, userId: string): Promise<string | null> {
        const membersKey = KEYS.CHATROOM_MEMBERS(chatroomId);
        return await this.redis.hget(membersKey, userId);
    }

    // Active users operations
    async setUserActive(chatroomId: string, userId: string): Promise<void> {
        const activeKey = KEYS.CHATROOM_ACTIVE(chatroomId);
        await this.redis.sadd(activeKey, userId);
        await this.redis.expire(activeKey, 3600); // 1 hour
    }

    async setUserInactive(chatroomId: string, userId: string): Promise<void> {
        const activeKey = KEYS.CHATROOM_ACTIVE(chatroomId);
        await this.redis.srem(activeKey, userId);
    }

    async getActiveUsers(chatroomId: string): Promise<string[]> {
        const activeKey = KEYS.CHATROOM_ACTIVE(chatroomId);
        return await this.redis.smembers(activeKey);
    }

    // Message caching
    async cacheMessage(message: MessageInfo): Promise<void> {
        const messagesKey = KEYS.RECENT_MESSAGES(message.chatroomId);
        const messageData = JSON.stringify(message);
        
        await this.redis.lpush(messagesKey, messageData);
        await this.redis.ltrim(messagesKey, 0, 99); // Keep last 100 messages
        await this.redis.expire(messagesKey, 86400); // 24 hours
    }

    async getRecentMessages(chatroomId: string, limit: number = 50): Promise<MessageInfo[]> {
        const messagesKey = KEYS.RECENT_MESSAGES(chatroomId);
        const messages = await this.redis.lrange(messagesKey, 0, limit - 1);
        
        return messages.map(msg => JSON.parse(msg)).reverse(); // Oldest first
    }

    // Cleanup operations
    async cleanupChatroom(chatroomId: string): Promise<void> {
        const keys = [
            KEYS.CHATROOM(chatroomId),
            KEYS.CHATROOM_MEMBERS(chatroomId),
            KEYS.CHATROOM_ACTIVE(chatroomId),
            KEYS.RECENT_MESSAGES(chatroomId),
        ];
        
        await this.redis.del(...keys);
    }

    // Health check
    async ping(): Promise<string> {
        return await this.redis.ping();
    }

    // JOIN REQUEST OPERATIONS
    async cacheJoinRequest(requestData: JoinRequestData): Promise<void> {
        const requestKey = KEYS.JOIN_REQUEST_DATA(requestData.id);
        const chatroomRequestsKey = KEYS.JOIN_REQUESTS(requestData.chatroomId);
        const userRequestsKey = KEYS.USER_JOIN_REQUESTS(requestData.userId);

        await Promise.all([
            // Store full request data
            this.redis.hset(requestKey, {
                id: requestData.id,
                userId: requestData.userId,
                username: requestData.username,
                chatroomId: requestData.chatroomId,
                message: requestData.message || '',
                requestedAt: requestData.requestedAt.toString(),
                status: requestData.status,
            }),
            // Add to chatroom's pending requests list
            this.redis.zadd(chatroomRequestsKey, requestData.requestedAt, requestData.id),
            // Add to user's requests list
            this.redis.zadd(userRequestsKey, requestData.requestedAt, requestData.id),
            // Set expiration (7 days)
            this.redis.expire(requestKey, 604800),
            this.redis.expire(chatroomRequestsKey, 604800),
            this.redis.expire(userRequestsKey, 604800),
        ]);
    }

    async getJoinRequest(requestId: string): Promise<JoinRequestData | null> {
        const requestKey = KEYS.JOIN_REQUEST_DATA(requestId);
        const data = await this.redis.hgetall(requestKey);
        
        if (!data.id) return null;
        
        return {
            id: data.id,
            userId: data.userId,
            username: data.username,
            chatroomId: data.chatroomId,
            message: data.message || undefined,
            requestedAt: parseInt(data.requestedAt),
            status: data.status as 'PENDING' | 'APPROVED' | 'REJECTED',
        };
    }

    async getPendingJoinRequests(chatroomId: string): Promise<JoinRequestData[]> {
        const chatroomRequestsKey = KEYS.JOIN_REQUESTS(chatroomId);
        const requestIds = await this.redis.zrange(chatroomRequestsKey, 0, -1);
        
        const requests: JoinRequestData[] = [];
        for (const requestId of requestIds) {
            const request = await this.getJoinRequest(requestId);
            if (request && request.status === 'PENDING') {
                requests.push(request);
            }
        }
        
        return requests;
    }

    async updateJoinRequestStatus(requestId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        const requestKey = KEYS.JOIN_REQUEST_DATA(requestId);
        await this.redis.hset(requestKey, 'status', status);
    }

    async removeJoinRequest(requestId: string, chatroomId: string, userId: string): Promise<void> {
        const requestKey = KEYS.JOIN_REQUEST_DATA(requestId);
        const chatroomRequestsKey = KEYS.JOIN_REQUESTS(chatroomId);
        const userRequestsKey = KEYS.USER_JOIN_REQUESTS(userId);

        await Promise.all([
            this.redis.del(requestKey),
            this.redis.zrem(chatroomRequestsKey, requestId),
            this.redis.zrem(userRequestsKey, requestId),
        ]);
    }

    // INVITATION OPERATIONS
    async cacheInvitation(invitationData: InvitationData): Promise<void> {
        const invitationKey = KEYS.INVITATION_DATA(invitationData.id);
        const userInvitationsKey = KEYS.INVITATIONS(invitationData.userId);
        const chatroomInvitationsKey = KEYS.CHATROOM_INVITATIONS(invitationData.chatroomId);

        await Promise.all([
            // Store full invitation data
            this.redis.hset(invitationKey, {
                id: invitationData.id,
                userId: invitationData.userId,
                username: invitationData.username,
                chatroomId: invitationData.chatroomId,
                chatroomName: invitationData.chatroomName,
                invitedBy: invitationData.invitedBy,
                inviterUsername: invitationData.inviterUsername,
                message: invitationData.message || '',
                createdAt: invitationData.createdAt.toString(),
                expiresAt: invitationData.expiresAt.toString(),
                status: invitationData.status,
            }),
            // Add to user's invitations list
            this.redis.zadd(userInvitationsKey, invitationData.createdAt, invitationData.id),
            // Add to chatroom's invitations list
            this.redis.zadd(chatroomInvitationsKey, invitationData.createdAt, invitationData.id),
            // Set expiration based on invitation expiry
            this.redis.expireat(invitationKey, Math.floor(invitationData.expiresAt / 1000)),
            this.redis.expire(userInvitationsKey, 604800), // 7 days
            this.redis.expire(chatroomInvitationsKey, 604800),
        ]);
    }

    async getInvitation(invitationId: string): Promise<InvitationData | null> {
        const invitationKey = KEYS.INVITATION_DATA(invitationId);
        const data = await this.redis.hgetall(invitationKey);
        
        if (!data.id) return null;
        
        return {
            id: data.id,
            userId: data.userId,
            username: data.username,
            chatroomId: data.chatroomId,
            chatroomName: data.chatroomName,
            invitedBy: data.invitedBy,
            inviterUsername: data.inviterUsername,
            message: data.message || undefined,
            createdAt: parseInt(data.createdAt),
            expiresAt: parseInt(data.expiresAt),
            status: data.status as 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED',
        };
    }

    async getUserInvitations(userId: string): Promise<InvitationData[]> {
        const userInvitationsKey = KEYS.INVITATIONS(userId);
        const invitationIds = await this.redis.zrevrange(userInvitationsKey, 0, -1); // Latest first
        
        const invitations: InvitationData[] = [];
        const now = Date.now();
        
        for (const invitationId of invitationIds) {
            const invitation = await this.getInvitation(invitationId);
            if (invitation) {
                // Mark expired invitations
                if (invitation.status === 'PENDING' && invitation.expiresAt <= now) {
                    await this.updateInvitationStatus(invitationId, 'EXPIRED');
                    invitation.status = 'EXPIRED';
                }
                
                // Only return pending invitations
                if (invitation.status === 'PENDING') {
                    invitations.push(invitation);
                }
            }
        }
        
        return invitations;
    }

    async updateInvitationStatus(invitationId: string, status: 'ACCEPTED' | 'DECLINED' | 'EXPIRED'): Promise<void> {
        const invitationKey = KEYS.INVITATION_DATA(invitationId);
        await this.redis.hset(invitationKey, 'status', status);
    }

    async removeInvitation(invitationId: string, userId: string, chatroomId: string): Promise<void> {
        const invitationKey = KEYS.INVITATION_DATA(invitationId);
        const userInvitationsKey = KEYS.INVITATIONS(userId);
        const chatroomInvitationsKey = KEYS.CHATROOM_INVITATIONS(chatroomId);

        await Promise.all([
            this.redis.del(invitationKey),
            this.redis.zrem(userInvitationsKey, invitationId),
            this.redis.zrem(chatroomInvitationsKey, invitationId),
        ]);
    }

    // MEMBER MANAGEMENT OPERATIONS
    async updateMemberRole(chatroomId: string, userId: string, newRole: string): Promise<void> {
        const membersKey = KEYS.CHATROOM_MEMBERS(chatroomId);
        await this.redis.hset(membersKey, userId, newRole);
    }

    async getMemberCount(chatroomId: string): Promise<number> {
        const membersKey = KEYS.CHATROOM_MEMBERS(chatroomId);
        return await this.redis.hlen(membersKey);
    }

    async getActiveUserCount(chatroomId: string): Promise<number> {
        const activeKey = KEYS.CHATROOM_ACTIVE(chatroomId);
        return await this.redis.scard(activeKey);
    }

    // NOTIFICATION OPERATIONS (for real-time updates)
    async notifyJoinRequest(chatroomId: string, requestData: JoinRequestData): Promise<void> {
        const channel = `chatroom:${chatroomId}:notifications`;
        const notification = {
            type: 'JOIN_REQUEST',
            data: requestData,
            timestamp: Date.now(),
        };
        
        await this.redis.publish(channel, JSON.stringify(notification));
    }

    async notifyInvitation(userId: string, invitationData: InvitationData): Promise<void> {
        const channel = `user:${userId}:notifications`;
        const notification = {
            type: 'INVITATION',
            data: invitationData,
            timestamp: Date.now(),
        };
        
        await this.redis.publish(channel, JSON.stringify(notification));
    }

    async notifyRequestProcessed(userId: string, requestId: string, status: 'APPROVED' | 'REJECTED', chatroomName: string): Promise<void> {
        const channel = `user:${userId}:notifications`;
        const notification = {
            type: 'REQUEST_PROCESSED',
            data: {
                requestId,
                status,
                chatroomName,
            },
            timestamp: Date.now(),
        };
        
        await this.redis.publish(channel, JSON.stringify(notification));
    }

    // CLEANUP OPERATIONS
    async cleanupExpiredInvitations(): Promise<void> {
        // This should be called periodically by a background job
        const now = Math.floor(Date.now() / 1000);
        const pattern = 'invitation:*';
        
        const keys = await this.redis.keys(pattern);
        for (const key of keys) {
            const ttl = await this.redis.ttl(key);
            if (ttl === -1 || ttl === 0) {
                // Invitation expired, mark as expired
                const invitationId = key.split(':')[1];
                await this.updateInvitationStatus(invitationId, 'EXPIRED');
            }
        }
    }
}

export const redisChatService = new RedisChatService();