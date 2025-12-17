import { Router, Request, Response, NextFunction } from 'express';
import client from '@repo/db';
import { redis } from '../../infra/redisClient';
import os from 'os';

const router = Router();

// Admin credentials - In production, use environment variables and proper hashing
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'metaverse_admin_2024';

// In-memory log storage (circular buffer)
const MAX_LOGS = 500;
const logBuffer: LogEntry[] = [];

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

// Export function to add logs from other parts of the app
export function addAdminLog(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>) {
  logBuffer.push({
    timestamp: new Date(),
    level,
    message,
    metadata
  });
  
  // Keep buffer at max size
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

/**
 * Basic Auth Middleware for Admin Routes
 */
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Apply auth to all admin routes
router.use(adminAuth);

/**
 * GET /api/v1/admin-dashboard/
 * Main dashboard UI with EJS template
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const [
      health,
      database,
      redisStats,
      logs,
      users,
      spaces,
      systemStats
    ] = await Promise.all([
      getHealthChecks(),
      getDatabaseStats(),
      getRedisStats(),
      getRecentLogs(50),
      getUsers(1, 10),
      getSpaces(1, 10),
      getSystemStats()
    ]);

    res.render('admin-dashboard', {
      data: {
        health,
        database,
        redis: redisStats,
        logs,
        users: users.data,
        spaces: spaces.data,
        system: systemStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).send(`
      <html>
        <body style="background:#1e293b;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
          <div style="text-align:center;">
            <h1>Dashboard Error</h1>
            <p>${error instanceof Error ? error.message : 'Failed to load dashboard'}</p>
            <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;">Retry</button>
          </div>
        </body>
      </html>
    `);
  }
});

// Helper function for health checks
async function getHealthChecks() {
  const checks: Record<string, { status: string; latency: number; error?: string }> = {};
  
  checks.http = { status: 'healthy', latency: 0 };

  const dbStart = Date.now();
  try {
    await client.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = { 
      status: 'unhealthy', 
      latency: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
  } catch (error) {
    checks.redis = { 
      status: 'unhealthy', 
      latency: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  const wsStart = Date.now();
  try {
    const wsPort = process.env.WS_SERVICE_PORT || 3001;
    const response = await fetch(`http://localhost:${wsPort}/health`, { 
      signal: AbortSignal.timeout(5000) 
    }).catch(() => null);
    
    if (response?.ok) {
      checks.websocket = { status: 'healthy', latency: Date.now() - wsStart };
    } else {
      checks.websocket = { status: 'unknown', latency: Date.now() - wsStart, error: 'Could not reach WebSocket service' };
    }
  } catch {
    checks.websocket = { status: 'unknown', latency: Date.now() - wsStart, error: 'WebSocket health check failed' };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    checks
  };
}

// Helper function for users
async function getUsers(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    client.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarId: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            spaces: true,
            spaceMembers: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    client.user.count()
  ]);
  return { data: users, total };
}

// Helper function for spaces
async function getSpaces(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [spaces, total] = await Promise.all([
    client.space.findMany({
      skip,
      take: limit,
      include: {
        creator: {
          select: { id: true, username: true }
        },
        _count: {
          select: { members: true }
        }
      },
      orderBy: { id: 'desc' }
    }),
    client.space.count()
  ]);
  return { data: spaces, total };
}

/**
 * GET /api/v1/admin/dashboard
 * Main dashboard with all system information (JSON API)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      systemHealth,
      databaseStats,
      redisStats,
      recentLogs
    ] = await Promise.all([
      getSystemHealth(),
      getDatabaseStats(),
      getRedisStats(),
      getRecentLogs(50)
    ]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        system: systemHealth,
        database: databaseStats,
        redis: redisStats,
        recentLogs
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
    });
  }
});

/**
 * GET /api/v1/admin/health
 * Health check for all services
 */
router.get('/health', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  
  // HTTP Service
  checks.http = { status: 'healthy', latency: 0 };

  // Database check
  const dbStart = Date.now();
  try {
    await client.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = { 
      status: 'unhealthy', 
      latency: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
  } catch (error) {
    checks.redis = { 
      status: 'unhealthy', 
      latency: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // WebSocket service check (try to connect)
  const wsStart = Date.now();
  try {
    const wsPort = process.env.WS_SERVICE_PORT || 3001;
    const response = await fetch(`http://localhost:${wsPort}/health`, { 
      signal: AbortSignal.timeout(5000) 
    }).catch(() => null);
    
    if (response?.ok) {
      checks.websocket = { status: 'healthy', latency: Date.now() - wsStart };
    } else {
      checks.websocket = { status: 'unknown', latency: Date.now() - wsStart, error: 'Could not reach WebSocket service' };
    }
  } catch {
    checks.websocket = { status: 'unknown', latency: Date.now() - wsStart, error: 'WebSocket health check failed' };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');

  // Always return 200 - the status is in the response body for monitoring tools
  res.json({
    success: true,
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks
  });
});

/**
 * GET /api/v1/admin/logs
 * Get recent logs with optional filtering
 */
router.get('/logs', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, MAX_LOGS);
  const level = req.query.level as string;
  const search = req.query.search as string;

  let logs = [...logBuffer].reverse().slice(0, limit);

  if (level) {
    logs = logs.filter(log => log.level === level);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    logs = logs.filter(log => 
      log.message.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
    );
  }

  res.json({
    success: true,
    count: logs.length,
    total: logBuffer.length,
    logs
  });
});

/**
 * GET /api/v1/admin/stats/database
 * Database statistics
 */
router.get('/stats/database', async (req: Request, res: Response) => {
  try {
    const stats = await getDatabaseStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch database stats'
    });
  }
});

