import { User } from './User';
import { Roommanager } from './Roommanager';

interface VideoCallSession {
    callId: string;
    participants: [string, string]; // [userId1, userId2]
    spaceId: string;
    startedAt: Date;
    status: 'active' | 'ended';
}

interface ProximityVideoCall {
    users: Set<string>; // userIds in proximity
    spaceId: string;
    callId: string;
}

export class VideoCallManager {
    private static instance: VideoCallManager;
    private activeCalls: Map<string, VideoCallSession> = new Map(); // callId -> session
    private userCalls: Map<string, string> = new Map(); // userId -> callId
    private proximityGroups: Map<string, ProximityVideoCall> = new Map(); // spaceId -> proximity group
    
    private constructor() {}

    static getInstance(): VideoCallManager {
        if (!this.instance) {
            this.instance = new VideoCallManager();
        }
        return this.instance;
    }

    /**
     * Check proximity and manage video calls when users move
     */
    public handleUserMovement(user: User): void {
        const userId = user.getUserId();
        const spaceId = user.getSpaceId();
        
        if (!userId || !spaceId) return;

        // Get all users in the same space
        const spaceUsers = Roommanager.getInstance().getSpaceUsers(spaceId);
        const nearbyUsers = this.findNearbyUsers(user, spaceUsers);
        
        console.log(`🎥 [VIDEO CALL] User ${user.getUsername()} has ${nearbyUsers.length} nearby users`);

        // Handle proximity-based video calls
        this.handleProximityVideoCall(user, nearbyUsers, spaceId);
    }

    /**
     * Find users within 2-tile radius
     */
    private findNearbyUsers(currentUser: User, allUsers: User[]): User[] {
        const currentX = currentUser.getX();
        const currentY = currentUser.getY();
        const currentUserId = currentUser.getUserId();
        
        return allUsers.filter(user => {
            const userId = user.getUserId();
            if (!userId || userId === currentUserId) return false;
            
            const userX = user.getX();
            const userY = user.getY();
            
            // Calculate distance (2-tile radius = distance <= 2)
            const distance = Math.abs(currentX - userX) + Math.abs(currentY - userY);
            return distance <= 2;
        });
    }

    /**
     * Handle automatic proximity-based video calls
     */
    private handleProximityVideoCall(currentUser: User, nearbyUsers: User[], spaceId: string): void {
        const currentUserId = currentUser.getUserId();
        if (!currentUserId) return;

        // Check if user is already in a call
        const existingCallId = this.userCalls.get(currentUserId);
        
        if (nearbyUsers.length === 0) {
            // No nearby users - end any existing call
            if (existingCallId) {
                this.endCall(existingCallId, 'proximity_lost');
            }
            return;
        }

        // If user is already in a call, check if they should stay or switch
        if (existingCallId) {
            const existingCall = this.activeCalls.get(existingCallId);
            if (existingCall) {
                // Check if any of the current participants are still nearby
                const otherParticipant = existingCall.participants.find(id => id !== currentUserId);
                const isOtherParticipantNearby = nearbyUsers.some(user => user.getUserId() === otherParticipant);
                
                if (isOtherParticipantNearby) {
                    // Stay in current call
                    console.log(`🎥 [VIDEO CALL] User ${currentUser.getUsername()} staying in current call`);
                    return;
                } else {
                    // End current call and start new one
                    this.endCall(existingCallId, 'proximity_changed');
                }
            }
        }

        // Find the best user to call (closest one not already in a call)
        const availableUsers = nearbyUsers.filter(user => {
            const userId = user.getUserId();
            return userId && !this.userCalls.has(userId);
        });

        if (availableUsers.length === 0) {
            console.log(`🎥 [VIDEO CALL] No available users for ${currentUser.getUsername()}`);
            return;
        }

        // Start call with the first available user (you could implement priority logic here)
        const targetUser = availableUsers[0];
        this.startProximityCall(currentUser, targetUser, spaceId);
    }

    /**
     * Start a proximity-based video call
     */
    private startProximityCall(user1: User, user2: User, spaceId: string): void {
        const user1Id = user1.getUserId();
        const user2Id = user2.getUserId();
        
        if (!user1Id || !user2Id) return;

        const callId = this.generateCallId();
        
        const callSession: VideoCallSession = {
            callId,
            participants: [user1Id, user2Id],
            spaceId,
            startedAt: new Date(),
            status: 'active'
        };

        // Store call data
        this.activeCalls.set(callId, callSession);
        this.userCalls.set(user1Id, callId);
        this.userCalls.set(user2Id, callId);

        console.log(`🎥 [VIDEO CALL] Starting proximity call between ${user1.getUsername()} and ${user2.getUsername()}`);

        // Send call start event to both users
        const callStartPayload = {
            type: 'video-call-start',
            payload: {
                callId,
                participants: [
                    {
                        userId: user1Id,
                        username: user1.getUsername(),
                        x: user1.getX(),
                        y: user1.getY()
                    },
                    {
                        userId: user2Id,
                        username: user2.getUsername(),
                        x: user2.getX(),
                        y: user2.getY()
                    }
                ],
                isProximityCall: true
            }
        };

        user1.send(callStartPayload);
        user2.send(callStartPayload);

        // Broadcast to other users in space that these users are now in a call
        Roommanager.getInstance().broadCast({
            type: 'users-in-video-call',
            payload: {
                userIds: [user1Id, user2Id],
                callId
            }
        }, user1, spaceId);
    }

