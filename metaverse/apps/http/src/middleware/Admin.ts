import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { jwt_password } from '../config';

/** JWT User Payload Interface
 * This interface defines the structure of the JWT payload that 
 * contains user information.
 */
interface JwtUserPayload {
    userId: string;
    username: string;
    role: string;
}
/** Express Request Extension 
 * This extends the Express Request interface to include
 * the user property which contains the JWT user payload.
 * https://blog.logrocket.com/extend-express-request-object-typescript/#what-request-object-express,
 * declare global {
  namespace Express {
    export interface Request {
      language?: Language;
      user?: User;
    }
  }
}
*/
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

/**
 * Admin Middleware
 * 
 * This middleware checks if the user is an admin or not. To check this we are 
 * examining the authorization header which contains a JWT token. The token has 
 * a payload with user information like:
 * - userId: unique identifier of the user
 * - username: username of the user  
 * - role: role of the user (Admin/User)
 * To check if the user is authorized to use that route or not, we verify the 
 * role of the user from the JWT token payload.
 * @param req - Express request object
 * @param res - Express response object  
 * @param next - Express next function
 * @returns void
 */
export const adminmiddleware = async(req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    // check if the authorization header is present
    if (!header) {
        return res.status(401).send('Authorization header missing');
    }
    // extract the token from the header
    const token = header.split(' ')[1];
    // check if the token is present or not 
    if (!token) {
        return res.status(401).send('Token missing');
    }
    try {
        // verify the token using the jwt_password secret
        const decoded = jwt.verify(token, jwt_password) as JwtUserPayload;
    //check if the user is admin or not , if not return error 
        if (decoded.role !== 'Admin') {
            return res.status(403).send('Forbidden: Admin access required');
        }
        req.userId = decoded.userId; // Attach user ID to request object
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('JWT verification failed:', error);
        return res.status(401).send('Invalid token');
    }
}