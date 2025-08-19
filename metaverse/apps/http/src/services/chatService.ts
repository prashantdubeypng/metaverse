import client from '@repo/db';
import { redisChatService, type MessageInfo, type JoinRequestData, type InvitationData } from './redis';

export interface JoinChatroomResult {
    success: boolean;
    message: string;
    requiresApproval?: boolean;
    requestId?: string;
}

export interface MemberInfo {
    id: string;
    username: string;
    role: string;
    joinedAt: Date;
    isActive: boolean;
}

export interface JoinRequestInfo {
    id: string;
    userId: string;
    username: string;
    message?: string;
    requestedAt: Date;
}

export interface InvitationInfo {
    id: string;
    chatroomId: string;
    chatroomName: string;
    invitedBy: string;
    inviterUsername: string;
    message?: string;
    createdAt: Date;
    expiresAt: Date;
}

export class ChatService {
    // Join chatroom logic
    async joinChatroom(chatroomId: string, userId: string, message?: string): Promise<JoinChatroomResult> {
        try {
            // Check if chatroom exists
            const chatroom = await client.chatroom.findUnique({
                where: { id: chatroomId },
                include: {
                    members: {
                        where: { userId: userId }
                    }
                }
            });

            if (!chatroom) {
                return {
                    success: false,
                    message: 'Chatroom not found'
                };
            }

            // Check if user is already a member
            if (chatroom.members.length > 0) {
                return {
                    success: false,
                    message: 'You are already a member of this chatroom'
                };
            }

            // For private chatrooms, create a join request
            if (chatroom.isPrivate) {
                // Check if there's already a pending request
                const existingRequest = await client.joinRequest.findUnique({
                    where: {
                        userId_chatroomId: {
                            userId: userId,
                            chatroomId: chatroomId
                        }
                    }
                });

                if (existingRequest) {
                    if (existingRequest.status === 'PENDING') {
                        return {
                            success: false,
                            message: 'You already have a pending join request for this chatroom'
                        };
                    } else if (existingRequest.status === 'REJECTED') {
                        return {
                            success: false,
                            message: 'Your join request was rejected. Please contact the chatroom owner.'
                        };
                    }
                }

                // Create join request
                const joinRequest = await client.joinRequest.create({
                    data: {
                        userId: userId,
                        chatroomId: chatroomId,
                        message: message
                    },
                    include: {
                        user: {
                            select: {
                                username: true
                            }
                        }
                    }
                });

                // Cache the join request in Redis for fast access
                const requestData: JoinRequestData = {
                    id: joinRequest.id,
                    userId: joinRequest.userId,
                    username: joinRequest.user.username,
                    chatroomId: joinRequest.chatroomId,
                    message: joinRequest.message || undefined,
                    requestedAt: joinRequest.requestedAt.getTime(),
                    status: 'PENDING'
                };

                await redisChatService.cacheJoinRequest(requestData);
                
                // Notify chatroom owners/admins in real-time
                await redisChatService.notifyJoinRequest(chatroomId, requestData);

                return {
                    success: false,
                    message: 'Join request submitted. Waiting for approval from chatroom owner or admin.',
                    requiresApproval: true,
                    requestId: joinRequest.id
                };
            }

            // Add user to public chatroom directly
            await client.chatroomMember.create({
                data: {
                    userId: userId,
                    chatroomId: chatroomId,
                    role: 'MEMBER'
                }
            });

            // Update Redis cache
            await redisChatService.addUserToChatroom(chatroomId, userId, 'MEMBER');

            return {
                success: true,
                message: 'Successfully joined chatroom'
            };

        } catch (error) {
            console.error('Error joining chatroom:', error);
            throw error;
        }
    }

    // Leave chatroom logic
    async leaveChatroom(chatroomId: string, userId: string): Promise<void> {
        try {
            // Check if user is the owner
            const chatroom = await client.chatroom.findUnique({
                where: { id: chatroomId },
                select: { creatorId: true }
            });

            if (chatroom?.creatorId === userId) {
                throw new Error('Chatroom owner cannot leave. Transfer ownership or delete the chatroom.');
            }

            // Remove from database
            await client.chatroomMember.deleteMany({
                where: {
                    userId: userId,
                    chatroomId: chatroomId
                }
            });

            // Update Redis cache
            await redisChatService.removeUserFromChatroom(chatroomId, userId);

        } catch (error) {
            console.error('Error leaving chatroom:', error);
            throw error;
        }
    }

