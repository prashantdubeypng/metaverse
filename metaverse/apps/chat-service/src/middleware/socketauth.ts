import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
const JWT_SECRET = process.env.JWT_SECRET || '123bsdkmcbcanu'

interface JwtUserPayload {
    userId: string;
    username: string;
    role: string;
}

// Extend Socket interface to include userId
declare module 'socket.io' {
    interface Socket {
        userId?: string;
        username?: string;
    }
}

export const socketAuthMiddleware = (socket: Socket, next: any) => {
    try {
        // Get token from handshake auth or query
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        // For development/demo: allow connections with username/userId in auth
        if (!token) {
            const { username, userId } = socket.handshake.auth;
            
            if (username && userId) {
                // Allow demo connections with direct username/userId
                socket.userId = userId;
                socket.username = username;
                console.log(`🔓 Demo connection allowed for ${username} (${userId})`);
                return next(); // Allow connection
            }
            
            return next(new Error('Authentication token or demo credentials missing'));
        }

        // Verify token using same logic as HTTP middleware
        const decoded = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
        
        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        
        console.log(`🔐 Authenticated connection for ${decoded.username} (${decoded.userId})`);
        next(); // Allow connection
    } catch (error) {
        console.error('Socket authentication failed:', error);
        next(new Error('Invalid authentication token'));
    }
};
