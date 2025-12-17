/**
 * User.ts - WebSocket User Connection Handler
 * 
 * PURPOSE:
 * This module handles individual WebSocket connections for users in the metaverse.
 * Each User instance represents a single connected client and manages:
 * - Authentication via JWT tokens
 * - Joining/leaving virtual spaces
 * - Movement within spaces
 * - Chat messaging via Redis pub/sub and Kafka
 * - Video calls (both direct and proximity-based)
 * 
 * MESSAGE TYPES HANDLED:
 * - join: Join a virtual space with authentication
 * - move: Move within the current space
 * - leave: Leave the current space
 * - chat-join/message/leave: Chat room operations
 * - video-call-signaling/end: Direct video calls
 * - proximity-*: Proximity-based video call operations
 * - authenticate: Pre-authenticate before joining
 * - heartbeat: Connection health checks
 * 
 * COORDINATE SYSTEM:
 * - All coordinates are in GRID units (not pixels)
 * - Grid size is 20 pixels per unit
 * - Example: Grid (10, 15) = Pixel (200, 300)
 * 
 * @author GitHub Copilot
 * @see docs/system-design/websocket-architecture.md
 */

import { Roommanager } from './Roommanager';
import { outgoingmessage, IncomingMessage, JoinPayload, MovePayload, UserPosition } from './types';
import { WebSocket } from 'ws';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { jwt_password } from './config';
import client from '@repo/db';
import { RedisService } from './RedisService';
import { KafkaChatService } from './KafkaChatService';
import { VideoCallManager } from './VideoCallManager';

/**
 * Generates a random unique identifier for user connections
 * 
 * @param length - Length of the ID (default: 15)
 * @returns A random alphanumeric string with special characters
 */
function getRandomIdForUser(length = 15): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$%&*';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * User class - Represents a single WebSocket connection
 * 
 * Each instance manages:
 * - WebSocket connection lifecycle
 * - User authentication state
 * - Position within virtual spaces
 * - Active chat room subscriptions
 * - Video call state
 */
export class User {
    /** Unique connection ID (not user ID - changes each connection) */
    public id: string;
    
    /** ID of the space the user is currently in */
    private spaceId?: string;
    
    /** User's account ID from database */
    private userId?: string;
    
    /** User's display name */
    private username?: string;
    
    /** Current X position in grid coordinates */
    private x: number;
    
    /** Current Y position in grid coordinates */
    private y: number;
    
    /** Whether the connection is still active */
    private isAlive: boolean = true;
    
    /** Set of chatroom IDs this user is currently subscribed to */
    private activeChatrooms: Set<string> = new Set();
    
    /** Redis service for pub/sub and caching */
    private redisService: RedisService;
    
    /** Kafka service for message persistence */
    private kafkaService: KafkaChatService;
    
    /** Video call manager for WebRTC coordination */
    private videoCallManager: VideoCallManager;

    /**
     * Creates a new User instance for a WebSocket connection
     * 
     * @param ws - The WebSocket connection to wrap
     */
    constructor(private ws: WebSocket) {
        this.id = getRandomIdForUser();
        this.x = 0;
        this.y = 0;
        this.redisService = RedisService.getInstance();
        this.kafkaService = KafkaChatService.getInstance();
        this.videoCallManager = VideoCallManager.getInstance();
    }

    /**
     * Initializes WebSocket event handlers
     * 
     * Sets up handlers for:
     * - message: Process incoming messages
     * - error: Log connection errors
     * - close: Clean up on disconnect
     * - pong: Heartbeat response
     */
    public initHandlers(): void {
        // Handle incoming messages
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

        // Log errors but don't crash
        this.ws.on('error', (error) => {
            console.error(`WebSocket error for user ${this.id}:`, error);
        });

        // Clean up on disconnect
        this.ws.on('close', () => {
            this.isAlive = false;
            this.destroy();
        });

        // Heartbeat detection for broken connections
        this.ws.on('pong', () => {
            console.log(`Heartbeat received from user ${this.id}`);
        });
    }

