import { Router } from 'express';
import { Usermiddleware } from '../../middleware/User';
import client from '@repo/db';
import chatroomcontroller from './chats_route/chatroomcontroller';
import chatscontroller from './chats_route/chatscontroller';

export const chatroomRouter = Router();

// Chatroom Management Routes
chatroomRouter.get('/space/:id', Usermiddleware, chatroomcontroller.get_all_chat_room);
chatroomRouter.post('/create', Usermiddleware, chatroomcontroller.create_room);
chatroomRouter.post('/join/:id', Usermiddleware, chatroomcontroller.join);
chatroomRouter.put('/update/:id', Usermiddleware, chatroomcontroller.update);
chatroomRouter.delete('/delete/:id', Usermiddleware, chatroomcontroller.destroy);

// Message Routes
chatroomRouter.get('/:id/messages', Usermiddleware, chatscontroller.get_all_chats);
chatroomRouter.post('/:id/send', Usermiddleware, sendMessage);

// Send message function
async function sendMessage(req: any, res: any) {
    try {
        const chatroomId = req.params.id;
        const { content, type = 'text' } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({
                message: 'Message content is required',
                status: 400
            });
        }

        // Verify user is member of chatroom
        const membership = await client.chatroomMember.findUnique({
            where: {
                userId_chatroomId: {
                    userId: req.userId,
                    chatroomId: chatroomId
                }
            }
        });

        if (!membership) {
            return res.status(403).json({
                message: 'You are not a member of this chatroom',
                status: 403
            });
        }

        // Create message
        const message = await client.message.create({
            data: {
                content: content.trim(),
                type: type,
                userId: req.userId,
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

        return res.status(201).json({
            message: 'Message sent successfully',
            status: 201,
            data: message
        });

    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({
            message: 'Failed to send message',
            status: 500
        });
    }
}
