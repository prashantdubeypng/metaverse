import { Request, Response } from 'express';
import client from '@repo/db';

interface AuthenticatedRequest extends Request {
    userId: string;
}

export default class chatscontroller{
    static async get_all_chats (req: AuthenticatedRequest, res: Response){
        const chatroomId = req.params.id;
        try{
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
            
            const messages = await client.message.findMany({
                where: {
                    chatroomId: chatroomId
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
                    createdAt: 'asc'
                }
            });
            
            return res.status(200).json({
                message: 'success',
                status: 200,
                data: messages
            });

        }catch(error){
            console.error('Error fetching messages:', error);
            return res.status(500).json({
                message: 'Error fetching messages',
                status: 500
            });
        }
    }
}
