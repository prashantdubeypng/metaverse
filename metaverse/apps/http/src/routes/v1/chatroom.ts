import { Router } from 'express';
export const chatroomRouter = Router();
import { Usermiddleware } from '../../middleware/User';
import { createchatroomschema } from '../../types';
import client from '@repo/db';
import { redisChatService } from '../../services/redis';
import { chatService } from '../../services/chatService';

// Apply user middleware to all routes
chatroomRouter.use(Usermiddleware);

/**
 * Create a new chatroom
 */
chatroomRouter.post('/create', async (req, res) => {
    const parser = createchatroomschema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).json({
            error: 'Invalid request data',
            details: parser.error.issues
        });
    }

    const { name, description, isPrivate, roomid } = parser.data;
    const userId = req.userId;

    try {
        // Check if the space exists
        const space = await client.space.findUnique({
            where: { id: roomid }
        });

        if (!space) {
            return res.status(404).json({ error: 'Space not found' });
        }

        // Create the chatroom in database
        const newChatRoom = await client.chatroom.create({
            data: {
                name: name,
                description: description,
                isPrivate: isPrivate,
                spaceId: roomid,
                creatorId: userId
            },
            include: {
                creator: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                space: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Add the creator as a member with OWNER role
        await client.chatroomMember.create({
            data: {
                userId: userId,
                chatroomId: newChatRoom.id,
                role: 'OWNER'
            }
        });

        // Cache chatroom in Redis
        await redisChatService.createChatroom({
            id: newChatRoom.id,
            name: newChatRoom.name,
            description: newChatRoom.description || undefined,
            ownerId: newChatRoom.creatorId,
            spaceId: newChatRoom.spaceId,
            isPrivate: newChatRoom.isPrivate,
            createdAt: newChatRoom.createdAt.getTime()
        });

        return res.status(201).json({
            success: true,
            message: 'Chatroom created successfully',
            chatroom: {
                id: newChatRoom.id,
                name: newChatRoom.name,
                description: newChatRoom.description,
                isPrivate: newChatRoom.isPrivate,
                creator: newChatRoom.creator,
                space: newChatRoom.space,
                createdAt: newChatRoom.createdAt
            }
        });

    } catch (error) {
        console.error('Error creating chatroom:', error);
        return res.status(500).json({
            error: 'Failed to create chatroom',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get all chatrooms in a space
 */
chatroomRouter.get('/rooms', async (req, res) => {
    const spaceId = req.query.spaceId as string;
    const userId = req.userId;

    if (!spaceId) {
        return res.status(400).json({ error: 'spaceId is required' });
    }

    try {
        // Get chatrooms from database with user membership info
        const chatrooms = await client.chatroom.findMany({
            where: {
                spaceId: spaceId,
                OR: [
                    { isPrivate: false }, // Public chatrooms
                    {
                        members: {
                            some: {
                                userId: userId,
                                isActive: true
                            }
                        }
                    } // Private chatrooms user is member of
                ]
            },
            include: {
                creator: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                members: {
                    where: { userId: userId },
                    select: { role: true, joinedAt: true }
                },
                _count: {
                    select: {
                        members: {
                            where: { isActive: true }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Get active user counts from Redis
        const chatroomsWithActivity = await Promise.all(
            chatrooms.map(async (chatroom) => {
                const activeUsers = await redisChatService.getActiveUsers(chatroom.id);

                return {
                    id: chatroom.id,
                    name: chatroom.name,
                    description: chatroom.description,
                    isPrivate: chatroom.isPrivate,
                    creator: chatroom.creator,
                    memberCount: chatroom._count.members,
                    activeCount: activeUsers.length,
                    isMember: chatroom.members.length > 0,
                    userRole: chatroom.members[0]?.role || null,
                    joinedAt: chatroom.members[0]?.joinedAt || null,
                    createdAt: chatroom.createdAt
                };
            })
        );

        return res.json({
            success: true,
            chatrooms: chatroomsWithActivity
        });

    } catch (error) {
        console.error('Error fetching chatrooms:', error);
        return res.status(500).json({
            error: 'Failed to fetch chatrooms',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Join a chatroom
 */
chatroomRouter.post('/join', async (req, res) => {
    const { chatroomId } = req.body;
    const userId = req.userId;

    if (!chatroomId) {
        return res.status(400).json({ error: 'chatroomId is required' });
    }

    try {
        const result = await chatService.joinChatroom(chatroomId, userId);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
                requiresApproval: result.requiresApproval
            });
        }

    } catch (error) {
        console.error('Error joining chatroom:', error);
        return res.status(500).json({
            error: 'Failed to join chatroom',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Leave a chatroom
 */
chatroomRouter.post('/leave', async (req, res) => {
    const { chatroomId } = req.body;
    const userId = req.userId;

    if (!chatroomId) {
        return res.status(400).json({ error: 'chatroomId is required' });
    }

    try {
        await chatService.leaveChatroom(chatroomId, userId);

        return res.json({
            success: true,
            message: 'Successfully left chatroom'
        });

    } catch (error) {
        console.error('Error leaving chatroom:', error);
        return res.status(500).json({
            error: 'Failed to leave chatroom',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Validate username availability
 */
chatroomRouter.get('/validate/username/:username', async (req, res) => {
    const { username } = req.params;

    if (!username || username.length < 3) {
        return res.status(400).json({
            error: 'Username must be at least 3 characters long'
        });
    }

    try {
        const isAvailable = await chatService.validateUsername(username);

        return res.json({
            success: true,
            available: isAvailable,
            message: isAvailable ? 'Username is available' : 'Username is already taken'
        });

    } catch (error) {
        console.error('Error validating username:', error);
        return res.status(500).json({
            error: 'Failed to validate username',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get chatroom details
 */
chatroomRouter.get('/:chatroomId', async (req, res) => {
    const { chatroomId } = req.params;
    const userId = req.userId;

    try {
        // Check if user is member
        const isMember = await redisChatService.isUserMember(chatroomId, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'You are not a member of this chatroom' });
        }

        // Get chatroom info from Redis first, fallback to DB
        let chatroomInfo = await redisChatService.getChatroomInfo(chatroomId);

        if (!chatroomInfo) {
            // Sync from database
            await chatService.syncChatroomFromDB(chatroomId);
            chatroomInfo = await redisChatService.getChatroomInfo(chatroomId);
        }

        if (!chatroomInfo) {
            return res.status(404).json({ error: 'Chatroom not found' });
        }

        // Get members and recent messages
        const [members, recentMessages, activeUsers] = await Promise.all([
            chatService.getChatroomMembersInfo(chatroomId),
            chatService.getRecentMessagesWithInfo(chatroomId, 50),
            redisChatService.getActiveUsers(chatroomId)
        ]);

        return res.json({
            success: true,
            chatroom: {
                ...chatroomInfo,
                members,
                recentMessages,
                activeUserCount: activeUsers.length
            }
        });

    } catch (error) {
        console.error('Error fetching chatroom details:', error);
        return res.status(500).json({
            error: 'Failed to fetch chatroom details',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Update chatroom settings (owner only)
 */
chatroomRouter.put('/:chatroomId', async (req, res) => {
    const { chatroomId } = req.params;
    const { name, description, isPrivate } = req.body;
    const userId = req.userId;

    try {
        // Check if user is owner
        const chatroomInfo = await redisChatService.getChatroomInfo(chatroomId);
        if (!chatroomInfo || chatroomInfo.ownerId !== userId) {
            return res.status(403).json({ error: 'Only chatroom owner can update settings' });
        }

        // Update in database
        const updatedChatroom = await client.chatroom.update({
            where: { id: chatroomId },
            data: {
                name: name || chatroomInfo.name,
                description: description !== undefined ? description : chatroomInfo.description,
                isPrivate: isPrivate !== undefined ? isPrivate : chatroomInfo.isPrivate
            }
        });

        // Update Redis cache
        await redisChatService.createChatroom({
            id: updatedChatroom.id,
            name: updatedChatroom.name,
            description: updatedChatroom.description || undefined,
            ownerId: updatedChatroom.creatorId,
            spaceId: updatedChatroom.spaceId,
            isPrivate: updatedChatroom.isPrivate,
            createdAt: updatedChatroom.createdAt.getTime()
        });

        return res.json({
            success: true,
            message: 'Chatroom updated successfully',
            chatroom: updatedChatroom
        });

    } catch (error) {
        console.error('Error updating chatroom:', error);
        return res.status(500).json({
            error: 'Failed to update chatroom',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Delete chatroom (owner only)
 */
chatroomRouter.delete('/:chatroomId', async (req, res) => {
    const { chatroomId } = req.params;
    const userId = req.userId;

    try {
        // Check if user is owner
        const chatroomInfo = await redisChatService.getChatroomInfo(chatroomId);
        if (!chatroomInfo || chatroomInfo.ownerId !== userId) {
            return res.status(403).json({ error: 'Only chatroom owner can delete chatroom' });
        }

        // Delete from database (cascade will handle members)
        await client.chatroom.delete({
            where: { id: chatroomId }
        });

        // Clean up Redis data
        const members = await redisChatService.getChatroomMembers(chatroomId);
        for (const memberId of members) {
            await redisChatService.removeUserFromChatroom(chatroomId, memberId);
        }

        return res.json({
            success: true,
            message: 'Chatroom deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting chatroom:', error);
        return res.status(500).json({
            error: 'Failed to delete chatroom',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Send join request for private chatroom
 */
chatroomRouter.post('/:chatroomId/request-join', async (req, res) => {
    const { chatroomId } = req.params;
    const { message } = req.body;
    const userId = req.userId;

    try {
        const result = await chatService.sendJoinRequest(chatroomId, userId, message);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Error sending join request:', error);
        return res.status(500).json({
            error: 'Failed to send join request',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get pending join requests (owner/admin only)
 */
chatroomRouter.get('/:chatroomId/join-requests', async (req, res) => {
    const { chatroomId } = req.params;
    const userId = req.userId;

    try {
        // Check if user is owner or admin
        const userRole = await redisChatService.getUserRole(chatroomId, userId);
        if (!userRole || (userRole !== 'OWNER' && userRole !== 'ADMIN')) {
            return res.status(403).json({ error: 'Only owners and admins can view join requests' });
        }

        const joinRequests = await chatService.getPendingJoinRequests(chatroomId);

        return res.json({
            success: true,
            joinRequests
        });

    } catch (error) {
        console.error('Error fetching join requests:', error);
        return res.status(500).json({
            error: 'Failed to fetch join requests',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Approve or reject join request (owner/admin only)
 */
chatroomRouter.post('/:chatroomId/join-requests/:requestId', async (req, res) => {
    const { chatroomId, requestId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    const userId = req.userId;

    if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be either "approve" or "reject"' });
    }

    try {
        // Check if user is owner or admin
        const userRole = await redisChatService.getUserRole(chatroomId, userId);
        if (!userRole || (userRole !== 'OWNER' && userRole !== 'ADMIN')) {
            return res.status(403).json({ error: 'Only owners and admins can manage join requests' });
        }

        const result = await chatService.handleJoinRequest(requestId, action, userId);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Error handling join request:', error);
        return res.status(500).json({
            error: 'Failed to handle join request',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Send invitation to user (owner/admin only)
 */
chatroomRouter.post('/:chatroomId/invitations', async (req, res) => {
    const { chatroomId } = req.params;
    const { username, message } = req.body;
    const userId = req.userId;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        // Check if user is owner or admin
        const userRole = await redisChatService.getUserRole(chatroomId, userId);
        if (!userRole || (userRole !== 'OWNER' && userRole !== 'ADMIN')) {
            return res.status(403).json({ error: 'Only owners and admins can send invitations' });
        }

        const result = await chatService.sendInvitation(chatroomId, userId, username, message);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Error sending invitation:', error);
        return res.status(500).json({
            error: 'Failed to send invitation',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get user's pending invitations
 */
chatroomRouter.get('/invitations/pending', async (req, res) => {
    const userId = req.userId;

    try {
        const invitations = await chatService.getUserPendingInvitations(userId);

        return res.json({
            success: true,
            invitations
        });

    } catch (error) {
        console.error('Error fetching invitations:', error);
        return res.status(500).json({
            error: 'Failed to fetch invitations',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Accept or reject invitation
 */
chatroomRouter.post('/invitations/:invitationId', async (req, res) => {
    const { invitationId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.userId;

    if (!action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be either "accept" or "reject"' });
    }

    try {
        const result = await chatService.handleInvitation(invitationId, action, userId);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Error handling invitation:', error);
        return res.status(500).json({
            error: 'Failed to handle invitation',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get chatroom members with their roles (members only)
 */
chatroomRouter.get('/:chatroomId/members', async (req, res) => {
    const { chatroomId } = req.params;
    const userId = req.userId;

    try {
        // Check if user is member
        const isMember = await redisChatService.isUserMember(chatroomId, userId);
        if (!isMember) {
            return res.status(403).json({ error: 'You are not a member of this chatroom' });
        }

        const members = await chatService.getChatroomMembersInfo(chatroomId);

        return res.json({
            success: true,
            members
        });

    } catch (error) {
        console.error('Error fetching members:', error);
        return res.status(500).json({
            error: 'Failed to fetch members',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Update member role (owner only)
 */
chatroomRouter.put('/:chatroomId/members/:memberId', async (req, res) => {
    const { chatroomId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.userId;

    if (!role || !['MEMBER', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'Role must be either "MEMBER" or "ADMIN"' });
    }

    try {
        // Check if user is owner
        const userRole = await redisChatService.getUserRole(chatroomId, userId);
        if (userRole !== 'OWNER') {
            return res.status(403).json({ error: 'Only chatroom owner can update member roles' });
        }

        const result = await chatService.updateMemberRole(chatroomId, memberId, role);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Error updating member role:', error);
        return res.status(500).json({
            error: 'Failed to update member role',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Remove member from chatroom (owner/admin only)
 */
chatroomRouter.delete('/:chatroomId/members/:memberId', async (req, res) => {
    const { chatroomId, memberId } = req.params;
    const userId = req.userId;

    try {
        // Check if user is owner or admin
        const userRole = await redisChatService.getUserRole(chatroomId, userId);
        if (!userRole || (userRole !== 'OWNER' && userRole !== 'ADMIN')) {
            return res.status(403).json({ error: 'Only owners and admins can remove members' });
        }

        // Can't remove the owner
        const targetRole = await redisChatService.getUserRole(chatroomId, memberId);
        if (targetRole === 'OWNER') {
            return res.status(400).json({ error: 'Cannot remove chatroom owner' });
        }

        // Admins can't remove other admins, only owner can
        if (userRole === 'ADMIN' && targetRole === 'ADMIN') {
            return res.status(403).json({ error: 'Admins cannot remove other admins' });
        }

        const result = await chatService.removeMemberFromChatroom(chatroomId, memberId);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Error removing member:', error);
        return res.status(500).json({
            error: 'Failed to remove member',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});