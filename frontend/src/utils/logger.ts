/**
 * Production-Safe Logger Utility
 * =============================
 * BUG-027 FIX: Memory Leak Prevention
 * 
 * Problem: Console.log statements hold references to logged objects,
 * preventing garbage collection. Large objects (like WebRTC signaling data)
 * can cause significant memory leaks over time.
 * 
 * Solution: Only log in development mode. In production, logs are no-ops
 * that don't retain any object references.
 * 
 * Usage:
 *   import { debugLog, debugWarn, debugError, debugTable } from '@/utils/logger';
 *   
 *   debugLog('🎥 Video call started:', callData);
 *   debugWarn('Connection retry:', attemptNumber);
 *   debugTable(userList);
 * 
 * @module utils/logger
 */

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

// Check if verbose logging is enabled (can be set via localStorage)
const isVerbose = typeof window !== 'undefined' && localStorage.getItem('VERBOSE_LOGGING') === 'true';

/**
 * Log levels for filtering
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Current log level (default: INFO in dev, ERROR in prod)
let currentLogLevel: LogLevel = isDev ? LogLevel.DEBUG : LogLevel.ERROR;

/**
 * Set the current log level
 * Can be called at runtime to adjust logging verbosity
 */
export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

/**
 * Get current log level
 */
export const getLogLevel = (): LogLevel => currentLogLevel;

/**
 * Debug log - only in development
 * For detailed debugging information
 */
export const debugLog = (...args: unknown[]): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.DEBUG) {
    console.log(...args);
  }
};

/**
 * Info log - important information
 * Shown in development by default
 */
export const infoLog = (...args: unknown[]): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.INFO) {
    console.info(...args);
  }
};

/**
 * Warning log - potential issues
 * Always shown in development
 */
export const debugWarn = (...args: unknown[]): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.WARN) {
    console.warn(...args);
  }
};

/**
 * Error log - errors that should always be logged
 * Shown in both development and production
 */
export const debugError = (...args: unknown[]): void => {
  // Always log errors, even in production
  if (currentLogLevel <= LogLevel.ERROR) {
    console.error(...args);
  }
};

/**
 * Table log - for structured data display
 * Only in development
 */
export const debugTable = (data: unknown): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.DEBUG) {
    console.table(data);
  }
};

/**
 * Group log - for collapsible log groups
 * Only in development
 */
export const debugGroup = (label: string, fn: () => void): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.DEBUG) {
    console.group(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }
};

/**
 * Collapsed group log - for less important grouped logs
 * Only in development
 */
export const debugGroupCollapsed = (label: string, fn: () => void): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.DEBUG) {
    console.groupCollapsed(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }
};

/**
 * Time logging utility
 * Returns a function to end timing
 */
export const debugTime = (label: string): (() => void) => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.DEBUG) {
    console.time(label);
    return () => console.timeEnd(label);
  }
  return () => {}; // No-op in production
};

/**
 * Trace log with stack trace
 * Only in development
 */
export const debugTrace = (message?: string): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.DEBUG) {
    console.trace(message);
  }
};

/**
 * Performance log - logs only significant operations
 * Includes timestamp for profiling
 */
export const perfLog = (category: string, operation: string, duration?: number): void => {
  if ((isDev || isVerbose) && currentLogLevel <= LogLevel.INFO) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const durationStr = duration !== undefined ? ` (${duration.toFixed(2)}ms)` : '';
    console.log(`[${timestamp}] 📊 ${category}: ${operation}${durationStr}`);
  }
};

/**
 * Create a scoped logger with a prefix
 * Useful for component-specific logging
 * 
 * Usage:
 *   const log = createLogger('WebSocket');
 *   log.debug('Connected');       // [WebSocket] Connected
 *   log.warn('Reconnecting');     // [WebSocket] Reconnecting
 */
export const createLogger = (prefix: string) => ({
  debug: (...args: unknown[]) => debugLog(`[${prefix}]`, ...args),
  info: (...args: unknown[]) => infoLog(`[${prefix}]`, ...args),
  warn: (...args: unknown[]) => debugWarn(`[${prefix}]`, ...args),
  error: (...args: unknown[]) => debugError(`[${prefix}]`, ...args),
  table: (data: unknown) => {
    if ((isDev || isVerbose) && currentLogLevel <= LogLevel.DEBUG) {
      console.log(`[${prefix}] Table:`);
      debugTable(data);
    }
  }
});

/**
 * Sanitize large objects for safe logging
 * Prevents memory issues from logging huge objects
 * 
 * @param obj Object to sanitize
 * @param maxDepth Maximum nesting depth (default: 2)
 * @param maxArrayItems Maximum array items to keep (default: 10)
 */
export const sanitizeForLog = (obj: unknown, maxDepth = 2, maxArrayItems = 10): unknown => {
  const seen = new WeakSet();

  const sanitize = (value: unknown, depth: number): unknown => {
    // Handle primitives
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    // Prevent circular references
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);

    // Check depth
    if (depth > maxDepth) return '[Max Depth]';

    // Handle arrays
    if (Array.isArray(value)) {
      const truncated = value.slice(0, maxArrayItems);
      const result = truncated.map(item => sanitize(item, depth + 1));
      if (value.length > maxArrayItems) {
        result.push(`[... ${value.length - maxArrayItems} more items]`);
      }
      return result;
    }

    // Handle objects
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Skip functions and large data
      if (typeof val === 'function') {
        result[key] = '[Function]';
      } else if (val instanceof ArrayBuffer || val instanceof Uint8Array) {
        result[key] = `[Binary: ${(val as ArrayBuffer).byteLength || (val as Uint8Array).length} bytes]`;
      } else {
        result[key] = sanitize(val, depth + 1);
      }
    }
    return result;
  };

  return sanitize(obj, 0);
};

// Export development check for conditional rendering of debug UI
export const isDevMode = isDev;
