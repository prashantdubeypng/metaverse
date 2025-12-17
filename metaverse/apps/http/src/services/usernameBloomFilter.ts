import BloomFilter from '../controller/bloomfilter';
import client from '@repo/db';

/**
 * Singleton service for managing username availability using Bloom Filter
 * Optimized with 50k buckets and 3 hash functions for minimal false positives
 */
class UsernameBloomFilterService {
  private static instance: UsernameBloomFilterService;
  private bloomFilter: BloomFilter;
  private isInitialized: boolean = false;

  private constructor() {
    // Initialize with optimized parameters: 50k buckets, 3 hash functions
    this.bloomFilter = new BloomFilter(50000, 3);
  }

  static getInstance(): UsernameBloomFilterService {
    if (!UsernameBloomFilterService.instance) {
      UsernameBloomFilterService.instance = new UsernameBloomFilterService();
    }
    return UsernameBloomFilterService.instance;
  }

  /**
   * Initialize the bloom filter with all existing usernames from database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Bloom filter already initialized');
      return;
    }

    try {
      console.log('Initializing username bloom filter...');
      
      // Fetch all usernames from database
      const users = await client.user.findMany({
        select: { username: true }
      });

      // Add all existing usernames to bloom filter
      for (const user of users) {
        this.bloomFilter.add(user.username);
      }

      this.isInitialized = true;
      
      const stats = this.bloomFilter.getStats();
      console.log(`Bloom filter initialized with ${users.length} usernames`);
      console.log(`Stats:`, stats);
      console.log(`Estimated false positive rate: ${(stats.estimatedFPR * 100).toFixed(4)}%`);
    } catch (error) {
      console.error('Failed to initialize bloom filter:', error);
      throw error;
    }
  }

  /**
   * Add a new username to the bloom filter
   */
  addUsername(username: string): void {
    this.bloomFilter.add(username);
  }

  /**
   * Check if username might be taken (with small false positive probability)
   * Returns true if username is LIKELY taken
   * Returns false if username is DEFINITELY available
   */
  async isUsernameTaken(username: string): Promise<{ 
    likelyTaken: boolean; 
    needsDbCheck: boolean;
    definitelyAvailable: boolean;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const likelyTaken = this.bloomFilter.has(username);
    
    if (!likelyTaken) {
      // Bloom filter says definitely not taken - no DB check needed
      return {
        likelyTaken: false,
        needsDbCheck: false,
        definitelyAvailable: true
      };
    }

    // Bloom filter says might be taken - need DB verification to rule out false positive
    const existingUser = await client.user.findUnique({
      where: { username },
      select: { id: true }
    });

    return {
      likelyTaken: !!existingUser,
      needsDbCheck: true,
      definitelyAvailable: !existingUser
    };
  }

  /**
   * Fast check without DB verification (may have false positives)
   * Use this for real-time UI feedback
   */
  quickCheck(username: string): boolean {
    if (!this.isInitialized) {
      return false; // Assume available if not initialized
    }
    return this.bloomFilter.has(username);
  }

  /**
   * Get bloom filter statistics
   */
  getStats() {
    return this.bloomFilter.getStats();
  }

  /**
   * Seed bloom filter from database in batches (for large datasets)
   */
  async seedFromDatabase(batchSize: number = 10000): Promise<void> {
    if (this.isInitialized) {
      console.log('Bloom filter already initialized, skipping seed');
      return;
    }

    try {
      console.log('Seeding bloom filter from database in batches...');
      let cursor: string | undefined = undefined;
      let totalProcessed = 0;

      while (true) {
        const users = await client.user.findMany({
          take: batchSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: { id: true, username: true },
          orderBy: { id: 'asc' },
        });

        if (users.length === 0) break;

        for (const user of users) {
          this.bloomFilter.add(user.username);
          totalProcessed++;
        }

        cursor = users[users.length - 1].id;
        
        // Yield to event loop to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      this.isInitialized = true;
      console.log(`✓ Bloom filter seeded with ${totalProcessed} usernames`);
    } catch (error) {
      console.error('Failed to seed bloom filter:', error);
      throw error;
    }
  }
}

export default UsernameBloomFilterService;
