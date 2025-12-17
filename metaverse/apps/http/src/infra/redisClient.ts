import IORedis from 'ioredis';
import authConfig from '../config/auth.config';

export const redis = new IORedis(authConfig.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('✓ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('✗ Redis connection error:', err.message);
});

/**
 * Increment a key with expiry (for rate limiting)
 */
export async function incrWithExpiry(key: string, windowMs: number): Promise<number> {
  const tx = redis.multi();
  tx.incr(key);
  tx.pttl(key);
  
  const results = await tx.exec();
  if (!results) throw new Error('Redis transaction failed');
  
  const value = results[0][1] as number;
  const ttl = results[1][1] as number;
  
  if (ttl === -1) {
    await redis.pexpire(key, windowMs);
  }
  
  return value;
}

/**
 * Check if a key exists in Redis
 */
export async function exists(key: string): Promise<boolean> {
  const result = await redis.exists(key);
  return result === 1;
}

/**
 * Set a key with expiry
 */
export async function setWithExpiry(key: string, value: string, expiryMs: number): Promise<void> {
  await redis.set(key, value, 'PX', expiryMs);
}

/**
 * Delete a key
 */
export async function del(key: string): Promise<void> {
  await redis.del(key);
}

export default redis;
