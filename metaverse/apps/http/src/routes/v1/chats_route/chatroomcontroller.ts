import { Request, Response } from 'express';
import { createchatroomschema } from '../../../types';
import client from '@repo/db';

interface AuthenticatedRequest extends Request {
    userId: string;
}

export default class chatroomcontroller {
    static async get_all_chat_room(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id;
            const data = await client.chatroom.findMany({
                where: {
                    spaceId: id
                },
                include: {
                    creator: {
                        select: {
                            id: true,
                            username: true
                        }
                    },
                    _count: {
                        select: {
                            members: true
                        }
                    }
                }
            })
            return res.status(200).json({ message: 'success', status: 200, data: data })
        } catch (error) {
            console.error('Error fetching chatrooms for space:', error)
            return res.status(500).json({ message: 'Internal server error', status: 500 })
        }
    }
    static async create_room(req: AuthenticatedRequest, res: Response) {
        try {
            const parser = createchatroomschema.safeParse(req.body);
            if (!parser.success) {
                return res.status(400).json({
                    message: 'Please provide valid name, description, passcode, and roomid',
                    status: 400,
                    errors: parser.error.issues
                })
            }

            const { name, description, passcode, roomid } = parser.data;

            const data = await client.chatroom.create({
                data: {
                    name: name,
                    description: description,
                    passcode: passcode,
                    spaceId: roomid,
                    creatorId: req.userId
                },
                include: {
                    creator: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            })

            await client.chatroomMember.create({
                data: {
                    userId: req.userId,
                    chatroomId: data.id
                }
            })

            return res.status(201).json({ message: 'Chatroom created successfully', status: 201, data: data })
        }
        catch (error) {
            console.error('Error creating chatroom:', error);
            return res.status(500).json({ message: 'Failed to create chatroom', status: 500 })
        }
    }
    static async join(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id;
            const { passcode } = req.body;

            if (!passcode) {
                return res.status(400).json({ message: 'Passcode is required', status: 400 })
            }

            const chatroom = await client.chatroom.findUnique({
                where: {
                    id: id
                }
            })

            if (!chatroom) {
                return res.status(404).json({ message: 'Chatroom not found', status: 404 })
            }

            if (passcode !== chatroom.passcode) {
                return res.status(401).json({ message: 'Invalid passcode', status: 401 })
            }

            const existingMember = await client.chatroomMember.findUnique({
                where: {
                    userId_chatroomId: {
                        userId: req.userId,
                        chatroomId: id,
                    },
                }
            })

            if (!existingMember) {
                await client.chatroomMember.create({
                    data: {
                        userId: req.userId,
                        chatroomId: id
                    }
                })
                return res.status(200).json({ message: 'Successfully joined chatroom', status: 200 })
            }

            return res.status(409).json({ message: 'Already a member of this chatroom', status: 409 })
        } catch (error) {
            console.error('Error joining chatroom:', error)
            return res.status(500).json({ message: 'Failed to join chatroom', status: 500 });
        }
    }
    static async update(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id;
            const { name, description, passcode } = req.body;

            if (!name && !description && !passcode) {
                return res.status(400).json({ message: 'At least one field (name, description, passcode) is required', status: 400 })
            }

            const updateData: any = {};
            if (name) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (passcode) updateData.passcode = passcode;

            const data = await client.chatroom.update({
                where: {
                    id: id,
                    creatorId: req.userId
                },
                data: updateData,
                include: {
                    creator: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            })

            return res.status(200).json({ message: 'Chatroom updated successfully', status: 200, data: data })
        } catch (error: any) {
            console.error('Error updating chatroom:', error)
            if (error.code === 'P2025') {
                return res.status(404).json({ message: 'Chatroom not found or you are not the creator', status: 404 })
            }
            return res.status(500).json({ message: 'Failed to update chatroom', status: 500 })
        }
    }
    static async destroy(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id;

            const data = await client.chatroom.delete({
                where: {
                    id: id,
                    creatorId: req.userId
                }
            })

            return res.status(200).json({ message: 'Chatroom deleted successfully', status: 200, data: data })
        } catch (error: any) {
            console.error('Error deleting chatroom:', error)
            if (error.code === 'P2025') {
                return res.status(404).json({ message: 'Chatroom not found or you are not the creator', status: 404 })
            }
            return res.status(500).json({ message: 'Failed to delete chatroom', status: 500 })
        }
    }
}
