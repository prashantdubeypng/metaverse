/**
 * @repo/redis-client
 * 
 * Redis client utilities for the metaverse application.
 * 
 * This package provides:
 * - ConnectionRegistry: Track user connections across multiple WebSocket servers
 * - BloomFilter: Space-efficient probabilistic data structure for membership testing
 * 
 * @module @repo/redis-client
 */

// Connection Registry - Track WebSocket connections across servers
export {
  ConnectionRegistry,
  createConnectionRegistry,
  type ConnectionInfo,
  type ReconnectionTokenOptions,
  type ReconnectionValidationResult,
} from './ConnectionRegistry';

// Bloom Filter - Efficient username/ID uniqueness checking
export { BloomFilter, type BloomFilterConfig } from './BloomFilter';
