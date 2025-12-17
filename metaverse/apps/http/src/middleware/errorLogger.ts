import { Request, Response, NextFunction } from 'express';
import { errorLogger } from '../utils/logger';

/**
 * Error logging middleware
 * Catches and logs all errors that occur in the application
 */
export function errorLoggerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error with full context
  const log = (req as any).log || errorLogger;
  
  log.error({
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    request: {
      id: (req as any).id,
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      body: req.body,
      query: req.query,
      params: req.params,
    },
    user: (req as any).user,
    ip: req.ip,
  }, 'Unhandled error in request');
  
  // Also log to error logger
  errorLogger.error({
    err,
    requestId: (req as any).id,
    method: req.method,
    url: req.url,
    userId: (req as any).user?.userId,
  }, 'Application error');
  
  // Send error response
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      requestId: (req as any).id,
    });
  }
}

/**
 * 404 Not Found logger
 */
export function notFoundLogger(req: Request, res: Response) {
  const log = (req as any).log || errorLogger;
  
  log.warn({
    requestId: (req as any).id,
    method: req.method,
    url: req.url,
    ip: req.ip,
  }, '404 Not Found');
  
  res.status(404).json({
    error: 'Not Found',
    requestId: (req as any).id,
  });
}
