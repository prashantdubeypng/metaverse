import dotenv from 'dotenv';
dotenv.config();

export const authConfig = {
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10),
  
  // Password Hashing
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '30', 10), // 30 requests per window
  
  // Account Security
  MAX_FAILED_ATTEMPTS: parseInt(process.env.MAX_FAILED_ATTEMPTS || '5', 10),
  LOCK_DURATION_MINUTES: parseInt(process.env.LOCK_DURATION_MINUTES || '15', 10),
  
  // Cookie Configuration
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Server
  PORT: process.env.HTTP_SERVICE_PORT || 8000,
  
  // Password Reset Configuration
  RESET_TOKEN_BYTES: parseInt(process.env.RESET_TOKEN_BYTES || '32', 10),
  RESET_TOKEN_EXPIRES_MIN: parseInt(process.env.RESET_TOKEN_EXPIRES_MIN || '60', 10),
  RESET_RATE_LIMIT_WINDOW_MS: parseInt(process.env.RESET_RATE_LIMIT_WINDOW_MS || '60000', 10),
  RESET_RATE_LIMIT_MAX_PER_IP: parseInt(process.env.RESET_RATE_LIMIT_MAX_PER_IP || '5', 10),
  RESET_RATE_LIMIT_MAX_PER_EMAIL: parseInt(process.env.RESET_RATE_LIMIT_MAX_PER_EMAIL || '3', 10),
  
  // Frontend URL
  FRONTEND_ORIGIN: process.env.FRONTEND_URL || 'http://localhost:3000',
};

export default authConfig;