    /**
     * Handle WebRTC signaling between users
     */
    public handleSignaling(fromUser: User, payload: any): void {
        const fromUserId = fromUser.getUserId();
        if (!fromUserId) return;

        console.log(`🎥 [SIGNALING] Received signaling from ${fromUser.getUsername()} (${fromUserId})`);
        console.log(`🎥 [SIGNALING] Payload:`, payload);

        const callId = this.userCalls.get(fromUserId);
        if (!callId) {
            console.log(`🎥 [SIGNALING] User ${fromUser.getUsername()} not in any call`);
            return;
        }

        const callSession = this.activeCalls.get(callId);
        if (!callSession) {
            console.log(`🎥 [SIGNALING] Call session not found for callId: ${callId}`);
            return;
        }

        // Find the other participant
        const otherUserId = callSession.participants.find(id => id !== fromUserId);
        if (!otherUserId) {
            console.log(`🎥 [SIGNALING] Other participant not found in call session`);
            return;
        }

        console.log(`🎥 [SIGNALING] Call participants:`, callSession.participants);
        console.log(`🎥 [SIGNALING] From: ${fromUserId}, To: ${otherUserId}`);

        // Find the other user and send signaling data
        const spaceUsers = Roommanager.getInstance().getSpaceUsers(callSession.spaceId);
        const otherUser = spaceUsers.find(user => user.getUserId() === otherUserId);
        
        if (otherUser) {
            const signalingMessage = {
                type: 'video-call-signaling',
                payload: {
                    callId,
                    fromUserId,
                    signalingData: payload
                }
            };
            
            console.log(`🎥 [SIGNALING] Forwarding to ${otherUser.getUsername()} (${otherUserId}):`, signalingMessage);
            otherUser.send(signalingMessage);
            
            console.log(`🎥 [SIGNALING] Successfully forwarded signaling from ${fromUser.getUsername()} to ${otherUser.getUsername()}`);
        } else {
            console.log(`🎥 [SIGNALING] Other user ${otherUserId} not found in space`);
        }
    }

    /**
     * End a video call
     */
    public endCall(callId: string, reason: string = 'user_ended'): void {
        const callSession = this.activeCalls.get(callId);
        if (!callSession) return;

        console.log(`🎥 [VIDEO CALL] Ending call ${callId} - reason: ${reason}`);

        // Update call status
        callSession.status = 'ended';

        // Remove user mappings
        callSession.participants.forEach(userId => {
            this.userCalls.delete(userId);
        });

        // Notify participants
        const spaceUsers = Roommanager.getInstance().getSpaceUsers(callSession.spaceId);
        callSession.participants.forEach(userId => {
            const user = spaceUsers.find(u => u.getUserId() === userId);
            if (user) {
                user.send({
                    type: 'video-call-end',
                    payload: {
                        callId,
                        reason
                    }
                });
            }
        });

        // Broadcast to space that call ended
        Roommanager.getInstance().broadCast({
            type: 'video-call-ended',
            payload: {
                callId,
                userIds: callSession.participants
            }
        }, spaceUsers[0], callSession.spaceId);

        // Remove call session
        this.activeCalls.delete(callId);
    }

    /**
     * Handle user disconnection
     */
    public handleUserDisconnect(userId: string): void {
        const callId = this.userCalls.get(userId);
        if (callId) {
            this.endCall(callId, 'user_disconnected');
        }
    }

    /**
     * Get active call for user
     */
    public getUserCall(userId: string): VideoCallSession | null {
        const callId = this.userCalls.get(userId);
        return callId ? this.activeCalls.get(callId) || null : null;
    }

    /**
     * Check if user is in a video call
     */
    public isUserInCall(userId: string): boolean {
        return this.userCalls.has(userId);
    }

    /**
     * Generate unique call ID
     */
    private generateCallId(): string {
        return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get statistics
     */
    public getStats(): {
        activeCalls: number;
        totalUsers: number;
        callSessions: Array<{
            callId: string;
            participants: string[];
            duration: number;
        }>;
    } {
        const now = new Date();
        const callSessions = Array.from(this.activeCalls.values()).map(call => ({
            callId: call.callId,
            participants: call.participants,
            duration: now.getTime() - call.startedAt.getTime()
        }));

        return {
            activeCalls: this.activeCalls.size,
            totalUsers: this.userCalls.size,
            callSessions
        };
    }

    /**
     * Cleanup disconnected calls
     */
    public cleanup(): void {
        const now = new Date();
        const expiredCalls: string[] = [];

        // Find calls that have been active for too long without activity
        this.activeCalls.forEach((call, callId) => {
            const duration = now.getTime() - call.startedAt.getTime();
            // End calls that have been active for more than 1 hour
            if (duration > 3600000) {
                expiredCalls.push(callId);
            }
        });

        expiredCalls.forEach(callId => {
            this.endCall(callId, 'timeout');
        });

        if (expiredCalls.length > 0) {
            console.log(`🎥 [CLEANUP] Ended ${expiredCalls.length} expired video calls`);
        }
    }
}