    // Validate username availability
    async validateUsername(username: string): Promise<boolean> {
        try {
            const existingUser = await client.user.findUnique({
                where: { username: username }
            });

            return !existingUser;
        } catch (error) {
            console.error('Error validating username:', error);
            throw error;
        }
    }

    // Sync chatroom from database to Redis
    async syncChatroomFromDB(chatroomId: string): Promise<void> {
        try {
            const chatroom = await client.chatroom.findUnique({
                where: { id: chatroomId },
                include: {
                    members: {
                        where: { isActive: true }
                    }
                }
            });

            if (!chatroom) return;

            // Cache chatroom info
            await redisChatService.createChatroom({
                id: chatroom.id,
                name: chatroom.name,
                description: chatroom.description || undefined,
                ownerId: chatroom.creatorId,
                spaceId: chatroom.spaceId,
                isPrivate: chatroom.isPrivate,
                createdAt: chatroom.createdAt.getTime()
            });

            // Cache members
            for (const member of chatroom.members) {
                await redisChatService.addUserToChatroom(
                    chatroomId,
                    member.userId,
                    member.role
                );
            }

        } catch (error) {
            console.error('Error syncing chatroom from DB:', error);
            throw error;
        }
    }

    // Get chatroom members with user info
    async getChatroomMembersInfo(chatroomId: string): Promise<MemberInfo[]> {
        try {
            const members = await client.chatroomMember.findMany({
                where: {
                    chatroomId: chatroomId,
                    isActive: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                },
                orderBy: {
                    joinedAt: 'asc'
                }
            });

            // Get active status from Redis
            const activeUsers = await redisChatService.getActiveUsers(chatroomId);
            const activeUserSet = new Set(activeUsers);

            return members.map(member => ({
                id: member.user.id,
                username: member.user.username,
                role: member.role,
                joinedAt: member.joinedAt,
                isActive: activeUserSet.has(member.user.id)
            }));

        } catch (error) {
            console.error('Error getting chatroom members info:', error);
            throw error;
        }
    }

    // Get recent messages with user info
    async getRecentMessagesWithInfo(chatroomId: string, limit: number = 50): Promise<MessageInfo[]> {
        try {
            // Try Redis first
            const cachedMessages = await redisChatService.getRecentMessages(chatroomId, limit);
            
            if (cachedMessages.length > 0) {
                return cachedMessages;
            }

            // Fallback to database
            const messages = await client.message.findMany({
                where: { chatroomId: chatroomId },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit
            });

            const messageInfos: MessageInfo[] = messages.reverse().map(msg => ({
                id: msg.id,
                content: msg.content,
                userId: msg.user.id,
                username: msg.user.username,
                chatroomId: msg.chatroomId,
                timestamp: msg.createdAt.getTime()
            }));

            // Cache the messages
            for (const msgInfo of messageInfos) {
                await redisChatService.cacheMessage(msgInfo);
            }

            return messageInfos;

        } catch (error) {
            console.error('Error getting recent messages:', error);
            throw error;
        }
    }

