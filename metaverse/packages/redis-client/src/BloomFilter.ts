/**
 * BloomFilter - Space-efficient probabilistic data structure
 * 
 * PURPOSE:
 * A Bloom filter is a probabilistic data structure used to test whether an
 * element is a member of a set. It can have false positives (saying an element
 * is in the set when it's not) but never false negatives (if it says an element
 * is NOT in the set, it's definitely not there).
 * 
 * USE CASES IN METAVERSE:
 * - Username uniqueness checking: O(1) lookup instead of database query
 * - Spam/bot detection: Quick check for known bad actors
 * - Duplicate message prevention: Prevent processing same message twice
 * 
 * MEMORY USAGE:
 * For 10 million items with 1% false positive rate: ~1.2MB
 * Formula: m = -n * ln(p) / (ln(2)^2)
 * 
 * @author GitHub Copilot
 * @see docs/system-design/bloom-filter.md
 */

import { createClient, RedisClientType } from 'redis';
import crypto from 'node:crypto';

/**
 * Configuration options for the Bloom Filter
 */
export interface BloomFilterConfig {
  /** Expected number of items to be stored */
  expectedItems: number;
  /** Desired false positive rate (0-1, e.g., 0.01 for 1%) */
  falsePositiveRate: number;
  /** Redis key name for the bloom filter */
  redisKey: string;
}

/**
 * BloomFilter - Probabilistic set membership data structure
 * 
 * This implementation uses Redis bit operations for distributed use.
 * Multiple WebSocket servers can share the same Bloom filter.
 */
export class BloomFilter {
  private redis: RedisClientType;
  private config: BloomFilterConfig;
  
  /** Number of bits in the filter */
  private readonly bitSize: number;
  
  /** Number of hash functions to use */
  private readonly hashCount: number;

  /**
   * Creates a new BloomFilter instance
   * 
   * @param redis - Connected Redis client
   * @param config - Filter configuration
   * 
   * @example
   * ```typescript
   * const filter = new BloomFilter(redis, {
   *   expectedItems: 10_000_000, // 10 million users
   *   falsePositiveRate: 0.01,   // 1% false positives OK
   *   redisKey: 'bloom:usernames'
   * });
   * ```
   */
  constructor(redis: RedisClientType, config: BloomFilterConfig) {
    this.redis = redis;
    this.config = config;
    
    // Calculate optimal bit size: m = -n * ln(p) / (ln(2)^2)
    const n = config.expectedItems;
    const p = config.falsePositiveRate;
    this.bitSize = Math.ceil(-n * Math.log(p) / (Math.log(2) ** 2));
    
    // Calculate optimal number of hash functions: k = (m/n) * ln(2)
    this.hashCount = Math.ceil((this.bitSize / n) * Math.log(2));
    
    console.log(`[BloomFilter] Initialized: ${this.bitSize} bits (${(this.bitSize / 8 / 1024 / 1024).toFixed(2)} MB), ${this.hashCount} hash functions`);
  }

  /**
   * Creates a BloomFilter with a new Redis connection
   * 
   * @param redisUrl - Redis connection URL
   * @param config - Filter configuration
   */
  static async create(
    redisUrl: string,
    config: BloomFilterConfig
  ): Promise<BloomFilter> {
    const redis = createClient({ url: redisUrl }) as RedisClientType;
    await redis.connect();
    return new BloomFilter(redis, config);
  }

  // ==========================================================================
  // CORE OPERATIONS
  // ==========================================================================

  /**
   * Adds an item to the Bloom filter
   * 
   * Once added, the item will always return `true` for `mightContain()`.
   * Note: Items cannot be removed from a standard Bloom filter.
   * 
   * @param item - The item to add (will be hashed)
   * 
   * @example
   * ```typescript
   * await filter.add('john_doe');
   * await filter.add('jane_smith');
   * ```
   */
  async add(item: string): Promise<void> {
    const positions = this.getHashPositions(item);
    
    // Set all bit positions using Redis pipeline for efficiency
    const pipeline = this.redis.multi();
    for (const pos of positions) {
      pipeline.setBit(this.config.redisKey, pos, 1);
    }
    await pipeline.exec();
  }