    /**
     * Main message router - dispatches messages to appropriate handlers
     * 
     * This switch statement routes each message type to its handler.
     * IMPORTANT: Each case should appear only ONCE to avoid duplicate handling.
     * 
     * @param parseData - The parsed incoming message
     */
    private async handleMessage(parseData: IncomingMessage): Promise<void> {
        console.log(`📨 [MESSAGE RECEIVED] User ${this.username || this.id} sent message type: ${parseData.type}`, parseData.payload);

        switch (parseData.type) {
            // ================================================================
            // SPACE MANAGEMENT
            // ================================================================
            
            case 'join':
                // User wants to join a virtual space
                await this.handleJoin(parseData.payload as JoinPayload);
                break;
                
            case 'move':
                // User wants to move within their current space
                console.log(`🚶 [MOVE MESSAGE] Processing move request for ${this.username || this.id}`);
                await this.handleMove(parseData.payload as MovePayload);
                break;
                
            case 'leave':
                // User wants to leave their current space
                console.log(`👋 [LEAVE MESSAGE] Processing leave request for ${this.username || this.id}`);
                this.handleLeave();
                break;
            
            // ================================================================
            // CHAT OPERATIONS
            // ================================================================
            
            case 'chat-join':
                // User wants to join a chat room
                console.log(`💬 [CHAT JOIN] Processing chat join for ${this.username || this.id}`);
                await this.handleChatJoin(parseData.payload);
                break;
                
            case 'chat-message':
                // User is sending a chat message
                console.log(`💬 [CHAT MESSAGE] Processing chat message from ${this.username || this.id}`);
                await this.handleChatMessage(parseData.payload);
                break;
                
            case 'chat-leave':
                // User wants to leave a chat room
                console.log(`💬 [CHAT LEAVE] Processing chat leave for ${this.username || this.id}`);
                await this.handleChatLeave(parseData.payload);
                break;
            
            // ================================================================
            // DIRECT VIDEO CALLS
            // ================================================================
            
            case 'video-call-signaling':
                // WebRTC signaling for direct video calls
                console.log(`🎥 [VIDEO SIGNALING] Processing WebRTC signaling from ${this.username || this.id}`);
                this.handleVideoSignaling(parseData.payload);
                break;
                
            case 'video-call-end':
                // User ending a direct video call
                console.log(`🎥 [VIDEO END] Processing video call end from ${this.username || this.id}`);
                this.handleVideoCallEnd(parseData.payload);
                break;
            
            // ================================================================
            // PROXIMITY-BASED VIDEO CALLS
            // These are automatically triggered when users are within 2 tiles
            // ================================================================
            
            case 'proximity-video-call-signal':
                // WebRTC signaling for proximity-based video calls
                console.log(`🎥 [PROXIMITY SIGNALING] Processing proximity video signal from ${this.username || this.id}`);
                this.handleProximityVideoSignaling(parseData.payload);
                break;
                
            case 'proximity-position-update':
                // Position update for proximity detection
                console.log(`📍 [PROXIMITY POSITION] Processing position update from ${this.username || this.id}`);
                this.handleProximityPositionUpdate(parseData.payload);
                break;
                
            case 'proximity-video-call-ended':
                // User ending a proximity video call
                console.log(`🎥 [PROXIMITY END] Processing proximity call end from ${this.username || this.id}`);
                this.handleProximityVideoCallEnd(parseData.payload);
                break;
                
            case 'proximity-heartbeat':
                // Heartbeat for proximity video call health
                console.log(`💓 [PROXIMITY HEARTBEAT] Processing heartbeat from ${this.username || this.id}`);
                this.handleProximityHeartbeat(parseData.payload);
                break;
            
            // ================================================================
            // AUTHENTICATION & HEALTH
            // ================================================================
            
            case 'authenticate':
                // Pre-authentication before joining a space
                console.log(`🔐 [AUTHENTICATE] Processing authentication from connection ${this.id}`);
                await this.handleAuthenticate(parseData);
                break;
                
            case 'heartbeat':
                // Connection health check request
                console.log(`💓 [HEARTBEAT] Processing heartbeat from ${this.username || this.id}`);
                this.handleHeartbeat(parseData.payload);
                break;
                
            case 'heartbeat-response':
                // Response to our heartbeat (just acknowledge, no action needed)
                console.log(`💓 [HEARTBEAT RESPONSE] Received heartbeat response from ${this.username || this.id}`);
                break;
            
            // ================================================================
            // STATE REFRESH (BUG-029 FIX)
            // ================================================================
            
            case 'request-room-state':
                // Client requesting fresh room state (e.g., after tab becomes visible)
                // BUG-029 FIX: Send fresh user positions after tab visibility change
                console.log(`🔄 [STATE REFRESH] Processing room state request from ${this.username || this.id}`);
                await this.handleRequestRoomState(parseData.payload);
                break;
            
            // ================================================================
            // UNKNOWN MESSAGE TYPE
            // ================================================================
            
            default:
                console.log(`❓ [UNKNOWN MESSAGE] Invalid message type: ${parseData.type} from ${this.username || this.id}`);
                this.send({
                    type: 'error',
                    payload: { message: 'Invalid message type' }
                });
                break;
        }
    }

