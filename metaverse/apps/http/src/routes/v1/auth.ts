import { Router, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { signup, login, rotateRefreshToken, logout } from '../../services/authService';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { authenticateToken } from '../../middleware/auth';
import authConfig from '../../config/auth.config';
import UsernameBloomFilterService from '../../services/usernameBloomFilter';
import passwordResetRouter from './passwordReset';

const router = Router();
router.use(cookieParser());

// Mount password reset routes
router.use('/', passwordResetRouter);

// Validation schemas
const signupSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  email: z.string().email(),
  type: z.enum(['Admin', 'User']).optional(),
});

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
});

/**
 * POST /auth/signup
 * Register a new user with Bloom filter pre-check
 */
router.post('/signup', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const validation = signupSchema.safeParse(req.body);
    console.log(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { username, password, email, type } = validation.data;

    const result = await signup({
      username,
      password,
      email,
      type,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!result.success) {
      if (result.code === 'USERNAME_TAKEN') {
        return res.status(409).json({ error: 'Username already exists' });
      }
      if (result.code === 'EMAIL_TAKEN') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return res.status(400).json({ error: 'Signup failed' });
    }

    return res.status(201).json({
      message: 'User created successfully',
      user: result.user,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/login
 * Login with Bloom filter pre-check, rate limiting, and account lockout
 */
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    console.log("in login route")
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { username, password } = validation.data;
    console.log('Login request body:', JSON.stringify(req.body, null, 2));
    
    const result = await login({
      username,
      password,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    console.log('Login result:', JSON.stringify(result, null, 2));

    if (!result.success) {
      if (result.code === 'ACCOUNT_LOCKED') {
        return res.status(423).json({
          error: 'Account locked due to too many failed attempts',
          retryAfter: result.retryAfter,
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set HttpOnly secure cookie for refresh token
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: authConfig.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: authConfig.COOKIE_DOMAIN,
      path: '/api/v1/auth',
      maxAge: authConfig.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/refresh
 * Rotate refresh token and issue new access token
 */
router.post('/refresh', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const result = await rotateRefreshToken({
      oldToken: refreshToken,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!result.success) {
      res.clearCookie('refresh_token', {
        path: '/api/v1/auth',
        domain: authConfig.COOKIE_DOMAIN,
      });
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Set new refresh token cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: authConfig.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: authConfig.COOKIE_DOMAIN,
      path: '/api/v1/auth',
      maxAge: authConfig.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Revoke refresh token and clear cookie
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;
    
    if (refreshToken) {
      await logout({ refreshToken });
    }

    res.clearCookie('refresh_token', {
      path: '/api/v1/auth',
      domain: authConfig.COOKIE_DOMAIN,
    });

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    return res.json({
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
    });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/check-username/:username
 * Check username availability with Bloom filter
 */
router.get('/check-username/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    if (!username || username.length < 3) {
      return res.status(400).json({
        error: 'Username must be at least 3 characters',
        available: false,
      });
    }

    const bloomService = UsernameBloomFilterService.getInstance();
    const result = await bloomService.isUsernameTaken(username);

    return res.json({
      available: result.definitelyAvailable,
      username: username,
      checkedWithDb: result.needsDbCheck,
    });
  } catch (error) {
    console.error('Username check error:', error);
    return res.status(500).json({ error: 'Failed to check username availability' });
  }
});

/**
 * GET /auth/bloom-stats
 * Get Bloom filter statistics (for monitoring)
 */
router.get('/bloom-stats', async (req: Request, res: Response) => {
  try {
    const bloomService = UsernameBloomFilterService.getInstance();
    const stats = bloomService.getStats();

    return res.json({
      ...stats,
      estimatedFPRPercentage: (stats.estimatedFPR * 100).toFixed(4) + '%',
      memoryUsageBytes: Math.ceil(stats.size / 8),
      memoryUsageKB: (Math.ceil(stats.size / 8) / 1024).toFixed(2) + ' KB',
    });
  } catch (error) {
    console.error('Bloom stats error:', error);
    return res.status(500).json({ error: 'Failed to get bloom filter stats' });
  }
});

export default router;
