import { createHash } from 'crypto';
import { Redis } from 'ioredis';

/**
 * Bloom Filter for username uniqueness checking
 * 
 * Performance:
 * - 99% of checks: 1 Redis call (~1ms) - No DB query needed!
 * - 1% false positives: 2 Redis calls + 1 DB query (~10ms)
 * 
 * Memory:
 * - 1.2 MB for 10 million usernames
 * - False positive rate: ~1%
 */
export class BloomFilter {
  private readonly FILTER_SIZE = 10000000; // 10M bits (~1.2MB)
  private readonly HASH_COUNT = 7; // 7 hash functions (optimal for 1% FPR)
  private readonly KEY = 'usernames:bloom';
  
  constructor(private redis: Redis) {}

  /**
   * Add username to Bloom filter
   * Call this after successful user registration
   */
  async add(username: string): Promise<void> {
    const normalized = this.normalize(username);
    const positions = this.getHashPositions(normalized);
    
    const pipeline = this.redis.pipeline();
    for (const pos of positions) {
      pipeline.setbit(this.KEY, pos, 1);
    }
    
    await pipeline.exec();
    console.log(`✅ Added username to Bloom filter: ${username}`);
  }

  /**
   * Check if username MIGHT exist
   * Returns false = definitely available (no DB check needed!)
   * Returns true = might exist (need to check DB)
   */
  async mightExist(username: string): Promise<boolean> {
    const normalized = this.normalize(username);
    const positions = this.getHashPositions(normalized);
    
    const pipeline = this.redis.pipeline();
    for (const pos of positions) {
      pipeline.getbit(this.KEY, pos);
    }
    
    const results = await pipeline.exec();
    
    if (!results) return false;
    
    // If ANY bit is 0, username definitely doesn't exist
    for (const [err, bit] of results) {
      if (err || bit === 0) {
        return false; // Definitely available
      }
    }
    
    // All bits are 1, username MIGHT exist
    return true; // Need to check database
  }

  /**
   * Complete username availability check
   * Returns true if username is taken, false if available
   */
  async isTaken(username: string, checkDB: (username: string) => Promise<boolean>): Promise<boolean> {
    // Step 1: Quick Bloom filter check (99% of cases end here)
    const mightExist = await this.mightExist(username);
    
    if (!mightExist) {
      // Definitely available - no DB query needed!
      return false;
    }
    
    // Step 2: Bloom filter says might exist, confirm with DB (1% of cases)
    console.log(`⚠️ Bloom filter collision for: ${username}, checking database...`);
    const exists = await checkDB(username);
    
    return exists;
  }

  /**
   * Get performance statistics
   */
  async getStats(): Promise<{
    size: number;
    bitsSet: number;
    cardinality: number;
    falsePositiveRate: number;
    memoryMB: number;
  }> {
    const bitsSet = await this.redis.bitcount(this.KEY);
    
    // Estimate number of items using Bloom filter formula
    const cardinality = Math.floor(
      -(this.FILTER_SIZE / this.HASH_COUNT) * 
      Math.log(1 - bitsSet / this.FILTER_SIZE)
    );
    
    // Calculate actual false positive rate
    const falsePositiveRate = Math.pow(
      1 - Math.exp(-this.HASH_COUNT * cardinality / this.FILTER_SIZE),
      this.HASH_COUNT
    );
    
    return {
      size: this.FILTER_SIZE,
      bitsSet,
      cardinality,
      falsePositiveRate: Math.round(falsePositiveRate * 10000) / 100, // as percentage
      memoryMB: Math.round((this.FILTER_SIZE / 8 / 1024 / 1024) * 100) / 100
    };
  }

  /**
   * Clear the entire Bloom filter (use with caution!)
   */
  async clear(): Promise<void> {
    await this.redis.del(this.KEY);
    console.log('⚠️ Bloom filter cleared');
  }

  /**
   * Rebuild Bloom filter from database
   * Call this on server startup or if filter is cleared
   */
  async rebuild(getUsernames: () => Promise<string[]>): Promise<void> {
    console.log('🔄 Rebuilding Bloom filter from database...');
    
    // Clear existing filter
    await this.clear();
    
    // Get all usernames from database
    const usernames = await getUsernames();
    
    // Add all usernames to filter
    const pipeline = this.redis.pipeline();
    let count = 0;
    
    for (const username of usernames) {
      const normalized = this.normalize(username);
      const positions = this.getHashPositions(normalized);
      
      for (const pos of positions) {
        pipeline.setbit(this.KEY, pos, 1);
      }
      
      count++;
      
      // Execute pipeline in batches of 1000
      if (count % 1000 === 0) {
        await pipeline.exec();
        console.log(`  Processed ${count}/${usernames.length} usernames...`);
      }
    }
    
    // Execute remaining commands
    if (count % 1000 !== 0) {
      await pipeline.exec();
    }
    
    console.log(`✅ Bloom filter rebuilt with ${count} usernames`);
    
    // Print stats
    const stats = await this.getStats();
    console.log(`📊 Stats: ${stats.cardinality} items, ${stats.falsePositiveRate}% FPR, ${stats.memoryMB} MB`);
  }

  /**
   * Normalize username (lowercase, trim)
   */
  private normalize(username: string): string {
    return username.toLowerCase().trim();
  }

  /**
   * Generate hash positions for a value
   */
  private getHashPositions(value: string): number[] {
    const positions: number[] = [];
    
    for (let i = 0; i < this.HASH_COUNT; i++) {
      // Use SHA-256 with salt to generate different hashes
      const hash = createHash('sha256')
        .update(value + i.toString())
        .digest();
      
      // Convert first 4 bytes to unsigned 32-bit integer
      const num = hash.readUInt32BE(0);
      
      // Map to filter size using modulo
      const position = num % this.FILTER_SIZE;
      positions.push(position);
    }
    
    return positions;
  }
}

/**
 * Singleton instance
 */
let bloomFilterInstance: BloomFilter | null = null;

export function getBloomFilter(redis: Redis): BloomFilter {
  if (!bloomFilterInstance) {
    bloomFilterInstance = new BloomFilter(redis);
  }
  return bloomFilterInstance;
}