    /**
     * Handles a user joining a virtual space
     * 
     * This method:
     * 1. Validates the JWT authentication token
     * 2. Verifies the space exists in the database
     * 3. Calculates a spawn position (avoiding overlap with other users)
     * 4. Adds the user to the room manager
     * 5. Broadcasts the join event to other users
     * 6. Sends the current user list to the joining user
     * 
     * @param payload - Contains spaceId and authentication token
     */
    private async handleJoin(payload: JoinPayload): Promise<void> {
        const { spaceId, token } = payload;
        
        console.log(`🔐 [AUTH] Processing join request for space: ${spaceId}`);
        console.log(`🔑 [AUTH] Token provided: ${token ? 'Yes' : 'No'}`);

        // Validate token is provided
        if (!token) {
            console.log('❌ [AUTH] No token provided');
            this.ws.close(1008, 'No token provided');
            return;
        }

        try {
            console.log(`🔍 [AUTH] Verifying JWT token with secret: ${jwt_password.substring(0, 5)}...`);
            
            // Step 1: Verify JWT token and extract user info
            const decoded = jwt.verify(token, jwt_password) as JwtPayload;
            const userId = decoded.userId;
            const username = decoded.username;
            
            console.log(`✅ [AUTH] Token verified successfully. UserId: ${userId}, Username: ${username}`);

            if (!userId || !username) {
                console.log(`❌ [AUTH] Missing user data in token. UserId: ${userId}, Username: ${username}`);
                this.ws.close(1008, 'Invalid token - missing user data');
                return;
            }

            // Store authenticated user info
            this.userId = userId;
            this.username = username;
            
            console.log(`🏢 [SPACE] Checking if space exists: ${spaceId}`);

            // Step 2: Verify the space exists in the database
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
            
            // Step 3: Calculate spawn position
            // We use a grid pattern to avoid users spawning on top of each other
            const currentUserCount = Roommanager.getInstance().getUserCount(spaceId);
            const spawnX = 2 + (currentUserCount % 5); // Spawn in columns of 5
            const spawnY = 2 + Math.floor(currentUserCount / 5); // New row every 5 users
            
            // Ensure spawn position is within space boundaries
            // Convert pixel dimensions to grid coordinates
            const maxGridX = Math.floor((space.width || 800) / 20) - 1;
            const maxGridY = Math.floor((space.height || 600) / 20) - 1;
            
            this.x = Math.min(spawnX, maxGridX);
            this.y = Math.min(spawnY, maxGridY);

            console.log(`🎯 [SPAWN] User ${username} (#${currentUserCount}) spawned at fixed grid position (${this.x}, ${this.y}) in space ${spaceId} with boundaries ${maxGridX}x${maxGridY}`);

            // Step 4: Add user to room manager (handles Redis update internally)
            await Roommanager.getInstance().addUser(spaceId, this);

            // Step 5: Broadcast join event to other users in the space
            Roommanager.getInstance().broadCast({
                type: 'user-joined-space',
                payload: {
                    userId: this.userId,
                    username: this.username,
                    x: this.x,
                    y: this.y,
                }
            }, this, this.spaceId);

            // Step 6: Get all users for the joining user
            // We merge users from both memory (current connections) and Redis (for recovery)
            const currentUsers = Roommanager.getInstance().getSpaceUsers(spaceId);
            const redisUsers = await Roommanager.getInstance().getSpaceUsersFromRedis(spaceId);
            
            // Create a map to deduplicate users
            const userMap = new Map<string, any>();
            
            // Add current connected users from memory (these are authoritative)
            currentUsers
                .filter(user => user.id !== this.id) // Exclude self
                .forEach(user => {
                    const uid = user.getUserId();
                    if (uid) {
                        userMap.set(uid, {
                            userId: uid,
                            username: user.getUsername(),
                            x: user.getX(),
                            y: user.getY(),
                        });
                    }
                });
            
            // Add users from Redis if not already in memory (handles recovery case)
            redisUsers
                .filter(user => user.userId !== this.userId) // Exclude self
                .forEach(user => {
                    if (!userMap.has(user.userId)) {
                        userMap.set(user.userId, {
                            userId: user.userId,
                            username: user.username,
                            x: user.x,
                            y: user.y,
                        });
                    }
                });
            
            const allUsers = Array.from(userMap.values());
            
            console.log(`📊 [SPACE JOIN] Sending ${allUsers.length} users to ${username}: ${currentUsers.length} from memory, ${redisUsers.length} from Redis`);
            
            // Send join confirmation with user list and spawn position
            this.send({
                type: 'space-joined',
                payload: {
                    spawn: {
                        x: this.x,
                        y: this.y,
                    },
                    users: allUsers
                }
            });

            console.log(`User ${this.username} (${this.userId}) joined space ${spaceId} at position (${this.x}, ${this.y})`);

        } catch (error) {
            console.error('❌ [AUTH ERROR] Error during join:', error);
            console.error('❌ [AUTH ERROR] Error name:', error instanceof Error ? error.name : 'Unknown');
            console.error('❌ [AUTH ERROR] Error message:', error instanceof Error ? error.message : String(error));
            console.error('❌ [AUTH ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            
            // Provide specific error messages based on error type
            if (error instanceof jwt.JsonWebTokenError) {
                console.error('❌ [JWT ERROR] Invalid JWT token:', error.message);
                this.ws.close(1008, `JWT Error: ${error.message}`);
            } else if (error instanceof jwt.TokenExpiredError) {
                console.error('❌ [JWT ERROR] Token expired:', error.message);
                this.ws.close(1008, 'Token expired');
            } else {
                const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
                console.error('❌ [AUTH ERROR] General authentication error:', errorMessage);
                this.ws.close(1008, `Authentication failed: ${errorMessage}`);
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
            
            // Update position in Redis
            if (this.userId) {
                await Roommanager.getInstance().updateUserPosition(this.spaceId, this.userId, moveX, moveY);
            }

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

        // BUG FIX: Frontend sends position nested inside payload.position object
        // Extract correctly from the nested structure
        const position = payload.position || payload;
        const { x, y, z } = position;
        
        // Update user position if valid grid coordinates are provided
        if (typeof x === 'number' && typeof y === 'number') {
            // Validate that coordinates are reasonable grid values (not pixel values)
            // Grid coordinates should typically be small integers (0-40 for an 800px space)
            const maxReasonableGridCoord = 100; // Reasonable upper bound for grid coordinate
            if (x <= maxReasonableGridCoord && y <= maxReasonableGridCoord) {
                this.x = x;
                this.y = y;
                console.log(`📍 [PROXIMITY POSITION] User ${this.username} updated position to grid (${this.x}, ${this.y})`);
            } else {
                console.log(`⚠️ [PROXIMITY POSITION] Rejected large coordinates (${x}, ${y}) - likely pixels sent instead of grid`);
            }
        } else {
            console.log(`⚠️ [PROXIMITY POSITION] Invalid position data received:`, payload);
        }

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

        const { timestamp } = payload;
        
        // BUG FIX: Do NOT update position from heartbeat!
        // The frontend sends pixel coordinates, but backend stores grid coordinates.
        // Position should only be updated through the 'move' message which properly
        // validates and stores grid coordinates. The heartbeat position was corrupting
        // the user's actual position (e.g., pixel 1200 being stored as grid 1200,
        // which would be 24000 pixels when converted back).
        // 
        // If we need the position for proximity calculations, we already have it
        // stored correctly as this.x and this.y (in grid coordinates).

        // Send heartbeat response
        this.send({
            type: 'proximity-heartbeat-response',
            payload: {
                timestamp: Date.now(),
                serverReceived: timestamp,
                // Send back the correct grid position for the frontend to verify
                position: { x: this.x, y: this.y }
            }
        });

        // Check proximity for video calls using the correct server-side position
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

    /**
     * BUG-029 FIX: Handle request for fresh room state
     * 
     * Called when client needs to refresh state, typically after:
     * - Tab becoming visible after being hidden
     * - Network reconnection
     * - Suspected stale state
     * 
     * Sends back the current list of users in the space with their latest positions.
     * 
     * @param payload - Contains spaceId to get state for
     */
    private async handleRequestRoomState(payload: { spaceId?: string }): Promise<void> {
        const targetSpaceId = payload?.spaceId || this.spaceId;
        
        if (!targetSpaceId) {
            console.log(`⚠️ [STATE REFRESH] No space ID for state request`);
            this.send({
                type: 'room-state-error',
                payload: { message: 'Not in a space' }
            });
            return;
        }
        
        // Get current users from room manager using singleton
        const currentUsers = Roommanager.getInstance().getUsersInSpace(targetSpaceId);
        
        // Map to user position data, excluding self
        const userPositions: UserPosition[] = currentUsers
            .filter(user => user.getUserId() !== this.userId)
            .map(user => {
                const pos = user.getPosition();
                return {
                    userId: user.getUserId() || '',
                    username: user.getUsername() || '',
                    x: pos?.x || 0,
                    y: pos?.y || 0
                };
            })
            .filter(u => u.userId !== ''); // Filter out invalid entries
        
        console.log(`📤 [STATE REFRESH] Sending ${userPositions.length} users to ${this.username}`);
        
        // Send fresh state to client
        this.send({
            type: 'room-state-refresh',
            payload: {
                spaceId: targetSpaceId,
                users: userPositions,
                timestamp: Date.now()
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