    // Save message to database and cache
    async saveMessage(content: string, userId: string, chatroomId: string): Promise<MessageInfo> {
        try {
            // Save to database
            const message = await client.message.create({
                data: {
                    content: content,
                    userId: userId,
                    chatroomId: chatroomId
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            });

            const messageInfo: MessageInfo = {
                id: message.id,
                content: message.content,
                userId: message.user.id,
                username: message.user.username,
                chatroomId: message.chatroomId,
                timestamp: message.createdAt.getTime()
            };

            // Cache the message
            await redisChatService.cacheMessage(messageInfo);

            return messageInfo;

        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    // Get user's chatrooms
    async getUserChatrooms(userId: string): Promise<any[]> {
        try {
            const userChatrooms = await client.chatroomMember.findMany({
                where: {
                    userId: userId,
                    isActive: true
                },
                include: {
                    chatroom: {
                        include: {
                            space: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            _count: {
                                select: {
                                    members: {
                                        where: { isActive: true }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    joinedAt: 'desc'
                }
            });

            return userChatrooms.map(membership => ({
                id: membership.chatroom.id,
                name: membership.chatroom.name,
                description: membership.chatroom.description,
                isPrivate: membership.chatroom.isPrivate,
                space: membership.chatroom.space,
                memberCount: membership.chatroom._count.members,
                userRole: membership.role,
                joinedAt: membership.joinedAt,
                createdAt: membership.chatroom.createdAt
            }));

        } catch (error) {
            console.error('Error getting user chatrooms:', error);
            throw error;
        }
    }

    async processJoinRequest(requestId: string, action: 'approve' | 'reject', processedBy: string, message?: string): Promise<void> {
        try {
            // Get request from Redis first
            let requestData = await redisChatService.getJoinRequest(requestId);
            
            if (!requestData) {
                // Fallback to database
                const request = await client.joinRequest.findUnique({
                    where: { id: requestId },
                    include: { 
                        chatroom: { select: { name: true } },
                        user: { select: { username: true } }
                    }
                });

                if (!request || request.status !== 'PENDING') {
                    throw new Error('Invalid or already processed join request');
                }

                requestData = {
                    id: request.id,
                    userId: request.userId,
                    username: request.user.username,
                    chatroomId: request.chatroomId,
                    message: request.message || undefined,
                    requestedAt: request.requestedAt.getTime(),
                    status: 'PENDING'
                };
            }

            if (requestData.status !== 'PENDING') {
                throw new Error('Request already processed');
            }

            if (action === 'approve') {
                // Add user to chatroom
                await client.chatroomMember.create({
                    data: {
                        userId: requestData.userId,
                        chatroomId: requestData.chatroomId,
                        role: 'MEMBER',
                        invitedBy: processedBy
                    }
                });

                // Update Redis cache
                await redisChatService.addUserToChatroom(requestData.chatroomId, requestData.userId, 'MEMBER');
            }

            // Update request status in database
            await client.joinRequest.update({
                where: { id: requestId },
                data: {
                    status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                    processedAt: new Date(),
                    processedBy: processedBy
                }
            });

            // Update Redis cache
            await redisChatService.updateJoinRequestStatus(requestId, action === 'approve' ? 'APPROVED' : 'REJECTED');

            // Notify user about the decision
            const chatroomInfo = await redisChatService.getChatroomInfo(requestData.chatroomId);
            await redisChatService.notifyRequestProcessed(
                requestData.userId, 
                requestId, 
                action === 'approve' ? 'APPROVED' : 'REJECTED',
                chatroomInfo?.name || 'Unknown Chatroom'
            );

        } catch (error) {
            console.error('Error processing join request:', error);
            throw error;
        }
    }

    // Invitation management methods (Redis-first approach)
    async createInvitation(chatroomId: string, userId: string, invitedBy: string, message?: string, expiresInHours: number = 24): Promise<string> {
        try {
            // Check if user is already a member
            const existingMember = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: userId,
                        chatroomId: chatroomId
                    }
                }
            });

            if (existingMember) {
                throw new Error('User is already a member of this chatroom');
            }

            // Check Redis for existing pending invitation
            const userInvitations = await redisChatService.getUserInvitations(userId);
            const existingInvitation = userInvitations.find(inv => inv.chatroomId === chatroomId);

            if (existingInvitation && existingInvitation.status === 'PENDING') {
                throw new Error('User already has a pending invitation to this chatroom');
            }

            // Create invitation in database
            const invitation = await client.invitation.create({
                data: {
                    userId: userId,
                    chatroomId: chatroomId,
                    invitedBy: invitedBy,
                    message: message,
                    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
                },
                include: {
                    user: { select: { username: true } },
                    chatroom: { select: { name: true } },
                    inviter: { select: { username: true } }
                }
            });

            // Cache invitation in Redis
            const invitationData: InvitationData = {
                id: invitation.id,
                userId: invitation.userId,
                username: invitation.user.username,
                chatroomId: invitation.chatroomId,
                chatroomName: invitation.chatroom.name,
                invitedBy: invitation.invitedBy,
                inviterUsername: invitation.inviter.username,
                message: invitation.message || undefined,
                createdAt: invitation.createdAt.getTime(),
                expiresAt: invitation.expiresAt.getTime(),
                status: 'PENDING'
            };

            await redisChatService.cacheInvitation(invitationData);

            // Notify user about the invitation
            await redisChatService.notifyInvitation(userId, invitationData);

            return invitation.id;

        } catch (error) {
            console.error('Error creating invitation:', error);
            throw error;
        }
    }

    async getUserInvitations(userId: string): Promise<InvitationInfo[]> {
        try {
            // Get from Redis first for fast access
            const cachedInvitations = await redisChatService.getUserInvitations(userId);
            
            if (cachedInvitations.length > 0) {
                return cachedInvitations.map(inv => ({
                    id: inv.id,
                    chatroomId: inv.chatroomId,
                    chatroomName: inv.chatroomName,
                    invitedBy: inv.invitedBy,
                    inviterUsername: inv.inviterUsername,
                    message: inv.message,
                    createdAt: new Date(inv.createdAt),
                    expiresAt: new Date(inv.expiresAt)
                }));
            }

            // Fallback to database
            const invitations = await client.invitation.findMany({
                where: {
                    userId: userId,
                    status: 'PENDING',
                    expiresAt: {
                        gt: new Date()
                    }
                },
                include: {
                    chatroom: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    inviter: {
                        select: {
                            id: true,
                            username: true
                        }
                    },
                    user: {
                        select: {
                            username: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            // Cache invitations in Redis
            for (const invitation of invitations) {
                const invitationData: InvitationData = {
                    id: invitation.id,
                    userId: invitation.userId,
                    username: invitation.user.username,
                    chatroomId: invitation.chatroom.id,
                    chatroomName: invitation.chatroom.name,
                    invitedBy: invitation.inviter.id,
                    inviterUsername: invitation.inviter.username,
                    message: invitation.message || undefined,
                    createdAt: invitation.createdAt.getTime(),
                    expiresAt: invitation.expiresAt.getTime(),
                    status: 'PENDING'
                };
                await redisChatService.cacheInvitation(invitationData);
            }

            return invitations.map(invitation => ({
                id: invitation.id,
                chatroomId: invitation.chatroom.id,
                chatroomName: invitation.chatroom.name,
                invitedBy: invitation.inviter.id,
                inviterUsername: invitation.inviter.username,
                message: invitation.message || undefined,
                createdAt: invitation.createdAt,
                expiresAt: invitation.expiresAt
            }));

        } catch (error) {
            console.error('Error getting user invitations:', error);
            throw error;
        }
    }

    async respondToInvitation(invitationId: string, action: 'accept' | 'decline'): Promise<void> {
        try {
            // Get invitation from Redis first
            let invitationData = await redisChatService.getInvitation(invitationId);

            if (!invitationData) {
                // Fallback to database
                const invitation = await client.invitation.findUnique({
                    where: { id: invitationId },
                    include: {
                        user: { select: { username: true } },
                        chatroom: { select: { name: true } },
                        inviter: { select: { username: true } }
                    }
                });

                if (!invitation || invitation.status !== 'PENDING') {
                    throw new Error('Invalid or already processed invitation');
                }

                if (invitation.expiresAt <= new Date()) {
                    throw new Error('Invitation has expired');
                }

                invitationData = {
                    id: invitation.id,
                    userId: invitation.userId,
                    username: invitation.user.username,
                    chatroomId: invitation.chatroomId,
                    chatroomName: invitation.chatroom.name,
                    invitedBy: invitation.invitedBy,
                    inviterUsername: invitation.inviter.username,
                    message: invitation.message || undefined,
                    createdAt: invitation.createdAt.getTime(),
                    expiresAt: invitation.expiresAt.getTime(),
                    status: 'PENDING'
                };
            }

            if (invitationData.status !== 'PENDING') {
                throw new Error('Invitation already processed');
            }

            if (invitationData.expiresAt <= Date.now()) {
                throw new Error('Invitation has expired');
            }

            if (action === 'accept') {
                // Add user to chatroom
                await client.chatroomMember.create({
                    data: {
                        userId: invitationData.userId,
                        chatroomId: invitationData.chatroomId,
                        role: 'MEMBER',
                        invitedBy: invitationData.invitedBy
                    }
                });

                // Update Redis cache
                await redisChatService.addUserToChatroom(invitationData.chatroomId, invitationData.userId, 'MEMBER');
            }

            // Update invitation status in database
            await client.invitation.update({
                where: { id: invitationId },
                data: {
                    status: action === 'accept' ? 'ACCEPTED' : 'DECLINED',
                    respondedAt: new Date()
                }
            });

            // Update Redis cache
            await redisChatService.updateInvitationStatus(invitationId, action === 'accept' ? 'ACCEPTED' : 'DECLINED');

        } catch (error) {
            console.error('Error responding to invitation:', error);
            throw error;
        }
    }

    // Member management methods (Redis-enhanced)
    async promoteMember(chatroomId: string, userId: string, newRole: 'ADMIN' | 'MEMBER', actionBy: string): Promise<void> {
        try {
            // Check if user performing action is owner
            const chatroom = await client.chatroom.findUnique({
                where: { id: chatroomId },
                select: { creatorId: true }
            });

            if (!chatroom || chatroom.creatorId !== actionBy) {
                throw new Error('Only chatroom owner can promote/demote members');
            }

            // Update member role in database
            await client.chatroomMember.update({
                where: {
                    userId_chatroomId: {
                        userId: userId,
                        chatroomId: chatroomId
                    }
                },
                data: {
                    role: newRole
                }
            });

            // Update Redis cache immediately
            await redisChatService.updateMemberRole(chatroomId, userId, newRole);

        } catch (error) {
            console.error('Error promoting/demoting member:', error);
            throw error;
        }
    }

    async removeMember(chatroomId: string, userId: string, actionBy: string): Promise<void> {
        try {
            // Check permissions
            const chatroom = await client.chatroom.findUnique({
                where: { id: chatroomId },
                select: { creatorId: true }
            });

            const actionByMember = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: actionBy,
                        chatroomId: chatroomId
                    }
                }
            });

            if (!chatroom || !actionByMember) {
                throw new Error('Invalid chatroom or member');
            }

            // Only owner or admin can remove members
            if (chatroom.creatorId !== actionBy && actionByMember.role !== 'ADMIN') {
                throw new Error('Only chatroom owner or admin can remove members');
            }

            // Cannot remove the owner
            if (chatroom.creatorId === userId) {
                throw new Error('Cannot remove chatroom owner');
            }

            // Remove member from database
            await client.chatroomMember.delete({
                where: {
                    userId_chatroomId: {
                        userId: userId,
                        chatroomId: chatroomId
                    }
                }
            });

            // Update Redis cache immediately
            await redisChatService.removeUserFromChatroom(chatroomId, userId);

        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }

    // Helper method to get chatroom statistics from Redis
    async getChatroomStats(chatroomId: string): Promise<{ memberCount: number; activeCount: number }> {
        try {
            const [memberCount, activeCount] = await Promise.all([
                redisChatService.getMemberCount(chatroomId),
                redisChatService.getActiveUserCount(chatroomId)
            ]);

            return { memberCount, activeCount };
        } catch (error) {
            console.error('Error getting chatroom stats:', error);
            return { memberCount: 0, activeCount: 0 };
        }
    }

    // Background cleanup method (should be called periodically)
    async cleanupExpiredData(): Promise<void> {
        try {
            await redisChatService.cleanupExpiredInvitations();
        } catch (error) {
            console.error('Error cleaning up expired data:', error);
        }
    }

    // Send join request for private chatroom
    async sendJoinRequest(chatroomId: string, userId: string, message?: string): Promise<JoinChatroomResult> {
        try {
            // Check if chatroom exists
            const chatroom = await client.chatroom.findUnique({
                where: { id: chatroomId }
            });

            if (!chatroom) {
                return {
                    success: false,
                    message: 'Chatroom not found'
                };
            }

            if (!chatroom.isPrivate) {
                return {
                    success: false,
                    message: 'This chatroom is public, no request needed'
                };
            }

            // Check if already a member
            const existingMember = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: userId,
                        chatroomId: chatroomId
                    }
                }
            });

            if (existingMember) {
                return {
                    success: false,
                    message: 'You are already a member of this chatroom'
                };
            }

            // Check if request already exists
            const existingRequest = await client.joinRequest.findFirst({
                where: {
                    userId: userId,
                    chatroomId: chatroomId,
                    status: 'PENDING'
                }
            });

            if (existingRequest) {
                return {
                    success: false,
                    message: 'You already have a pending join request'
                };
            }

            // Create join request
            const joinRequest = await client.joinRequest.create({
                data: {
                    userId: userId,
                    chatroomId: chatroomId,
                    message: message || '',
                    status: 'PENDING'
                }
            });

            // Get user info for caching
            const user = await client.user.findUnique({
                where: { id: userId },
                select: { username: true }
            });

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Cache in Redis
            await redisChatService.cacheJoinRequest({
                id: joinRequest.id,
                userId: userId,
                username: user.username,
                chatroomId: chatroomId,
                message: message || '',
                requestedAt: joinRequest.requestedAt.getTime(),
                status: 'PENDING'
            });

            return {
                success: true,
                message: 'Join request sent successfully',
                requestId: joinRequest.id
            };

        } catch (error) {
            console.error('Error sending join request:', error);
            throw error;
        }
    }

    // Get pending join requests for a chatroom
    async getPendingJoinRequests(chatroomId: string): Promise<JoinRequestInfo[]> {
        try {
            const requests = await client.joinRequest.findMany({
                where: {
                    chatroomId: chatroomId,
                    status: 'PENDING'
                },
                include: {
                    user: {
                        select: {
                            username: true
                        }
                    }
                },
                orderBy: {
                    requestedAt: 'asc'
                }
            });

            return requests.map(request => ({
                id: request.id,
                userId: request.userId,
                username: request.user.username,
                message: request.message || undefined,
                requestedAt: request.requestedAt
            }));

        } catch (error) {
            console.error('Error fetching join requests:', error);
            throw error;
        }
    }

    // Handle join request (approve/reject)
    async handleJoinRequest(requestId: string, action: 'approve' | 'reject', actionBy: string): Promise<JoinChatroomResult> {
        try {
            const joinRequest = await client.joinRequest.findUnique({
                where: { id: requestId },
                include: {
                    user: true,
                    chatroom: true
                }
            });

            if (!joinRequest || joinRequest.status !== 'PENDING') {
                return {
                    success: false,
                    message: 'Join request not found or already processed'
                };
            }

            if (action === 'approve') {
                // Add user as member
                await client.chatroomMember.create({
                    data: {
                        userId: joinRequest.userId,
                        chatroomId: joinRequest.chatroomId,
                        role: 'MEMBER'
                    }
                });

                // Update Redis cache
                await redisChatService.addUserToChatroom(joinRequest.chatroomId, joinRequest.userId, 'MEMBER');
            }

            // Update request status
            await client.joinRequest.update({
                where: { id: requestId },
                data: {
                    status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                    processedBy: actionBy,
                    processedAt: new Date()
                }
            });

            // Remove from Redis cache
            await redisChatService.removeJoinRequest(requestId, joinRequest.chatroomId, joinRequest.userId);

            return {
                success: true,
                message: action === 'approve' ? 'Join request approved' : 'Join request rejected'
            };

        } catch (error) {
            console.error('Error handling join request:', error);
            throw error;
        }
    }

    // Send invitation to user
    async sendInvitation(chatroomId: string, invitedBy: string, username: string, message?: string): Promise<JoinChatroomResult> {
        try {
            // Find target user
            const targetUser = await client.user.findUnique({
                where: { username: username }
            });

            if (!targetUser) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Check if already a member
            const existingMember = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: targetUser.id,
                        chatroomId: chatroomId
                    }
                }
            });

