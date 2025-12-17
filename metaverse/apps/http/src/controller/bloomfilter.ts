import crypto from 'crypto';

/**
 * Optimized Bloom Filter for username availability checking
 * - 50,000 buckets (bits) for low false positive rate
 * - 3 hash functions for optimal performance
 * - Expected false positive rate: ~0.05% for 10k usernames
 */
class BloomFilter {
  private m: number;           // number of bits
  private k: number;           // number of hash functions
  private byteLength: number;
  private bits: Uint8Array;
  private salts: string[];

  /**
   * Create a Bloom Filter
   * @param {number} m - number of buckets (bits) - default 50000
   * @param {number} k - number of hash functions - default 3
   */
  constructor(m = 50000, k = 3) {
    if (!Number.isInteger(m) || m <= 0) throw new Error('m must be a positive integer');
    if (!Number.isInteger(k) || k <= 0) throw new Error('k must be a positive integer');
    
    this.m = m;
    this.k = k;
    this.byteLength = Math.ceil(m / 8);
    this.bits = new Uint8Array(this.byteLength);
    this.salts = Array.from({ length: k }, (_, i) => `salt-${i + 1}`);
  }

  // Set a bit at position idx (0..m-1)
  private _setBit(idx: number): void {
    const byteIndex = Math.floor(idx / 8);
    const bitOffset = idx % 8;
    this.bits[byteIndex] |= (1 << bitOffset);
  }

  // Get bit at position idx
  private _getBit(idx: number): boolean {
    const byteIndex = Math.floor(idx / 8);
    const bitOffset = idx % 8;
    return (this.bits[byteIndex] & (1 << bitOffset)) !== 0;
  }

  // Convert a 32-bit unsigned integer to an index in [0, m-1]
  private _toIndex(uint32: number): number {
    return uint32 % this.m;
  }

  // Produce k hash indices for the input (string or Buffer)
  private _indices(value: string | Buffer): number[] {
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(String(value).toLowerCase());
    const indices: number[] = new Array(this.k);
    
    for (let i = 0; i < this.k; i++) {
      const h = crypto.createHash('sha256')
        .update(this.salts[i])
        .update(buf)
        .digest();
      
      const uint32 = h.readUInt32BE(0);
      indices[i] = this._toIndex(uint32);
    }
    
    return indices;
  }

  /**
   * Add an item to the Bloom filter
   */
  add(value: string): void {
    const indices = this._indices(value);
    for (const idx of indices) {
      this._setBit(idx);
    }
  }

  /**
   * Check if an item is (possibly) in the set
   * Returns true if item might exist (with small false positive probability)
   * Returns false if item definitely does not exist
   */
  has(value: string): boolean {
    const indices = this._indices(value);
    return indices.every(idx => this._getBit(idx));
  }

  /**
   * Serialize the bit array to a compact base64 string
   */
  serialize(): string {
    return Buffer.from(this.bits).toString('base64');
  }

  /**
   * Load state from a previously serialized string
   */
  static deserialize(base64: string, m = 50000, k = 3): BloomFilter {
    const buf = Buffer.from(base64, 'base64');
    const bf = new BloomFilter(m, k);
    
    if (buf.length !== bf.byteLength) {
      throw new Error('Serialized size mismatch for provided m');
    }
    
    bf.bits = new Uint8Array(buf);
    return bf;
  }

  /**
   * Get statistics about the bloom filter
   */
  getStats(): { size: number; hashFunctions: number; estimatedFPR: number } {
    // Count set bits
    let setBits = 0;
    for (let i = 0; i < this.m; i++) {
      if (this._getBit(i)) setBits++;
    }
    
    // Estimate false positive rate: (setBits/m)^k
    const estimatedFPR = Math.pow(setBits / this.m, this.k);
    
    return {
      size: this.m,
      hashFunctions: this.k,
      estimatedFPR: estimatedFPR
    };
  }
}

export default BloomFilter;
