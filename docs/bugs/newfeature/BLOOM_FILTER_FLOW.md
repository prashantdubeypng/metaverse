# Bloom Filter Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Signup Page (page.tsx)                                │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  Username Input Field                        │     │    │
│  │  │  [john_____________] 🔄                       │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │                    ↓                                    │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  useUsernameAvailability Hook                │     │    │
│  │  │  • Debounce (500ms)                          │     │    │
│  │  │  • Cancel previous requests                  │     │    │
│  │  │  • Manage loading state                      │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP GET
                           │ /api/v1/auth/check-username/john
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  API Route (routes/v1/index.ts)                        │    │
│  │  GET /auth/check-username/:username                    │    │
│  └────────────────────────┬───────────────────────────────┘    │
│                           ↓                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  UsernameBloomFilterService (Singleton)                │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  isUsernameTaken("john")                     │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │                    ↓                                    │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  BloomFilter.has("john")                     │     │    │
│  │  │  • Hash with 3 functions                     │     │    │
│  │  │  • Check 3 bit positions                     │     │    │
│  │  │  • Time: < 0.001ms                           │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  └────────────────────────┬───────────────────────────────┘    │
│                           ↓                                     │
│              ┌────────────┴────────────┐                        │
│              ↓                         ↓                        │
│    ┌──────────────────┐      ┌──────────────────┐             │
│    │  All bits = 0    │      │  All bits = 1    │             │
│    │  (NOT in filter) │      │  (MAYBE in set)  │             │
│    └────────┬─────────┘      └────────┬─────────┘             │
│             ↓                          ↓                        │
│    ┌──────────────────┐      ┌──────────────────┐             │
│    │  Return:         │      │  Query Database  │             │
│    │  available=true  │      │  (verification)  │             │
│    │  checkedWithDb=  │      └────────┬─────────┘             │
│    │  false           │               ↓                        │
│    │                  │      ┌──────────────────┐             │
│    │  (99% of cases)  │      │  Return actual   │             │
│    │                  │      │  result from DB  │             │
│    │                  │      │  checkedWithDb=  │             │
│    │                  │      │  true            │             │
│    └──────────────────┘      └──────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Flow: User Types Username

```
Step 1: User Types
┌─────────────────┐
│ User types "j"  │
└────────┬────────┘
         ↓
┌─────────────────────────┐
│ Too short (< 3 chars)   │
│ Show: "Min 3 chars"     │
└─────────────────────────┘

Step 2: User Types More
┌─────────────────┐
│ User types "jo" │
└────────┬────────┘
         ↓
┌─────────────────────────┐
│ Still too short         │
│ Show: "Min 3 chars"     │
└─────────────────────────┘

Step 3: Valid Length
┌──────────────────┐
│ User types "joh" │
└────────┬─────────┘
         ↓
┌─────────────────────────┐
│ Start debounce timer    │
│ Show: 🔄 "Checking..."  │
└────────┬────────────────┘
         ↓
┌─────────────────────────┐
│ Wait 500ms              │
└────────┬────────────────┘
         ↓
┌─────────────────────────┐
│ Make API call           │
│ GET /check-username/joh │
└────────┬────────────────┘
         ↓
┌─────────────────────────┐
│ Bloom filter check      │
│ Time: < 0.001ms         │
└────────┬────────────────┘
         ↓
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌────────┐
│ Not in │ │ Maybe  │
│ filter │ │ in set │
└───┬────┘ └───┬────┘
    ↓          ↓
┌────────┐ ┌────────┐
│ Return │ │ Query  │
│ avail. │ │ DB     │
└───┬────┘ └───┬────┘
    ↓          ↓
┌────────┐ ┌────────┐
│ Show ✓ │ │ Show ✗ │
│ Green  │ │ Red    │
└────────┘ └────────┘
```

## Bloom Filter Internal Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Bloom Filter (50,000 bits)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Bit Array: [0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,0,1,0,0,...]  │
│              ↑     ↑     ↑         ↑           ↑            │
│              │     │     │         │           │            │
│           Position Position Position Position Position      │
│              123   456   789      1234       5678           │
│                                                              │
│  When adding "john":                                        │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 1. Hash with salt-1 → position 1234 → set bit 1  │      │
│  │ 2. Hash with salt-2 → position 5678 → set bit 1  │      │
│  │ 3. Hash with salt-3 → position 9012 → set bit 1  │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│  When checking "john":                                      │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 1. Hash with salt-1 → position 1234 → check bit  │      │
│  │ 2. Hash with salt-2 → position 5678 → check bit  │      │
│  │ 3. Hash with salt-3 → position 9012 → check bit  │      │
│  │                                                   │      │
│  │ If ALL 3 bits are 1 → "Maybe in set"            │      │
│  │ If ANY bit is 0 → "Definitely NOT in set"       │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Hash Function Process

