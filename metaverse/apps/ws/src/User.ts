import { Roommanager } from './Roommanager';
import { outgoingmessage, IncomingMessage, JoinPayload, MovePayload, UserPosition } from './types';
import { WebSocket } from 'ws';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { jwt_password } from './config';
import client from '@repo/db';
import { RedisService } from './RedisService';
import { KafkaChatService } from './KafkaChatService';
import { VideoCallManager } from './VideoCallManager';

function getRandomIdForUser(length = 15): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$%&*';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export class User {
    public id: string;
    private spaceId?: string;
    private userId?: string;
    private username?: string;
    private x: number;
    private y: number;
    private isAlive: boolean = true;
    private activeChatrooms: Set<string> = new Set();
    private redisService: RedisService;
    private kafkaService: KafkaChatService;
    private videoCallManager: VideoCallManager;

    constructor(private ws: WebSocket) {
        this.id = getRandomIdForUser();
        this.x = 0;
        this.y = 0;
        this.redisService = RedisService.getInstance();
        this.kafkaService = KafkaChatService.getInstance();
        this.videoCallManager = VideoCallManager.getInstance();
    }

    public initHandlers(): void {
        this.ws.on('message', async (data) => {
            if (!this.isAlive) return;

            try {
                const parseData: IncomingMessage = JSON.parse(data.toString());
                await this.handleMessage(parseData);
            } catch (error) {
                console.error('Error parsing message:', error);
                this.send({
                    type: 'error',
                    payload: { message: 'Invalid message format' }
                });
            }
        });

        this.ws.on('error', (error) => {
            console.error(`WebSocket error for user ${this.id}:`, error);
        });

        this.ws.on('close', () => {
            this.isAlive = false;
            this.destroy();
        });

        // Heartbeat to detect broken connections
        this.ws.on('pong', () => {
            console.log(`Heartbeat received from user ${this.id}`);
        });
    }

    private async handleMessage(parseData: IncomingMessage): Promise<void> {
        console.log(`📨 [MESSAGE RECEIVED] User ${this.username || this.id} sent message type: ${parseData.type}`, parseData.payload);

        switch (parseData.type) {
            case 'join':
                await this.handleJoin(parseData.payload as JoinPayload);
                break;
            case 'move':
                console.log(`🚶 [MOVE MESSAGE] Processing move request for ${this.username || this.id}`);
                await this.handleMove(parseData.payload as MovePayload);
                break;
            case 'leave':
                console.log(`👋 [LEAVE MESSAGE] Processing leave request for ${this.username || this.id}`);
                this.handleLeave();
                break;
            case 'chat-join':
                console.log(`💬 [CHAT JOIN] Processing chat join for ${this.username || this.id}`);
                await this.handleChatJoin(parseData.payload);
                break;
            case 'chat-message':
                console.log(`💬 [CHAT MESSAGE] Processing chat message from ${this.username || this.id}`);
                await this.handleChatMessage(parseData.payload);
                break;
            case 'chat-leave':
                console.log(`💬 [CHAT LEAVE] Processing chat leave for ${this.username || this.id}`);
                await this.handleChatLeave(parseData.payload);
                break;
            case 'video-call-signaling':
                console.log(`🎥 [VIDEO SIGNALING] Processing WebRTC signaling from ${this.username || this.id}`);
                this.handleVideoSignaling(parseData.payload);
                break;
            case 'video-call-end':
                console.log(`🎥 [VIDEO END] Processing video call end from ${this.username || this.id}`);
                this.handleVideoCallEnd(parseData.payload);
                break;
            case 'proximity-video-call-signal':
                console.log(`🎥 [PROXIMITY SIGNALING] Processing proximity video signal from ${this.username || this.id}`);
                this.handleProximityVideoSignaling(parseData.payload);
                break;
            case 'proximity-position-update':
                console.log(`📍 [PROXIMITY POSITION] Processing position update from ${this.username || this.id}`);
                this.handleProximityPositionUpdate(parseData.payload);
                break;
            case 'proximity-video-call-ended':
                console.log(`🎥 [PROXIMITY END] Processing proximity call end from ${this.username || this.id}`);
                this.handleProximityVideoCallEnd(parseData.payload);
                break;
            case 'proximity-heartbeat':
                console.log(`💓 [PROXIMITY HEARTBEAT] Processing heartbeat from ${this.username || this.id}`);
                this.handleProximityHeartbeat(parseData.payload);
                break;
            case 'authenticate':
                console.log(`🔐 [AUTHENTICATE] Processing authentication from connection ${this.id}`);
                await this.handleAuthenticate(parseData);
                break;
            case 'heartbeat':
                console.log(`💓 [HEARTBEAT] Processing heartbeat from ${this.username || this.id}`);
                this.handleHeartbeat(parseData.payload);
                break;
            case 'heartbeat-response':
                console.log(`💓 [HEARTBEAT RESPONSE] Received heartbeat response from ${this.username || this.id}`);
                // Just acknowledge - no action needed
                break;
            case 'proximity-video-call-signal':
                console.log(`🎥 [PROXIMITY SIGNALING] Processing proximity WebRTC signaling from ${this.username || this.id}`);
                this.handleProximityVideoSignaling(parseData.payload);
                break;
            case 'proximity-position-update':
                console.log(`📍 [PROXIMITY POSITION] Processing position update from ${this.username || this.id}`);
                this.handleProximityPositionUpdate(parseData.payload);
                break;
            case 'proximity-video-call-ended':
                console.log(`🎥 [PROXIMITY END] Processing proximity video call end from ${this.username || this.id}`);
                this.handleProximityVideoCallEnd(parseData.payload);
                break;
            case 'proximity-heartbeat':
                console.log(`💓 [PROXIMITY HEARTBEAT] Processing heartbeat from ${this.username || this.id}`);
                this.handleProximityHeartbeat(parseData.payload);
                break;
            case 'authenticate':
                console.log(`🔐 [AUTH] Processing authentication from connection ${this.id}`);
                await this.handleAuthenticate(parseData);
                break;
            case 'heartbeat':
                console.log(`💓 [HEARTBEAT] Processing heartbeat from ${this.username || this.id}`);
                this.handleHeartbeat(parseData.payload);
                break;
            case 'heartbeat-response':
                console.log(`💓 [HEARTBEAT RESPONSE] Received heartbeat response from ${this.username || this.id}`);
                break;
            default:
                console.log(`❓ [UNKNOWN MESSAGE] Invalid message type: ${parseData.type} from ${this.username || this.id}`);
                this.send({
                    type: 'error',
                    payload: { message: 'Invalid message type' }
                });
                break;
        }
    }

    private async handleJoin(payload: JoinPayload): Promise<void> {
        const { spaceId, token } = payload;
        
        console.log(`🔐 [AUTH] Processing join request for space: ${spaceId}`);
        console.log(`🔑 [AUTH] Token provided: ${token ? 'Yes' : 'No'}`);

        if (!token) {
            console.log('❌ [AUTH] No token provided');
            this.ws.close(1008, 'No token provided');
            return;
        }

        try {
            console.log(`🔍 [AUTH] Verifying JWT token with secret: ${jwt_password.substring(0, 5)}...`);
            
            // Verify JWT token
            const decoded = jwt.verify(token, jwt_password) as JwtPayload;
            const userId = decoded.userId;
            const username = decoded.username;
            
            console.log(`✅ [AUTH] Token verified successfully. UserId: ${userId}, Username: ${username}`);

            if (!userId || !username) {
                console.log(`❌ [AUTH] Missing user data in token. UserId: ${userId}, Username: ${username}`);
                this.ws.close(1008, 'Invalid token - missing user data');
                return;
            }

            this.userId = userId;
            this.username = username;
            
            console.log(`🏢 [SPACE] Checking if space exists: ${spaceId}`);

            // Verify space exists
            const space = await client.space.findFirst({
                where: { id: spaceId }
            });

            if (!space) {
                console.log(`❌ [SPACE] Space not found: ${spaceId}`);
                this.ws.close(1008, 'Space not found');
                return;
            }
            
            console.log(`✅ [SPACE] Space found: ${space.name} (${space.id}) - Dimensions: ${space.width}x${space.height}`);

            this.spaceId = spaceId;
            
            // Calculate fixed spawn position to avoid overlap
            const currentUserCount = Roommanager.getInstance().getUserCount(spaceId);
            const spawnX = 2 + (currentUserCount % 5); // Spawn in a grid pattern starting at x=2
            const spawnY = 2 + Math.floor(currentUserCount / 5); // New row every 5 users
            
            // Ensure spawn position is within space boundaries (use grid coordinates)
            const maxGridX = Math.floor((space.width || 800) / 20) - 1; // Convert pixels to grid, -1 for padding
            const maxGridY = Math.floor((space.height || 600) / 20) - 1; // Convert pixels to grid, -1 for padding
            
            this.x = Math.min(spawnX, maxGridX);
            this.y = Math.min(spawnY, maxGridY);

            console.log(`🎯 [SPAWN] User ${username} (#${currentUserCount}) spawned at fixed grid position (${this.x}, ${this.y}) in space ${spaceId} with boundaries ${maxGridX}x${maxGridY}`);

            // Add user to room manager
            Roommanager.getInstance().addUser(spaceId, this);

            // Broadcast user joined to others
            Roommanager.getInstance().broadCast({
                type: 'user-joined-space',
                payload: {
                    userId: this.userId,
                    username: this.username,
                    x: this.x,
                    y: this.y,
                }
            }, this, this.spaceId);

            // Send join confirmation with current users
            const currentUsers = Roommanager.getInstance().getSpaceUsers(spaceId);
            this.send({
                type: 'space-joined',
                payload: {
                    spawn: {
                        x: this.x,
                        y: this.y,
                    },
                    users: currentUsers
                        .filter(user => user.id !== this.id)
                        .map(user => ({
                            userId: user.getUserId(),
                            username: user.getUsername(),
                            x: user.getX(),
                            y: user.getY(),
                        }))
                }
            });

            console.log(`User ${this.username} (${this.userId}) joined space ${spaceId} at position (${this.x}, ${this.y})`);

        } catch (error) {
            console.error('❌ [AUTH ERROR] Error during join:', error);
            
            // Provide more specific error messages
            if (error instanceof jwt.JsonWebTokenError) {
                console.error('❌ [JWT ERROR] Invalid JWT token:', error.message);
                this.ws.close(1008, `JWT Error: ${error.message}`);
            } else if (error instanceof jwt.TokenExpiredError) {
                console.error('❌ [JWT ERROR] Token expired:', error.message);
                this.ws.close(1008, 'Token expired');
            } else {
                console.error('❌ [AUTH ERROR] General authentication error:', error);
                this.ws.close(1008, 'Authentication failed');
            }
        }
    }

    private async handleMove(payload: MovePayload): Promise<void> {
        console.log(`🎮 [MOVE REQUEST] User ${this.username} (${this.userId}) wants to move from (${this.x}, ${this.y}) to (${payload.x}, ${payload.y})`);

        if (!this.spaceId || !this.userId) {
            console.log(`❌ [MOVE ERROR] User ${this.id} not in a space`);
            this.send({
                type: 'error',
                payload: { message: 'Not in a space' }
            });
            return;
        }

        // Get space dimensions for boundary checking
        const space = await client.space.findFirst({
            where: { id: this.spaceId }
        });

        if (!space) {
            console.log(`❌ [MOVE ERROR] Space not found: ${this.spaceId}`);
            this.send({
                type: 'error',
                payload: { message: 'Space not found' }
            });
            return;
        }

        const { x: moveX, y: moveY } = payload;
        
        // Calculate space boundaries in grid coordinates
        const maxGridX = Math.floor((space.width || 800) / 20) - 1;
        const maxGridY = Math.floor((space.height || 600) / 20) - 1;
        
        console.log(`🏢 [SPACE BOUNDS] Space ${this.spaceId} boundaries: (0,0) to (${maxGridX}, ${maxGridY})`);
        
        // Enforce space boundaries
        if (moveX < 0 || moveX > maxGridX || moveY < 0 || moveY > maxGridY) {
            console.log(`❌ [MOVE REJECTED] Out of bounds: (${moveX}, ${moveY}) - Valid range: (0,0) to (${maxGridX}, ${maxGridY})`);
            this.send({
                type: 'move-rejected',
                payload: {
                    userId: this.userId,
                    username: this.username,
                    x: this.x,
                    y: this.y,
                    reason: 'Out of space boundaries'
                }
            });
            return;
        }

        const xDisplacement = Math.abs(this.x - moveX);
        const yDisplacement = Math.abs(this.y - moveY);

        console.log(`📏 [MOVE VALIDATION] Displacement: X=${xDisplacement}, Y=${yDisplacement}`);

        // Allow more flexible movement - not just 1 step at a time
        // But still validate it's a reasonable movement (prevent teleporting)
        const maxMovement = 5; // Allow up to 5 grid units movement per request
        if (xDisplacement <= maxMovement && yDisplacement <= maxMovement) {

            console.log(`✅ [MOVE VALID] Movement approved for ${this.username}`);

            // Update position
            this.x = moveX;
            this.y = moveY;

            // Send movement confirmation to the user
            console.log(`📤 [MOVE CONFIRM] Sending confirmation to ${this.username}`);
            this.send({
                type: 'user-moved',
                payload: {
                    userId: this.userId,
                    username: this.username,
                    x: moveX,
                    y: moveY
                }
            });

            // Broadcast movement to others
            const otherUsersCount = Roommanager.getInstance().getUserCount(this.spaceId) - 1;
            console.log(`📡 [MOVE BROADCAST] Broadcasting to ${otherUsersCount} other users in space ${this.spaceId}`);
            Roommanager.getInstance().broadCast({
                type: 'user-moved',
                payload: {
                    userId: this.userId,
                    username: this.username,
                    x: moveX,
                    y: moveY
                }
            }, this, this.spaceId);

            console.log(`🎯 [MOVE SUCCESS] User ${this.username} (${this.userId}) moved to (${moveX}, ${moveY})`);
            
            // Check for proximity-based video calls after movement
            this.videoCallManager.handleUserMovement(this);
        } else {
            // Reject invalid movement
            console.log(`❌ [MOVE REJECTED] Invalid movement for ${this.username}: displacement X=${xDisplacement}, Y=${yDisplacement} (max allowed: ${maxMovement})`);
            console.log(`📤 [MOVE REJECT] Sending rejection to ${this.username}, keeping position (${this.x}, ${this.y})`);

            this.send({
                type: 'move-rejected',
                payload: {
                    userId: this.userId,
                    username: this.username,
                    x: this.x,
                    y: this.y,
                    reason: 'Movement too large'
                }
            });
        }
    }

    private handleLeave(): void {
        if (this.spaceId && this.userId) {
            Roommanager.getInstance().removeUser(this, this.spaceId);
            console.log(`User ${this.username} (${this.userId}) left space ${this.spaceId}`);
        }
        this.ws.close(1000, 'User left');
    }



    public send(payload: outgoingmessage): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }

    public ping(): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.ping();
        }
    }

    // Getters for room manager
    public getUserId(): string | undefined {
        return this.userId;
    }

    public getUsername(): string | undefined {
        return this.username;
    }

    public getSpaceId(): string | undefined {
        return this.spaceId;
    }

    public getX(): number {
        return this.x;
    }

    public getY(): number {
        return this.y;
    }

    public getPosition(): UserPosition | null {
        if (!this.userId || !this.username) return null;
        return {
            userId: this.userId,
            username: this.username,
            x: this.x,
            y: this.y
        };
    }

    public isConnected(): boolean {
        return this.isAlive && this.ws.readyState === WebSocket.OPEN;
    }

    // Video call methods
    private handleVideoSignaling(payload: any): void {
        if (!this.userId) {
            this.send({
                type: 'error',
                payload: { message: 'User not authenticated' }
            });
            return;
        }

        this.videoCallManager.handleSignaling(this, payload);
    }

    private handleVideoCallEnd(payload: { callId?: string }): void {
        if (!this.userId) return;

        const userCall = this.videoCallManager.getUserCall(this.userId);
        if (userCall) {
            this.videoCallManager.endCall(userCall.callId, 'user_ended');
        }
    }

    // Proximity video call methods
    private handleProximityVideoSignaling(payload: any): void {
        if (!this.userId) {
            this.send({
                type: 'error',
                payload: { message: 'User not authenticated' }
            });
            return;
        }

        console.log(`🎥 [PROXIMITY SIGNALING] Relaying signal from ${this.username} to ${payload.targetUserId}`);
        
        // Find target user and relay the signal
        if (this.spaceId && payload.targetUserId) {
            const spaceUsers = Roommanager.getInstance().getSpaceUsers(this.spaceId);
            const targetUser = spaceUsers.find(user => user.getUserId() === payload.targetUserId);
            
            if (targetUser) {
                targetUser.send({
                    type: 'proximity-video-call-signal',
                    payload: {
                        ...payload,
                        fromUserId: this.userId,
                        fromUsername: this.username
                    }
                });
            } else {
                console.log(`🎥 [PROXIMITY SIGNALING] Target user ${payload.targetUserId} not found in space`);
            }
        }
    }

    private handleProximityPositionUpdate(payload: any): void {
        if (!this.userId || !this.spaceId) return;

        const { x, y, z } = payload;
        
        // Update user position
        if (typeof x === 'number' && typeof y === 'number') {
            this.x = x;
            this.y = y;
        }

        console.log(`📍 [PROXIMITY POSITION] User ${this.username} updated position to (${this.x}, ${this.y})`);

        // Check for proximity video call updates
        this.videoCallManager.handleUserMovement(this);

        // Broadcast position to nearby users for video call proximity detection
        Roommanager.getInstance().broadCast({
            type: 'proximity-user-position',
            payload: {
                userId: this.userId,
                username: this.username,
                x: this.x,
                y: this.y,
                z: z || 0
            }
        }, this, this.spaceId);
    }

    private handleProximityVideoCallEnd(payload: any): void {
        if (!this.userId) return;

        const { targetUserId, reason } = payload;
        
        console.log(`🎥 [PROXIMITY END] User ${this.username} ending proximity call with ${targetUserId}, reason: ${reason}`);

        // Notify target user that call ended
        if (this.spaceId && targetUserId) {
            const spaceUsers = Roommanager.getInstance().getSpaceUsers(this.spaceId);
            const targetUser = spaceUsers.find(user => user.getUserId() === targetUserId);
            
            if (targetUser) {
                targetUser.send({
                    type: 'proximity-video-call-ended',
                    payload: {
                        fromUserId: this.userId,
                        fromUsername: this.username,
                        reason: reason || 'user_ended'
                    }
                });
            }
        }

        // Clean up any active call session
        const userCall = this.videoCallManager.getUserCall(this.userId);
        if (userCall) {
            this.videoCallManager.endCall(userCall.callId, reason || 'user_ended');
        }
    }

    private handleProximityHeartbeat(payload: any): void {
        if (!this.userId) return;

        const { position, timestamp } = payload;
        
        // Update position if provided
        if (position && typeof position.x === 'number' && typeof position.y === 'number') {
            this.x = position.x;
            this.y = position.y;
        }

        // Send heartbeat response
        this.send({
            type: 'proximity-heartbeat-response',
            payload: {
                timestamp: Date.now(),
                serverReceived: timestamp
            }
        });

        // Check proximity for video calls
        this.videoCallManager.handleUserMovement(this);
    }

    private async handleAuthenticate(message: IncomingMessage): Promise<void> {
        const { token, userId } = message.payload || {};
        
        if (!token || !userId) {
            this.send({
                type: 'auth-error',
                payload: { message: 'Token and userId required' }
            });
            return;
        }

        try {
            // Verify JWT token
            const decoded = jwt.verify(token, jwt_password) as JwtPayload;
            
            if (decoded.userId !== userId) {
                this.send({
                    type: 'auth-error',
                    payload: { message: 'Invalid token' }
                });
                return;
            }

            // Get user from database
            const user = await client.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                this.send({
                    type: 'auth-error',
                    payload: { message: 'User not found' }
                });
                return;
            }

            // Set user info
            this.userId = userId;
            this.username = user.username;

            console.log(`✅ [AUTH] User ${this.username} (${this.userId}) authenticated on connection ${this.id}`);

            // Send success response
            this.send({
                type: 'authenticated',
                payload: {
                    userId: this.userId,
                    username: this.username
                }
            });

        } catch (error) {
            console.error('❌ [AUTH] Authentication error:', error);
            this.send({
                type: 'auth-error',
                payload: { message: 'Invalid token' }
            });
        }
    }

    private handleHeartbeat(payload: any): void {
        // Send heartbeat response
        this.send({
            type: 'heartbeat',
            payload: {
                timestamp: Date.now(),
                serverTime: new Date().toISOString()
            }
        });
    }

    // Chat-related methods
    private async handleChatJoin(payload: { chatroomId: string }): Promise<void> {
        try {
            const { chatroomId } = payload;

            if (!this.userId || !this.username) {
                this.send({
                    type: 'chat-error',
                    payload: { message: 'User not authenticated' }
                });
                return;
            }

            // Verify user is member of chatroom
            const membership = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: this.userId,
                        chatroomId: chatroomId
                    }
                }
            });

            if (!membership) {
                this.send({
                    type: 'chat-error',
                    payload: { message: 'You are not a member of this chatroom' }
                });
                return;
            }

            // Add to active chatrooms
            this.activeChatrooms.add(chatroomId);

            // Subscribe to Redis channel for real-time messages
            await this.redisService.subscribeToChatroom(chatroomId, (message) => {
                // Only send to this user if they're still in the chatroom
                if (this.activeChatrooms.has(chatroomId)) {
                    this.send({
                        type: 'chat-message-received',
                        payload: message
                    });
                }
            });

            // Add user to Redis online users
            await this.redisService.addOnlineUserToChatroom(chatroomId, this.userId, this.username);
            await this.redisService.addUserToChatroom(this.userId, chatroomId);

            // Send user event to Kafka (async - don't wait)
            this.kafkaService.sendUserEvent({
                eventType: 'join',
                userId: this.userId,
                username: this.username,
                chatroomId: chatroomId
            }).catch(error => {
                console.error('❌ Failed to send user join event to Kafka:', error);
            });

            // Send analytics to Kafka (async - don't wait)
            this.kafkaService.sendAnalytics({
                type: 'user_joined',
                chatroomId: chatroomId,
                userId: this.userId
            }).catch(error => {
                console.error('❌ Failed to send join analytics to Kafka:', error);
            });

            // Get online users and send confirmation
            const onlineUsers = await this.redisService.getOnlineUsersInChatroom(chatroomId);

            this.send({
                type: 'chat-joined',
                payload: {
                    chatroomId: chatroomId,
                    onlineUsers: onlineUsers
                }
            });

            console.log(`💬 [CHAT JOIN SUCCESS] User ${this.username} joined chatroom ${chatroomId}`);

        } catch (error) {
            console.error('❌ Error handling chat join:', error);
            this.send({
                type: 'chat-error',
                payload: { message: 'Failed to join chatroom' }
            });
        }
    }

    private async handleChatMessage(payload: {
        chatroomId: string;
        content: string;
        type?: string
    }): Promise<void> {
        try {
            const { chatroomId, content, type = 'text' } = payload;

            if (!this.userId || !this.username) {
                this.send({
                    type: 'chat-error',
                    payload: { message: 'User not authenticated' }
                });
                return;
            }

            if (!content || content.trim() === '') {
                this.send({
                    type: 'chat-error',
                    payload: { message: 'Message content is required' }
                });
                return;
            }

            if (!this.activeChatrooms.has(chatroomId)) {
                this.send({
                    type: 'chat-error',
                    payload: { message: 'You are not in this chatroom' }
                });
                return;
            }

            // Generate unique message ID
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            const timestamp = Date.now();

            const messageData = {
                messageId,
                content: content.trim(),
                userId: this.userId,
                username: this.username,
                chatroomId,
                type,
                timestamp
            };

            // Send to Kafka for persistence (async - don't wait)
            this.kafkaService.sendChatMessage(messageData).catch(error => {
                console.error('❌ Failed to send message to Kafka:', error);
            });

            // Send to Redis for real-time distribution
            await this.redisService.publishChatMessage(chatroomId, messageData);

            // Send analytics to Kafka (async - don't wait)
            this.kafkaService.sendAnalytics({
                type: 'message_sent',
                chatroomId: chatroomId,
                userId: this.userId,
                metadata: { messageLength: content.length, messageType: type }
            }).catch(error => {
                console.error('❌ Failed to send analytics to Kafka:', error);
            });

            // Send confirmation to sender
            this.send({
                type: 'chat-message-sent',
                payload: {
                    messageId,
                    chatroomId,
                    timestamp
                }
            });

            console.log(`💬 [CHAT MESSAGE] User ${this.username} sent message to chatroom ${chatroomId}`);

        } catch (error) {
            console.error('❌ Error handling chat message:', error);
            this.send({
                type: 'chat-error',
                payload: { message: 'Failed to send message' }
            });
        }
    }

    private async handleChatLeave(payload: { chatroomId: string }): Promise<void> {
        try {
            const { chatroomId } = payload;

            if (!this.userId || !this.username) {
                return;
            }

            // Remove from active chatrooms
            this.activeChatrooms.delete(chatroomId);

            // Unsubscribe from Redis channel
            await this.redisService.unsubscribeFromChatroom(chatroomId);

            // Remove from Redis online users
            await this.redisService.removeOnlineUserFromChatroom(chatroomId, this.userId);
            await this.redisService.removeUserFromChatroom(this.userId, chatroomId);

            // Send user event to Kafka (async - don't wait)
            this.kafkaService.sendUserEvent({
                eventType: 'leave',
                userId: this.userId,
                username: this.username,
                chatroomId: chatroomId
            }).catch(error => {
                console.error('❌ Failed to send user leave event to Kafka:', error);
            });

            // Send analytics to Kafka (async - don't wait)
            this.kafkaService.sendAnalytics({
                type: 'user_left',
                chatroomId: chatroomId,
                userId: this.userId
            }).catch(error => {
                console.error('❌ Failed to send leave analytics to Kafka:', error);
            });

            this.send({
                type: 'chat-left',
                payload: { chatroomId }
            });

            console.log(`💬 [CHAT LEAVE] User ${this.username} left chatroom ${chatroomId}`);

        } catch (error) {
            console.error('❌ Error handling chat leave:', error);
        }
    }

    // Override destroy to clean up chat subscriptions
    public async destroy(): Promise<void> {
        this.isAlive = false;

        try {
            // Clean up all chat subscriptions
            for (const chatroomId of this.activeChatrooms) {
                await this.redisService.unsubscribeFromChatroom(chatroomId);

                if (this.userId) {
                    await this.redisService.removeOnlineUserFromChatroom(chatroomId, this.userId);
                    await this.redisService.removeUserFromChatroom(this.userId, chatroomId);

                    // Send leave events to Kafka (async - don't wait)
                    if (this.username) {
                        this.kafkaService.sendUserEvent({
                            eventType: 'leave',
                            userId: this.userId,
                            username: this.username,
                            chatroomId: chatroomId
                        }).catch(error => {
                            console.error('❌ Failed to send user leave event to Kafka during cleanup:', error);
                        });
                    }
                }
            }

            this.activeChatrooms.clear();

        } catch (error) {
            console.error('❌ Error cleaning up chat subscriptions:', error);
        }

        // Clean up video calls
        if (this.userId) {
            this.videoCallManager.handleUserDisconnect(this.userId);
        }

        // Original destroy logic
        if (this.spaceId && this.userId) {
            // Broadcast user left to others
            Roommanager.getInstance().broadCast({
                type: 'user-left',
                payload: {
                    userId: this.userId,
                    username: this.username,
                }
            }, this, this.spaceId);

            // Remove from room manager
            Roommanager.getInstance().removeUser(this, this.spaceId);
            console.log(`User ${this.username} (${this.userId}) disconnected from space ${this.spaceId}`);
        }
    }
}