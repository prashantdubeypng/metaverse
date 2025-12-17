import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../infra/redisClient';
import authConfig from '../config/auth.config';

/**
 * Global IP-based rate limiter
 * Prevents abuse by limiting requests per IP address
 */
export const ipRateLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore - RedisStore expects sendCommand method
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: authConfig.RATE_LIMIT_WINDOW_MS,
  max: authConfig.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  skip: (req) => {
    // Skip rate limiting for health checks and auth routes (they have their own limiter)
    return req.path === '/health' || req.path.startsWith('/api/v1/auth');
  },
});

/**
 * Strict rate limiter for auth endpoints
 * More restrictive limits for login/signup
 */
export const authRateLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: authConfig.RATE_LIMIT_WINDOW_MS,
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // More lenient in development
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
});
