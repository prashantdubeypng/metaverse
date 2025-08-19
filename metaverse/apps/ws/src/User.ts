import { Roommanager } from './Roommanager';
import { outgoingmessage, IncomingMessage, JoinPayload, MovePayload, UserPosition } from './types';
import { WebSocket } from 'ws';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { jwt_password } from './config';
import client from '@repo/db';

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
    private x: number;
    private y: number;
    private isAlive: boolean = true;

    constructor(private ws: WebSocket) {
        this.id = getRandomIdForUser();
        this.x = 0;
        this.y = 0;
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
        switch (parseData.type) {
            case 'join':
                await this.handleJoin(parseData.payload as JoinPayload);
                break;
            case 'move':
                await this.handleMove(parseData.payload as MovePayload);
                break;
            case 'leave':
                this.handleLeave();
                break;
            default:
                this.send({
                    type: 'error',
                    payload: { message: 'Invalid message type' }
                });
                break;
        }
    }

    private async handleJoin(payload: JoinPayload): Promise<void> {
        const { spaceId, token } = payload;

        if (!token) {
            this.ws.close(1008, 'Invalid token');
            return;
        }

        try {
            // Verify JWT token
            const decoded = jwt.verify(token, jwt_password) as JwtPayload;
            const userId = decoded.userId;

            if (!userId) {
                this.ws.close(1008, 'Invalid token - no user ID');
                return;
            }

            this.userId = userId;

            // Verify space exists
            const space = await client.space.findFirst({
                where: { id: spaceId }
            });

            if (!space) {
                this.ws.close(1008, 'Space not found');
                return;
            }

            // Set random spawn position within space bounds
            this.spaceId = spaceId;
            this.x = Math.floor(Math.random() * space.width);
            this.y = Math.floor(Math.random() * space.height);

            // Add user to room manager
            Roommanager.getInstance().addUser(spaceId, this);

            // Broadcast user joined to others
            Roommanager.getInstance().broadCast({
                type: 'user-joined-space',
                payload: {
                    userId: this.userId,
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
                            x: user.getX(),
                            y: user.getY(),
                        }))
                }
            });

            console.log(`User ${this.userId} joined space ${spaceId} at position (${this.x}, ${this.y})`);

        } catch (error) {
            console.error('Error during join:', error);
            this.ws.close(1008, 'Authentication failed');
        }
    }

    private async handleMove(payload: MovePayload): Promise<void> {
        if (!this.spaceId || !this.userId) {
            this.send({
                type: 'error',
                payload: { message: 'Not in a space' }
            });
            return;
        }

        const { x: moveX, y: moveY } = payload;
        const xDisplacement = Math.abs(this.x - moveX);
        const yDisplacement = Math.abs(this.y - moveY);

        // Validate movement (only allow 1 step at a time)
        if ((xDisplacement === 1 && yDisplacement === 0) || 
            (yDisplacement === 1 && xDisplacement === 0)) {
            
            // Update position
            this.x = moveX;
            this.y = moveY;

            // Send movement confirmation to the user
            this.send({
                type: 'user-moved',
                payload: {
                    userId: this.userId,
                    x: moveX,
                    y: moveY
                }
            });

            // Broadcast movement to others
            Roommanager.getInstance().broadCast({
                type: 'user-moved',
                payload: {
                    userId: this.userId,
                    x: moveX,
                    y: moveY
                }
            }, this, this.spaceId);

            console.log(`User ${this.userId} moved to (${moveX}, ${moveY})`);
        } else {
            // Reject invalid movement
            this.send({
                type: 'move-rejected',
                payload: {
                    userId: this.userId,
                    x: this.x,
                    y: this.y
                }
            });
        }
    }

    private handleLeave(): void {
        if (this.spaceId && this.userId) {
            Roommanager.getInstance().removeUser(this, this.spaceId);
            console.log(`User ${this.userId} left space ${this.spaceId}`);
        }
        this.ws.close(1000, 'User left');
    }

    public destroy(): void {
        this.isAlive = false;
        
        if (this.spaceId && this.userId) {
            // Broadcast user left to others
            Roommanager.getInstance().broadCast({
                type: 'user-left',
                payload: {
                    userId: this.userId,
                }
            }, this, this.spaceId);

            // Remove from room manager
            Roommanager.getInstance().removeUser(this, this.spaceId);
            console.log(`User ${this.userId} disconnected from space ${this.spaceId}`);
        }
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
        if (!this.userId) return null;
        return {
            userId: this.userId,
            x: this.x,
            y: this.y
        };
    }

    public isConnected(): boolean {
        return this.isAlive && this.ws.readyState === WebSocket.OPEN;
    }
}