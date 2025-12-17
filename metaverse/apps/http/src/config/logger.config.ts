import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Get directory paths - use CommonJS compatible approach
const logDir = path.join(__dirname, '..', '..', 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Pino logger configuration
 */
export const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  
  // Base fields included in every log
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'unknown',
    service: 'metaverse-http',
    environment: process.env.NODE_ENV || 'development',
  },
  
  // ISO timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.oldPassword',
      'req.body.token',
      'user.password',
      'password',
      'token',
      'refreshToken',
      'accessToken',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  
  // Serializers for common objects
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
};

/**
 * Create main application logger
 */
export const createLogger = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    // Development: Pretty print to console
    return pino({
      ...loggerConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    });
  } else {
    // Production: Write JSON to stdout (use external log management)
    return pino(loggerConfig);
  }
};

/**
 * Create error logger (in dev, same as main logger)
 */
export const createErrorLogger = () => {
  return createLogger();
};

/**
 * Create access logger (in dev, same as main logger)
 */
export const createAccessLogger = () => {
  return createLogger();
};

// Export log directory path
export { logDir };
