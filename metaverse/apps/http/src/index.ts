import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import UsernameBloomFilterService from './services/usernameBloomFilter';
import { ipRateLimiter } from './middleware/rateLimiter';
import authConfig from './config/auth.config';
import { logger, captureConsole, captureUncaughtErrors, capturePrismaLogs } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { httpLoggerMiddleware, attachRequestLogger } from './middleware/httpLogger';
import { errorLoggerMiddleware, notFoundLogger } from './middleware/errorLogger';
import client from '@repo/db';

// Initialize logging
captureConsole();
captureUncaughtErrors();
capturePrismaLogs(client);

const app = express();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(requestIdMiddleware); // Add request ID first
app.use(httpLoggerMiddleware); // HTTP request logging
app.use(attachRequestLogger); // Attach logger to request
app.use(express.json());
app.use(cookieParser());
app.use(ipRateLimiter); // Global rate limiting

import { router } from './routes/v1/index';
app.use('/api/v1', router);

app.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.json({ 
    status: 'ok', 
    service: 'http-service',
    timestamp: new Date().toISOString(),
    requestId: (req as any).id,
  });
});

// 404 handler (must be after all routes)
app.use(notFoundLogger);

// Error handler (must be last)
app.use(errorLoggerMiddleware);

const PORT = authConfig.PORT;

app.listen(PORT, async () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 HTTP service running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔒 Environment: ${authConfig.NODE_ENV}`);
  logger.info(`📝 Log level: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info('='.repeat(60));
  
  // Initialize bloom filter with existing usernames
  try {
    const bloomService = UsernameBloomFilterService.getInstance();
    await bloomService.initialize();
    logger.info('✓ Username bloom filter initialized successfully');
  } catch (error) {
    logger.error({ error }, '✗ Failed to initialize bloom filter');
  }
  
  logger.info('='.repeat(60));
  logger.info('✅ Server ready to accept connections');
  logger.info('='.repeat(60));
});
