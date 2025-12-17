import crypto from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate a cryptographically secure random token
 */
export async function generateSecureToken(bytes: number = 32): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(bytes, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer.toString('hex'));
    });
  });
}

/**
 * Hash a token using SHA-256 (for storage)
 */
export function hashTokenSHA256(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
