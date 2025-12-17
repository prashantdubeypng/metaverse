# Bloom Filter Quick Start Guide

## 🚀 Getting Started

### 1. Start the Backend

```bash
cd metaverse/apps/http
npm run dev
```

The bloom filter will automatically initialize with all existing usernames from the database.

You should see:
```
HTTP service running on port 8000
Initializing username bloom filter...
Bloom filter initialized with X usernames
✓ Username bloom filter initialized successfully
```

### 2. Start the Frontend

```bash
cd frontend
npm run dev
```

Navigate to: `http://localhost:3000/signup`

### 3. Test Real-Time Username Checking

1. Go to the signup page
2. Start typing a username
3. Watch the real-time feedback:
   - **Spinner**: Checking availability
   - **Green checkmark**: Username is available
   - **Red X**: Username is taken

### 4. Test with Demo Page (Optional)

Open `metaverse/apps/http/test-username-check.html` in your browser to see a standalone demo with bloom filter statistics.

## 🧪 Testing the Bloom Filter

### Run Unit Tests

```bash
cd metaverse/apps/http
npx tsx src/test-bloomfilter.ts
```

Expected output:
```
=== Bloom Filter Test ===

1. Adding usernames to bloom filter...
   Added 10 usernames

2. Testing existing usernames (should all return true):
   alice: ✓ Found
   bob: ✓ Found
   ...

3. Testing non-existent usernames (should return false):
   zara: ✓ Not found (correct)
   ...

4. False positive rate test:
   False positives: 0 out of 10000 checks
   False positive rate: 0.0000%
   Expected FPR: ~0.05% (with 10 items in 50k buckets)

5. Bloom filter statistics:
   Size: 50000 bits
   Hash functions: 3
   Estimated FPR: 0.0001%
```

### API Testing

#### Check Username Availability
```bash
curl http://localhost:8000/api/v1/auth/check-username/testuser123
```

Response:
```json
{
  "available": true,
  "username": "testuser123",
  "checkedWithDb": false
}
```

#### Get Bloom Filter Statistics
```bash
curl http://localhost:8000/api/v1/auth/bloom-stats
```

Response:
```json
{
  "size": 50000,
  "hashFunctions": 3,
  "estimatedFPR": 0.00001,
  "estimatedFPRPercentage": "0.0010%",
  "memoryUsageBytes": 6250,
  "memoryUsageKB": "6.10 KB"
}
```

## 📊 How It Works

### The Flow

```
User types "john" → Wait 500ms (debounce) → API call
                                                ↓
                                    GET /auth/check-username/john
                                                ↓
                                        Bloom filter check
                                                ↓
                        ┌───────────────────────┴───────────────────────┐
                        ↓                                               ↓
            Definitely NOT in filter                        Possibly in filter
            (0% false negative)                            (small false positive)
                        ↓                                               ↓
            Return: available=true                          Query database
            checkedWithDb=false                                         ↓
                                                            Return actual result
                                                            checkedWithDb=true
```

### Key Benefits

1. **Speed**: Most checks (99%+) don't hit the database
2. **Accuracy**: Zero false negatives (never says available when taken)
3. **Memory**: Only 6.1 KB for 50,000 buckets
4. **UX**: Instant feedback while typing

## 🎯 Real-World Example

Let's say you have 1,000 registered users:

1. User types "newuser123"
2. Bloom filter checks in < 0.001ms
3. Result: "Definitely not taken" (no DB query)
4. Frontend shows green checkmark instantly

If user types "existinguser":

1. Bloom filter checks in < 0.001ms
2. Result: "Possibly taken" (needs verification)
3. Database query confirms it's taken
4. Frontend shows red X

### Performance Comparison

**Without Bloom Filter:**
- Every keystroke → Database query
- 10 characters typed = 10 DB queries
- Slow, expensive, high DB load

**With Bloom Filter:**
- 99% of checks → No database query
- 10 characters typed = ~1 DB query (only if username exists)
- Fast, cheap, minimal DB load

## 🔧 Configuration

### Adjust Parameters

Edit `metaverse/apps/http/src/services/usernameBloomFilter.ts`:

```typescript
// Current: 50k buckets, 3 hash functions
this.bloomFilter = new BloomFilter(50000, 3);

// For 100k users with low FPR:
this.bloomFilter = new BloomFilter(200000, 4);

// For 1k users (smaller memory):
this.bloomFilter = new BloomFilter(10000, 3);
```

### Parameter Calculator

For `n` expected users and `p` desired false positive rate:

```
m = -(n × ln(p)) / (ln(2)²)  // bits needed
k = (m/n) × ln(2)             // hash functions
```

Example: 10,000 users, 0.1% FPR
- m ≈ 143,775 bits (17.6 KB)
- k ≈ 10 hash functions

## 📈 Monitoring

### Check Statistics

```bash
curl http://localhost:8000/api/v1/auth/bloom-stats
```

Monitor:
- **estimatedFPRPercentage**: Should stay low (< 1%)
- **memoryUsageKB**: Should be reasonable (< 100 KB)

If FPR gets too high, increase bucket size.

## 🐛 Troubleshooting

### Bloom filter not initializing

**Problem**: Server starts but bloom filter doesn't initialize

**Solution**: Check database connection and ensure Prisma client is working:
```bash
cd metaverse/packages/db
npx prisma generate
```

### High false positive rate

**Problem**: Too many usernames flagged as "possibly taken"

**Solution**: Increase bucket size:
```typescript
this.bloomFilter = new BloomFilter(100000, 3); // Double the size
```

### Frontend not showing real-time feedback

**Problem**: No visual feedback when typing

**Solution**: 
1. Check browser console for errors
2. Verify backend is running on port 8000
3. Check CORS configuration

## 🎓 Learn More

- Read `BLOOM_FILTER_IMPLEMENTATION.md` for detailed architecture
- Check `metaverse/apps/http/src/test-bloomfilter.ts` for examples
- Open `test-username-check.html` for interactive demo

## 💡 Tips

1. **Debounce is key**: 500ms prevents excessive API calls
2. **Visual feedback matters**: Users love instant validation
3. **Monitor FPR**: Keep it under 1% for best UX
4. **Scale gradually**: Start with 50k buckets, increase as needed
5. **Cache results**: Consider adding Redis for frequently checked usernames

## 🚀 Next Steps

1. Add Redis persistence for bloom filter state
2. Implement distributed bloom filter for multiple servers
3. Add analytics to track DB query savings
4. Create admin dashboard for bloom filter monitoring
5. Implement auto-scaling based on user growth
