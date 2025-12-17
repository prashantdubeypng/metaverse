import { createLogger, createErrorLogger, createAccessLogger } from '../config/logger.config';

/**
 * Main application logger
 * Use this for general application logging
 */
export const logger = createLogger();

/**
 * Error logger
 * Writes only errors to separate error.log file
 */
export const errorLogger = createErrorLogger();

/**
 * Access logger
 * Writes HTTP access logs to separate access.log file
 */
export const accessLogger = createAccessLogger();

/**
 * Override console methods to use Pino
 * This ensures all console.log/error calls are captured
 */
export function captureConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  console.log = (...args: any[]) => {
    logger.info({ msg: args.map(String).join(' '), source: 'console.log' });
  };

  console.error = (...args: any[]) => {
    logger.error({ msg: args.map(String).join(' '), source: 'console.error' });
    errorLogger.error({ msg: args.map(String).join(' '), source: 'console.error' });
  };

  console.warn = (...args: any[]) => {
    logger.warn({ msg: args.map(String).join(' '), source: 'console.warn' });
  };

  console.info = (...args: any[]) => {
    logger.info({ msg: args.map(String).join(' '), source: 'console.info' });
  };

  console.debug = (...args: any[]) => {
    logger.debug({ msg: args.map(String).join(' '), source: 'console.debug' });
  };

  return originalConsole;
}

/**
 * Capture Prisma logs
 */
export function capturePrismaLogs(prismaClient: any) {
  prismaClient.$on('query', (e: any) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: e.duration,
      source: 'prisma',
    }, 'Database query');
  });

  prismaClient.$on('error', (e: any) => {
    logger.error({ error: e, source: 'prisma' }, 'Database error');
    errorLogger.error({ error: e, source: 'prisma' }, 'Database error');
  });

  prismaClient.$on('warn', (e: any) => {
    logger.warn({ warning: e, source: 'prisma' }, 'Database warning');
  });
}

/**
 * Capture uncaught exceptions and unhandled rejections
 */
export function captureUncaughtErrors() {
  process.on('uncaughtException', (err: Error) => {
    logger.fatal({ err, source: 'uncaughtException' }, 'Uncaught exception - exiting');
    errorLogger.fatal({ err, source: 'uncaughtException' }, 'Uncaught exception - exiting');
    
    // Flush logs and exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    // Log but don't exit - some unhandled rejections (like Redis connection) are recoverable
    logger.error({
      reason,
      promise: String(promise),
      source: 'unhandledRejection',
    }, 'Unhandled rejection (non-fatal)');
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

export default logger;
