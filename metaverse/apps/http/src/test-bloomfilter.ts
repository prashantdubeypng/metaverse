/**
 * Test script for Bloom Filter implementation
 * Run with: npx tsx src/test-bloomfilter.ts
 */

import BloomFilter from './controller/bloomfilter';

console.log('=== Bloom Filter Test ===\n');

// Create bloom filter with 50k buckets and 3 hash functions
const bf = new BloomFilter(50000, 3);

console.log('1. Adding usernames to bloom filter...');
const testUsernames = [
  'alice', 'bob', 'charlie', 'david', 'eve',
  'frank', 'grace', 'henry', 'iris', 'jack'
];

testUsernames.forEach(username => bf.add(username));
console.log(`   Added ${testUsernames.length} usernames\n`);

console.log('2. Testing existing usernames (should all return true):');
testUsernames.forEach(username => {
  const exists = bf.has(username);
  console.log(`   ${username}: ${exists ? '✓ Found' : '✗ Not found'}`);
});

console.log('\n3. Testing non-existent usernames (should return false):');
const nonExistentUsernames = ['zara', 'yuki', 'xavier', 'wendy', 'victor'];
nonExistentUsernames.forEach(username => {
  const exists = bf.has(username);
  console.log(`   ${username}: ${exists ? '✗ False positive!' : '✓ Not found (correct)'}`);
});

console.log('\n4. False positive rate test:');
let falsePositives = 0;
const trials = 10000;

for (let i = 0; i < trials; i++) {
  const randomUsername = `user_${Math.random().toString(36).substring(7)}`;
  if (bf.has(randomUsername)) {
    falsePositives++;
  }
}

const fpr = (falsePositives / trials) * 100;
console.log(`   False positives: ${falsePositives} out of ${trials} checks`);
console.log(`   False positive rate: ${fpr.toFixed(4)}%`);
console.log(`   Expected FPR: ~0.05% (with 10 items in 50k buckets)`);

console.log('\n5. Bloom filter statistics:');
const stats = bf.getStats();
console.log(`   Size: ${stats.size} bits`);
console.log(`   Hash functions: ${stats.hashFunctions}`);
console.log(`   Estimated FPR: ${(stats.estimatedFPR * 100).toFixed(4)}%`);

console.log('\n6. Serialization test:');
const serialized = bf.serialize();
console.log(`   Serialized size: ${serialized.length} characters`);
console.log(`   First 50 chars: ${serialized.substring(0, 50)}...`);

const bf2 = BloomFilter.deserialize(serialized, 50000, 3);
console.log('   Deserialized successfully');
console.log(`   Testing 'alice' in deserialized filter: ${bf2.has('alice') ? '✓' : '✗'}`);

console.log('\n=== Test Complete ===');
