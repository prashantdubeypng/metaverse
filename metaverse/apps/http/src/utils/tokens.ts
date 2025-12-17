import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import crypto from 'crypto';
import authConfig from '../config/auth.config';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

/**
 * Sign an access token (JWT)
 * BUG-FIX: Use proper type casting for expiresIn to satisfy jsonwebtoken v9+ types
 */
export function signAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: authConfig.ACCESS_TOKEN_EXPIRES as StringValue,
  };
  return jwt.sign(payload, authConfig.JWT_SECRET as Secret, options);
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, authConfig.JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate a secure random refresh token and its hash
 */
export function generateRefreshTokenPair(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString('hex'); // 96 hex characters
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

/**
 * Hash a token (for storage/comparison)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Calculate milliseconds from days
 */
export function msFromDays(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}
