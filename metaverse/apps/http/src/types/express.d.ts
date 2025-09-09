import { Request } from 'express';

// Extend Express Request interface to include authenticated user data
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Create a type for authenticated requests where userId is guaranteed to exist
export interface AuthenticatedRequest extends Request {
  userId: string;
}