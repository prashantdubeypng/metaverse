import { Router } from 'express';
import { Usermiddleware } from '../../middleware/User';
import { chatService } from '../../services/chatService';
import { redisChatService } from '../../services/redis';
import { z } from 'zod';

export const messagesRouter = Router();

// Apply user middleware to all routes
messagesRouter.use(Usermiddleware);

// Validation schemas
const sendMessageSchema = z.object({
    content: z.string().min(1).max(2000),
    chatroomId: z.string()
});

const getMessagesSchema = z.object({
    chatroomId: z.string(),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
    before: z.string().optional() // For pagination
});

/**
 * Send a message to a chatroom
 */
messagesRouter.post('/send', async (req, res) => {
    const parser = sendMessageSchema.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).json({
            error: 'Invalid request data',
            details: parser.error.issues
        });
    }

    const { content, chatroomId } = parser.data;
    const userId = req.userId!;

    try {
        // Check if user is member of the chatroom
        const isMember = await redisChatService.isUserMember(chatroomId, userId);
        if (!isMember) {
            return res.status(403).json({
                error: 'You are not a member of this chatroom'
            });
        }

        // Save message
        const messageInfo = await chatService.saveMessage(content, userId, chatroomId);

        return res.status(201).json({
            success: true,
            message: messageInfo
        });

    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({
            error: 'Failed to send message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get messages from a chatroom
 */
messagesRouter.get('/', async (req, res) => {
    const parser = getMessagesSchema.safeParse(req.query);
    if (!parser.success) {
        return res.status(400).json({
            error: 'Invalid request parameters',
            details: parser.error.issues
        });
    }

    const { chatroomId, limit } = parser.data;
    const userId = req.userId!;

    try {
        // Check if user is member of the chatroom
        const isMember = await redisChatService.isUserMember(chatroomId, userId);
        if (!isMember) {
            return res.status(403).json({
                error: 'You are not a member of this chatroom'
            });
        }

        // Get messages
        const messages = await chatService.getRecentMessagesWithInfo(chatroomId, limit);

        return res.json({
            success: true,
            messages: messages,
            count: messages.length
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({
            error: 'Failed to fetch messages',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get user's chatrooms
 */
messagesRouter.get('/chatrooms', async (req, res) => {
    const userId = req.userId!;

    try {
        const chatrooms = await chatService.getUserChatrooms(userId);

        return res.json({
            success: true,
            chatrooms: chatrooms
        });

    } catch (error) {
        console.error('Error fetching user chatrooms:', error);
        return res.status(500).json({
            error: 'Failed to fetch chatrooms',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Mark user as active in chatroom
 */
messagesRouter.post('/active', async (req, res) => {
    const { chatroomId } = req.body;
    const userId = req.userId!;

    if (!chatroomId) {
        return res.status(400).json({ error: 'chatroomId is required' });
    }

    try {
        // Check if user is member
        const isMember = await redisChatService.isUserMember(chatroomId, userId);
        if (!isMember) {
            return res.status(403).json({
                error: 'You are not a member of this chatroom'
            });
        }

        // Set user as active
        await redisChatService.setUserActive(chatroomId, userId);

        return res.json({
            success: true,
            message: 'Marked as active'
        });

    } catch (error) {
        console.error('Error marking user as active:', error);
        return res.status(500).json({
            error: 'Failed to mark as active',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Mark user as inactive in chatroom
 */
messagesRouter.post('/inactive', async (req, res) => {
    const { chatroomId } = req.body;
    const userId = req.userId!;

    if (!chatroomId) {
        return res.status(400).json({ error: 'chatroomId is required' });
    }

    try {
        // Set user as inactive
        await redisChatService.setUserInactive(chatroomId, userId);

        return res.json({
            success: true,
            message: 'Marked as inactive'
        });

    } catch (error) {
        console.error('Error marking user as inactive:', error);
        return res.status(500).json({
            error: 'Failed to mark as inactive',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});