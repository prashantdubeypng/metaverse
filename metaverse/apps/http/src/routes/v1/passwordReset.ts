import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requestPasswordReset, resetPassword, validateResetToken } from '../../services/passwordResetService';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { hashTokenSHA256 } from '../../utils/cryptoUtils';

const router = Router();

// Validation schemas
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Generic response to prevent account enumeration
 */
function genericSuccessResponse(res: Response) {
  return res.status(200).json({
    message: 'If an account with that email exists, you will receive an email with reset instructions.',
  });
}

/**
 * POST /forgot-password
 * Request a password reset email
 * 
 * Security features:
 * - Rate limited by IP and email
 * - Generic response (no account enumeration)
 * - Single-use tokens
 * - Short expiry (1 hour)
 * - Async email sending (queue)
 */
router.post('/forgot-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validation = forgotPasswordSchema.safeParse(req.body);
    
    if (!validation.success) {
      // Return generic response even for validation errors
      return genericSuccessResponse(res);
    }
    
    const { email } = validation.data;
    const ip = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Request password reset (always returns success)
    await requestPasswordReset({ email, ip, userAgent });
    
    // Always return generic success response
    return genericSuccessResponse(res);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Return generic response even on error
    return genericSuccessResponse(res);
  }
});

/**
 * POST /reset-password
 * Reset password with token
 * 
 * Security features:
 * - Token hashed before storage (SHA-256)
 * - Single-use tokens
 * - Expiry validation
 * - Revokes all refresh tokens (force logout)
 * - Sends confirmation email
 * - Audit logging
 */
router.post('/reset-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validation = resetPasswordSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }
    
    const { userId, token, newPassword } = validation.data;
    const ip = req.ip || 'unknown';
    
    // Reset password
    const result = await resetPassword({
      userId,
      token,
      newPassword,
      ip,
    });
    
    if (!result.success) {
      return res.status(400).json({
        error: result.message,
        code: result.code,
      });
    }
    
    return res.json({
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /reset-password/validate/:userId/:token
 * Validate a reset token without consuming it
 * Useful for frontend to check if token is valid before showing form
 */
router.get('/reset-password/validate/:userId/:token', async (req: Request, res: Response) => {
  try {
    const { userId, token } = req.params;
    
    if (!userId || !token) {
      return res.status(400).json({ valid: false, error: 'Missing parameters' });
    }
    
    const tokenHash = hashTokenSHA256(token);
    const isValid = await validateResetToken(userId, tokenHash);
    
    if (!isValid) {
      return res.json({ valid: false, error: 'Invalid or expired token' });
    }
    
    return res.json({
      valid: true,
    });
  } catch (error) {
    console.error('Validate token error:', error);
    return res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

export default router;