            if (existingMember) {
                return {
                    success: false,
                    message: 'User is already a member'
                };
            }

            // Check if invitation already exists
            const existingInvitation = await client.invitation.findFirst({
                where: {
                    userId: targetUser.id,
                    chatroomId: chatroomId,
                    status: 'PENDING'
                }
            });

            if (existingInvitation) {
                return {
                    success: false,
                    message: 'User already has a pending invitation'
                };
            }

            // Create invitation (expires in 7 days)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const invitation = await client.invitation.create({
                data: {
                    userId: targetUser.id,
                    chatroomId: chatroomId,
                    invitedBy: invitedBy,
                    message: message || '',
                    expiresAt: expiresAt,
                    status: 'PENDING'
                },
                include: {
                    chatroom: {
                        select: { name: true }
                    },
                    inviter: {
                        select: { username: true }
                    }
                }
            });

            // Cache in Redis
            await redisChatService.cacheInvitation({
                id: invitation.id,
                userId: targetUser.id,
                username: targetUser.username,
                chatroomId: chatroomId,
                chatroomName: invitation.chatroom.name,
                invitedBy: invitedBy,
                inviterUsername: invitation.inviter.username,
                message: message || '',
                createdAt: invitation.createdAt.getTime(),
                expiresAt: expiresAt.getTime(),
                status: 'PENDING'
            });

            return {
                success: true,
                message: 'Invitation sent successfully'
            };

        } catch (error) {
            console.error('Error sending invitation:', error);
            throw error;
        }
    }

    // Get user's pending invitations
    async getUserPendingInvitations(userId: string): Promise<InvitationInfo[]> {
        try {
            const invitations = await client.invitation.findMany({
                where: {
                    userId: userId,
                    status: 'PENDING',
                    expiresAt: {
                        gt: new Date()
                    }
                },
                include: {
                    chatroom: {
                        select: {
                            name: true
                        }
                    },
                    inviter: {
                        select: {
                            username: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            return invitations.map(invitation => ({
                id: invitation.id,
                chatroomId: invitation.chatroomId,
                chatroomName: invitation.chatroom.name,
                invitedBy: invitation.invitedBy,
                inviterUsername: invitation.inviter.username,
                message: invitation.message || undefined,
                createdAt: invitation.createdAt,
                expiresAt: invitation.expiresAt
            }));

        } catch (error) {
            console.error('Error fetching invitations:', error);
            throw error;
        }
    }

    // Handle invitation (accept/reject)
    async handleInvitation(invitationId: string, action: 'accept' | 'reject', userId: string): Promise<JoinChatroomResult> {
        try {
            const invitation = await client.invitation.findUnique({
                where: { id: invitationId },
                include: {
                    chatroom: true
                }
            });

            if (!invitation || invitation.userId !== userId || invitation.status !== 'PENDING') {
                return {
                    success: false,
                    message: 'Invitation not found or already processed'
                };
            }

            if (invitation.expiresAt < new Date()) {
                return {
                    success: false,
                    message: 'Invitation has expired'
                };
            }

            if (action === 'accept') {
                // Add user as member
                await client.chatroomMember.create({
                    data: {
                        userId: userId,
                        chatroomId: invitation.chatroomId,
                        role: 'MEMBER'
                    }
                });

                // Update Redis cache
                await redisChatService.addUserToChatroom(invitation.chatroomId, userId, 'MEMBER');
            }

            // Update invitation status
            await client.invitation.update({
                where: { id: invitationId },
                data: {
                    status: action === 'accept' ? 'ACCEPTED' : 'DECLINED',
                    respondedAt: new Date()
                }
            });

            // Remove from Redis cache
            await redisChatService.removeInvitation(invitationId, invitation.userId, invitation.chatroomId);

            return {
                success: true,
                message: action === 'accept' ? 'Invitation accepted' : 'Invitation rejected'
            };

        } catch (error) {
            console.error('Error handling invitation:', error);
            throw error;
        }
    }

    // Update member role
    async updateMemberRole(chatroomId: string, memberId: string, newRole: 'MEMBER' | 'ADMIN'): Promise<JoinChatroomResult> {
        try {
            const member = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: memberId,
                        chatroomId: chatroomId
                    }
                }
            });

            if (!member) {
                return {
                    success: false,
                    message: 'Member not found'
                };
            }

            // Update in database
            await client.chatroomMember.update({
                where: {
                    userId_chatroomId: {
                        userId: memberId,
                        chatroomId: chatroomId
                    }
                },
                data: {
                    role: newRole
                }
            });

            // Note: Redis cache will be updated when user reconnects
            // For immediate effect, you could implement updateUserRole in Redis service

            return {
                success: true,
                message: `Member role updated to ${newRole}`
            };

        } catch (error) {
            console.error('Error updating member role:', error);
            throw error;
        }
    }

    // Remove member (updated to return result)
    async removeMemberFromChatroom(chatroomId: string, userId: string): Promise<JoinChatroomResult> {
        try {
            // Check if member exists
            const member = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: userId,
                        chatroomId: chatroomId
                    }
                }
            });

            if (!member) {
                return {
                    success: false,
                    message: 'Member not found'
                };
            }

            // Remove member from database
            await client.chatroomMember.delete({
                where: {
                    userId_chatroomId: {
                        userId: userId,
                        chatroomId: chatroomId
                    }
                }
            });

            // Update Redis cache
            await redisChatService.removeUserFromChatroom(chatroomId, userId);

            return {
                success: true,
                message: 'Member removed successfully'
            };

        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }
}

export const chatService = new ChatService();