```
Input: "john"
         ↓
┌─────────────────────────────────────┐
│ Hash Function 1 (with salt-1)       │
│ SHA-256("salt-1" + "john")          │
│ → 0x3a7f2c1b...                     │
│ → Take first 4 bytes                │
│ → Convert to uint32: 982,347,291   │
│ → Modulo 50,000: position 7,291    │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Hash Function 2 (with salt-2)       │
│ SHA-256("salt-2" + "john")          │
│ → 0x8b4e9d2a...                     │
│ → Take first 4 bytes                │
│ → Convert to uint32: 2,341,234,218 │
│ → Modulo 50,000: position 34,218   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Hash Function 3 (with salt-3)       │
│ SHA-256("salt-3" + "john")          │
│ → 0x1c5a8f3e...                     │
│ → Take first 4 bytes                │
│ → Convert to uint32: 476,823,870   │
│ → Modulo 50,000: position 23,870   │
└─────────────────────────────────────┘
         ↓
Result: [7291, 34218, 23870]
```

## Server Startup Initialization

```
┌─────────────────────────────────────┐
│ Server starts                       │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Initialize BloomFilterService       │
│ • Create 50k bit array              │
│ • Initialize 3 hash functions       │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Query database for all usernames    │
│ SELECT username FROM users          │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Add each username to bloom filter   │
│ • alice → hash → set bits           │
│ • bob → hash → set bits             │
│ • charlie → hash → set bits         │
│ • ... (repeat for all users)        │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Calculate statistics                │
│ • Count set bits                    │
│ • Estimate false positive rate      │
│ • Log initialization complete       │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Server ready to handle requests     │
│ ✓ Bloom filter initialized          │
└─────────────────────────────────────┘
```

## Performance Comparison

```
WITHOUT Bloom Filter:
┌──────────┐    ┌──────────┐    ┌──────────┐
│ User     │───→│ Backend  │───→│ Database │
│ types    │    │ API      │    │ Query    │
│ "john"   │    │          │    │ 10-50ms  │
└──────────┘    └──────────┘    └──────────┘
Total: ~50ms per check
Database load: 100%

WITH Bloom Filter:
┌──────────┐    ┌──────────┐    ┌──────────┐
│ User     │───→│ Backend  │───→│ Bloom    │
│ types    │    │ API      │    │ Filter   │
│ "john"   │    │          │    │ <0.001ms │
└──────────┘    └──────────┘    └──────────┘
                                      ↓
                              ┌───────┴────────┐
                              ↓                ↓
                        ┌──────────┐    ┌──────────┐
                        │ Not in   │    │ Maybe in │
                        │ filter   │    │ (verify) │
                        │ DONE     │    │ DB query │
                        └──────────┘    └──────────┘
                        99% of cases    1% of cases

Total: ~0.001ms (99% of checks)
Database load: ~1%
```

## Visual Feedback States

```
State 1: Empty / Too Short
┌─────────────────────────────┐
│ Username                    │
│ [jo_____________]           │
│ ⓘ Min 3 characters          │
└─────────────────────────────┘

State 2: Checking
┌─────────────────────────────┐
│ Username                    │
│ [john___________] 🔄        │
│ ⏳ Checking availability... │
└─────────────────────────────┘

State 3: Available
┌─────────────────────────────┐
│ Username                    │
│ [john___________] ✓         │
│ ✓ Username is available     │
└─────────────────────────────┘
   (Green border)

State 4: Taken
┌─────────────────────────────┐
│ Username                    │
│ [alice__________] ✗         │
│ ✗ Username is already taken │
└─────────────────────────────┘
   (Red border)
```

## Memory Layout

```
Bloom Filter Memory Structure:

┌─────────────────────────────────────────┐
│ Uint8Array (6,250 bytes)                │
├─────────────────────────────────────────┤
│                                          │
│  Byte 0:  [0,1,0,0,1,0,1,0]  8 bits    │
│  Byte 1:  [1,0,0,0,0,1,0,1]  8 bits    │
│  Byte 2:  [0,0,1,1,0,0,0,1]  8 bits    │
│  ...                                     │
│  Byte 6249: [1,0,1,0,0,0,1,0]  8 bits  │
│                                          │
│  Total: 6,250 bytes × 8 = 50,000 bits  │
│                                          │
└─────────────────────────────────────────┘

Serialized (Base64):
"AQIDBAUG..." (~8.3 KB)
```

This visual guide shows exactly how the bloom filter works from user input to final result!