/**
 * GET /api/v1/admin/stats/redis
 * Redis statistics
 */
router.get('/stats/redis', async (req: Request, res: Response) => {
  try {
    const stats = await getRedisStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Redis stats'
    });
  }
});

/**
 * GET /api/v1/admin/stats/system
 * System statistics (CPU, memory, etc.)
 */
router.get('/stats/system', async (req: Request, res: Response) => {
  try {
    const stats = await getSystemHealth();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch system stats'
    });
  }
});

/**
 * GET /api/v1/admin/users
 * List all users with pagination
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      client.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatarId: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              spaces: true,
              spaceMembers: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      client.user.count()
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/v1/admin/spaces
 * List all spaces with pagination
 */
router.get('/spaces', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [spaces, total] = await Promise.all([
      client.space.findMany({
        skip,
        take: limit,
        include: {
          creator: {
            select: { id: true, username: true }
          },
          _count: {
            select: { members: true }
          }
        },
        orderBy: { id: 'desc' }
      }),
      client.space.count()
    ]);

    res.json({
      success: true,
      data: spaces,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch spaces'
    });
  }
});

/**
 * GET /api/v1/admin/active-sessions
 * Get active sessions from Redis
 */
router.get('/active-sessions', async (req: Request, res: Response) => {
  try {
    const keys = await redis.keys('space:*:users');
    const sessions: Record<string, unknown>[] = [];

    for (const key of keys) {
      const spaceId = key.split(':')[1];
      const users = await redis.hgetall(key);
      
      if (Object.keys(users).length > 0) {
        sessions.push({
          spaceId,
          userCount: Object.keys(users).length,
          users: Object.entries(users).map(([id, data]) => {
            try {
              return { id, ...JSON.parse(data) };
            } catch {
              return { id, raw: data };
            }
          })
        });
      }
    }

    res.json({
      success: true,
      totalSpaces: sessions.length,
      totalUsers: sessions.reduce((sum, s) => sum + (s.userCount as number), 0),
      sessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch active sessions'
    });
  }
});

/**
 * POST /api/v1/admin/clear-logs
 * Clear all logs
 */
router.post('/clear-logs', (req: Request, res: Response) => {
  logBuffer.length = 0;
  res.json({ success: true, message: 'Logs cleared' });
});

/**
 * DELETE /api/v1/admin/redis/flush-space/:spaceId
 * Clear Redis data for a specific space (useful for stuck sessions)
 */
router.delete('/redis/flush-space/:spaceId', async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;
    const keys = await redis.keys(`space:${spaceId}:*`);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    addAdminLog('warn', `Admin flushed Redis data for space ${spaceId}`, { keysDeleted: keys.length });

    res.json({
      success: true,
      message: `Cleared ${keys.length} Redis keys for space ${spaceId}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to flush space data'
    });
  }
});

// Helper functions

async function getSystemHealth() {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  // Process memory
  const processMemory = process.memoryUsage();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptime: {
      system: os.uptime(),
      process: process.uptime()
    },
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAvg: os.loadavg()
    },
    memory: {
      total: formatBytes(totalMemory),
      free: formatBytes(freeMemory),
      used: formatBytes(usedMemory),
      usagePercent: ((usedMemory / totalMemory) * 100).toFixed(2) + '%'
    },
    processMemory: {
      heapTotal: formatBytes(processMemory.heapTotal),
      heapUsed: formatBytes(processMemory.heapUsed),
      rss: formatBytes(processMemory.rss),
      external: formatBytes(processMemory.external)
    }
  };
}

async function getDatabaseStats() {
  const [userCount, spaceCount, elementCount, avatarCount] = await Promise.all([
    client.user.count(),
    client.space.count(),
    client.element.count(),
    client.avatar.count()
  ]);

  // Get recent activity
  const recentUsers = await client.user.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  });

  const recentSpaces = 0; // Space model doesn't have createdAt - skipping recent count

  return {
    counts: {
      users: userCount,
      spaces: spaceCount,
      elements: elementCount,
      avatars: avatarCount
    },
    last24Hours: {
      newUsers: recentUsers,
      newSpaces: recentSpaces
    },
    status: 'connected'
  };
}

async function getRedisStats() {
  try {
    const info = await redis.info();
    const dbSize = await redis.dbsize();
    
    // Parse Redis INFO response
    const infoObj: Record<string, string> = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        infoObj[key] = value;
      }
    });

    return {
      status: 'connected',
      dbSize,
      memory: infoObj['used_memory_human'] || 'N/A',
      connectedClients: parseInt(infoObj['connected_clients'] || '0'),
      uptimeSeconds: parseInt(infoObj['uptime_in_seconds'] || '0'),
      version: infoObj['redis_version'] || 'N/A'
    };
  } catch (error) {
    return {
      status: 'error',
      dbSize: 0,
      memory: 'N/A',
      connectedClients: 0,
      uptimeSeconds: 0,
      version: 'N/A',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function getRecentLogs(limit: number) {
  return [...logBuffer].reverse().slice(0, limit);
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

async function getSystemStats() {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  // Calculate CPU usage
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  return {
    cpu: {
      usage: cpuUsage,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown'
    },
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: (usedMemory / totalMemory) * 100
    },
    uptime: os.uptime()
  };
}

export default router;
