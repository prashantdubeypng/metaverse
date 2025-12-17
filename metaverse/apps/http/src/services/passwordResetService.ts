import bcrypt from 'bcrypt';
import client from '@repo/db';
import authConfig from '../config/auth.config';
import { redis } from '../infra/redisClient';
import { enqueueEmail } from '../infra/emailQueue';
import { generateSecureToken, hashTokenSHA256 } from '../utils/cryptoUtils';

export interface ForgotPasswordParams {
  email: string;
  ip: string;
  userAgent: string;
}

export interface ResetPasswordParams {
  userId: string;
  token: string;
  newPassword: string;
  ip: string;
}

/**
 * Rate limit keys for password reset
 */
function ipRateLimitKey(ip: string): string {
  return `rl:pwd:ip:${ip}`;
}

function emailRateLimitKey(email: string): string {
  return `rl:pwd:email:${email.toLowerCase()}`;
}

/**
 * Check rate limits for password reset requests
 */
async function checkRateLimits(ip: string, email: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check IP rate limit
  const ipKey = ipRateLimitKey(ip);
  const ipCount = await redis.incr(ipKey);
  
  if (ipCount === 1) {
    await redis.pexpire(ipKey, authConfig.RESET_RATE_LIMIT_WINDOW_MS);
  }
  
  if (ipCount > authConfig.RESET_RATE_LIMIT_MAX_PER_IP) {
    return { allowed: false, reason: 'IP rate limit exceeded' };
  }
  
  // Check email rate limit
  const emailKey = emailRateLimitKey(email);
  const emailCount = await redis.incr(emailKey);
  
  if (emailCount === 1) {
    await redis.pexpire(emailKey, authConfig.RESET_RATE_LIMIT_WINDOW_MS);
  }
  
  if (emailCount > authConfig.RESET_RATE_LIMIT_MAX_PER_EMAIL) {
    return { allowed: false, reason: 'Email rate limit exceeded' };
  }
  
  return { allowed: true };
}

/**
 * Request password reset (forgot password)
 * Always returns success to prevent account enumeration
 */
export async function requestPasswordReset(params: ForgotPasswordParams): Promise<{ success: boolean }> {
  const { email, ip, userAgent } = params;
  
  try {
    // 1. Check rate limits
    const rateLimitCheck = await checkRateLimits(ip, email);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for password reset: ${rateLimitCheck.reason}`, { ip, email });
      // Still return success to prevent enumeration
      return { success: true };
    }
    
    // 2. Find user by email
    const user = await client.user.findUnique({
      where: { email },
      select: { id: true, username: true, email: true },
    });
    
    // If user doesn't exist, still return success (prevent enumeration)
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return { success: true };
    }
    
    // 3. Generate secure token
    const rawToken = await generateSecureToken(authConfig.RESET_TOKEN_BYTES);
    const tokenHash = hashTokenSHA256(rawToken);
    
    const expiresAt = new Date(Date.now() + authConfig.RESET_TOKEN_EXPIRES_MIN * 60 * 1000);
    
    // 4. Invalidate previous outstanding reset tokens (single-active-token policy)
    await client.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    
    // 5. Save hashed token to database
    await client.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip,
        userAgent,
      },
    });
    
    // 6. Enqueue email with reset link
    const resetUrl = `${authConfig.FRONTEND_ORIGIN}/auth/reset?uid=${user.id}&token=${rawToken}`;
    
    await enqueueEmail({
      to: email,
      subject: 'Reset your password',
      template: 'password_reset',
      data: {
        name: user.username || 'User',
        resetUrl,
        expiresMinutes: authConfig.RESET_TOKEN_EXPIRES_MIN,
      },
    });
    
    // 7. Log audit event
    await redis.lpush(
      `audit:pwd:${user.id}`,
      JSON.stringify({
        type: 'password_reset_requested',
        at: new Date().toISOString(),
        ip,
        userAgent,
      })
    );
    
    console.log(`Password reset token created for user ${user.id}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    // Still return success to prevent information leakage
    return { success: true };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(params: ResetPasswordParams) {
  const { userId, token, newPassword, ip } = params;
  
  try {
    // 1. Validate password strength
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters',
      };
    }
    
    // 2. Hash the incoming token and find matching record
    const tokenHash = hashTokenSHA256(token);
    
    const resetToken = await client.passwordResetToken.findFirst({
      where: {
        userId,
        tokenHash,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // 3. Validate token exists
    if (!resetToken) {
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token',
      };
    }
    
    // 4. Check if token is expired or already consumed
    const now = new Date();
    if (resetToken.consumedAt || resetToken.expiresAt < now) {
      return {
        success: false,
        code: 'EXPIRED_TOKEN',
        message: 'Invalid or expired reset token',
      };
    }
    
    // 5. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, authConfig.BCRYPT_SALT_ROUNDS);
    
    // 6. Update password, mark token as consumed, and revoke all refresh tokens (force logout)
    await client.$transaction([
      // Update password
      client.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      
      // Mark token as consumed
      client.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { consumedAt: new Date() },
      }),
      
      // Revoke all refresh tokens (force logout from all devices)
      client.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    
    // 7. Get user email for confirmation
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });
    
    if (user) {
      // 8. Send confirmation email
      await enqueueEmail({
        to: user.email,
        subject: 'Your password was changed',
        template: 'password_changed',
        data: {
          name: user.username || 'User',
          ip,
          time: new Date().toISOString(),
        },
      });
      
      // 9. Log audit event
      await redis.lpush(
        `audit:pwd:${userId}`,
        JSON.stringify({
          type: 'password_reset_completed',
          at: new Date().toISOString(),
          ip,
        })
      );
    }
    
    console.log(`Password successfully reset for user ${userId}`);
    
    return {
      success: true,
      message: 'Password reset successful',
    };
  } catch (error) {
    console.error('Error in resetPassword:', error);
    return {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to reset password',
    };
  }
}

/**
 * Revoke all password reset tokens for a user
 */
export async function revokeAllResetTokens(userId: string): Promise<void> {
  await client.passwordResetToken.updateMany({
    where: {
      userId,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });
}

/**
 * Validate a reset token without consuming it
 */
export async function validateResetToken(userId: string, tokenHash: string): Promise<boolean> {
  try {
    const resetToken = await client.passwordResetToken.findFirst({
      where: {
        userId,
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    
    return !!resetToken;
  } catch (error) {
    console.error('Error validating reset token:', error);
    return false;
  }
}

/**
 * Clean up expired password reset tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await client.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  
  return result.count;
}
