import pinoHttp from 'pino-http';
import { logger, accessLogger } from '../utils/logger';
import { Request } from 'express';

/**
 * HTTP request/response logger middleware
 * Logs all HTTP requests with timing, status codes, and request details
 */
export const httpLoggerMiddleware = pinoHttp({
  logger: accessLogger,
  
  // Use request ID from middleware
  genReqId: (req: Request) => (req as any).id,
  
  // Custom serializers
  serializers: {
    req: (req) => ({
      id: (req as any).id,
      method: req.method,
      url: req.url,
      path: req.raw.url,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        'content-type': res.headers['content-type'],
        'content-length': res.headers['content-length'],
      },
    }),
  },
  
  // Custom log level based on status code
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'info';
    return 'info';
  },
  
  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  
  // Custom error message
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  
  // Custom attribute keys
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'duration',
  },
  
  // Auto-logging
  autoLogging: true,
  
  // Custom props to add to each log
  customProps: (req, res) => ({
    requestId: (req as any).id,
    userId: (req as any).user?.userId,
    username: (req as any).user?.username,
  }),
});

/**
 * Attach child logger to request for use in route handlers
 */
export function attachRequestLogger(req: any, res: any, next: any) {
  // Create child logger with request context
  req.log = logger.child({
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
  });
  
  next();
}