  /**
   * Adds multiple items to the Bloom filter efficiently
   * 
   * @param items - Array of items to add
   */
  async addBatch(items: string[]): Promise<void> {
    const pipeline = this.redis.multi();
    
    for (const item of items) {
      const positions = this.getHashPositions(item);
      for (const pos of positions) {
        pipeline.setBit(this.config.redisKey, pos, 1);
      }
    }
    
    await pipeline.exec();
    console.log(`[BloomFilter] Added ${items.length} items`);
  }

  /**
   * Checks if an item might be in the set
   * 
   * IMPORTANT: This can return false positives!
   * - If it returns `false`, the item is DEFINITELY NOT in the set
   * - If it returns `true`, the item is PROBABLY in the set
   * 
   * @param item - The item to check
   * @returns Promise resolving to true if the item might be in the set
   * 
   * @example
   * ```typescript
   * if (await filter.mightContain('new_username')) {
   *   // Username MIGHT be taken - do a real database check
   *   const exists = await db.user.findUnique({ where: { username } });
   * } else {
   *   // Username is DEFINITELY available
   *   return { available: true };
   * }
   * ```
   */
  async mightContain(item: string): Promise<boolean> {
    const positions = this.getHashPositions(item);
    
    // Check all bit positions - if any is 0, item is definitely not in set
    for (const pos of positions) {
      const bit = await this.redis.getBit(this.config.redisKey, pos);
      if (bit === 0) {
        return false;
      }
    }
    
    // All bits are set - item might be in set
    return true;
  }

  /**
   * Checks multiple items at once efficiently
   * 
   * @param items - Array of items to check
   * @returns Map of item -> boolean (might contain)
   */
  async mightContainBatch(items: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // For each item, we need to check all hash positions
    for (const item of items) {
      results.set(item, await this.mightContain(item));
    }
    
    return results;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Gets the bit positions for a given item
   * 
   * Uses double hashing technique: h(i) = h1 + i * h2
   * This gives us k independent hash functions using just 2 base hashes.
   * 
   * @param item - The item to hash
   * @returns Array of bit positions
   */
  private getHashPositions(item: string): number[] {
    // Create two base hashes using SHA-256
    const hash = crypto.createHash('sha256').update(item).digest();
    
    // Extract two 32-bit integers from the hash
    const h1 = hash.readUInt32BE(0);
    const h2 = hash.readUInt32BE(4);
    
    // Generate k hash positions using double hashing
    const positions: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      const combinedHash = (h1 + i * h2) % this.bitSize;
      positions.push(Math.abs(combinedHash));
    }
    
    return positions;
  }

  /**
   * Clears the Bloom filter (removes all items)
   * 
   * Use with caution - all membership information will be lost.
   */
  async clear(): Promise<void> {
    await this.redis.del(this.config.redisKey);
    console.log('[BloomFilter] Cleared');
  }

  /**
   * Gets statistics about the Bloom filter
   */
  async getStats(): Promise<{
    bitSize: number;
    hashCount: number;
    estimatedItems: number;
    fillRatio: number;
    memorySizeBytes: number;
    falsePositiveRate: number;
  }> {
    // Count set bits to estimate fill ratio
    const setBits = await this.redis.bitCount(this.config.redisKey);
    const fillRatio = setBits / this.bitSize;
    
    // Estimate number of items: n ≈ -m * ln(1 - X/m) / k
    // where X is number of set bits, m is total bits, k is hash count
    const estimatedItems = fillRatio > 0 && fillRatio < 1
      ? Math.round(-this.bitSize * Math.log(1 - fillRatio) / this.hashCount)
      : 0;
    
    // Calculate actual false positive rate: (1 - e^(-kn/m))^k
    const actualFPR = Math.pow(
      1 - Math.exp(-this.hashCount * estimatedItems / this.bitSize),
      this.hashCount
    );
    
    return {
      bitSize: this.bitSize,
      hashCount: this.hashCount,
      estimatedItems,
      fillRatio,
      memorySizeBytes: Math.ceil(this.bitSize / 8),
      falsePositiveRate: actualFPR,
    };
  }

  /**
   * Gets the configuration for this filter
   */
  getConfig(): Readonly<BloomFilterConfig> {
    return { ...this.config };
  }
}

export default BloomFilter;
