# Bug Fix Priority Guide

## Overview

This document provides a prioritized list of bugs to fix for the Metaverse application to ensure a stable user experience for 2,000 concurrent users.

---

## Phase 1: Critical Foundation (Week 1-2)

These bugs must be fixed first as they block core functionality.

### 1. Coordinate System Issues
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-011: Coordinate System Mismatch | P0 | Medium | Fixes avatar teleporting |
| BUG-009: Avatar Teleporting | P0 | Medium | Core movement works |

**Why First**: Without proper coordinate handling, nothing else works correctly.

**Fix Order**:
1. Standardize on grid coordinates across all code
2. Fix `proximity-position-update` to send grid coordinates
3. Add validation on backend for coordinate ranges
4. Add unit tests for coordinate conversion

### 2. WebSocket Stability
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-015: Disconnection Loop | P0 | High | Stable connections |
| BUG-031: Room State Not Synced | P0 | High | Scalability enabled |

**Why Second**: Stable connections are required for all real-time features.

**Fix Order**:
1. Implement proper reconnection with exponential backoff
2. Add heartbeat/ping-pong mechanism
3. Implement Redis pub/sub for cross-server communication
4. Add connection state management

### 3. User Presence
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-020: Users Not Visible | P0 | Medium | Users can see each other |
| BUG-021: Ghost Users | P1 | Medium | Clean user list |

**Why Third**: Users need to see each other before video calls can work.

---

## Phase 2: Video Calling (Week 2-3)

With stable infrastructure, fix video calling.

### 1. Call Initiation
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-001: Proximity Call Not Triggering | P0 | High | Calls start properly |
| BUG-006: Call Not Ending | P1 | Medium | Calls end properly |

### 2. Connection Quality
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-003: ICE Connection Failure | P0 | High | Video connects |
| BUG-002: Black Screen | P1 | Medium | Video displays |
| BUG-005: Audio/Video Sync | P2 | Medium | Quality improvement |

### 3. Resource Management
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-004: Peer Connection Leak | P0 | Medium | Memory stable |
| BUG-028: Audio Echo | P1 | High | Audio quality |

---

## Phase 3: Polish & Performance (Week 3-4)

Improve user experience and performance.

### 1. Movement Experience
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-030: Keyboard Controls Stop | P1 | Low | Smooth movement |
| BUG-012: Avatar Stuck at Boundaries | P2 | Low | Edge cases |

### 2. Chat System
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-024: Messages Not Delivered | P1 | Medium | Reliable chat |
| BUG-025: Chat History Not Loading | P2 | Medium | Message persistence |

### 3. Performance
| Bug | Priority | Effort | Impact |
|-----|----------|--------|--------|
| BUG-027: Memory Leak | P1 | High | Long session stability |
| BUG-029: Stale Position After Reconnect | P2 | Medium | Reconnection quality |

---

## Fix Dependencies

```
BUG-011 (Coordinates) ─────┐
                           ├──► BUG-001 (Proximity Call)
BUG-015 (WebSocket) ───────┤
                           ├──► BUG-003 (ICE Connection)
BUG-020 (User Visibility) ─┘

BUG-031 (Room State Sync) ──► Required for 2000 users

BUG-004 (Connection Leak) ──► BUG-027 (Memory Leak)

BUG-024 (Chat Delivery) ────► BUG-025 (Chat History)
```

---

## Estimated Timeline

```
Week 1: Foundation
├── Day 1-2: BUG-011 (Coordinates)
├── Day 2-3: BUG-009 (Teleporting)
├── Day 3-4: BUG-015 (WebSocket)
└── Day 4-5: BUG-020, BUG-021 (Presence)

Week 2: Video Calling
├── Day 1-2: BUG-001 (Proximity Trigger)
├── Day 2-3: BUG-003 (ICE)
├── Day 3-4: BUG-006 (Call Ending)
└── Day 4-5: BUG-004 (Connection Leak)

Week 3: Scalability + Chat
├── Day 1-3: BUG-031 (Room State Sync)
├── Day 3-4: BUG-024 (Chat)
└── Day 4-5: BUG-016 (Message Queue)

Week 4: Polish
├── Day 1-2: BUG-027 (Memory)
├── Day 2-3: BUG-028 (Audio Echo)
├── Day 3-4: BUG-030 (Keyboard)
└── Day 4-5: Testing & Refinement
```

---

## Testing Checkpoints

### After Phase 1 Completion
- [ ] User can move avatar with arrow keys
- [ ] User position persists correctly
- [ ] WebSocket maintains stable connection
- [ ] Users can see each other in space
- [ ] No ghost users remain after disconnect

### After Phase 2 Completion
- [ ] Video call starts within 2 tiles
- [ ] Video call ends when moving away
- [ ] Video stream displays correctly
- [ ] Audio has no echo
- [ ] Memory stable during video calls

### After Phase 3 Completion
- [ ] 2000 users can be in a space
- [ ] Chat messages deliver reliably
- [ ] No memory growth over 2+ hours
- [ ] Keyboard controls always responsive
- [ ] Clean reconnection experience

---

## Quick Reference

### Most Common Root Causes
1. **Coordinate mismatch**: Frontend uses pixels, backend uses grid
2. **Missing cleanup**: Event listeners, peer connections not cleaned
3. **Race conditions**: Async operations not properly sequenced
4. **State desync**: Frontend/backend state divergence

### Debugging Commands

```javascript
// Check WebSocket connection state
console.log(websocket.ws.readyState);

// Check active peer connections
console.log(proximityVideoCall.activeCalls.size);

// Check memory usage
console.log(performance.memory.usedJSHeapSize / 1024 / 1024 + ' MB');

// Check user positions
console.table(Array.from(users).map(u => ({ id: u.id, x: u.x, y: u.y })));
```

### Environment Setup for Testing

```bash
# Run with debug logging
DEBUG=* pnpm dev

# Run with memory profiling
node --expose-gc --trace-gc apps/ws/dist/index.js

# Load test with multiple users
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/test/spawn-user &
done
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Connection Stability | 99.9% uptime | Monitor disconnection rate |
| Video Call Success | 95% | Track call start/failure ratio |
| Message Delivery | 99.9% | Compare sent vs received |
| Memory Growth | < 10MB/hour | Monitor heap size |
| Latency | < 100ms | Track message round-trip |
| Ghost Users | 0 after 60s | Count stale users |

---

## Rollback Plan

If a fix causes regression:

1. **Immediate**: Revert PR and redeploy
2. **Short-term**: Feature flag to disable new code
3. **Long-term**: A/B test new features

```typescript
// Feature flags
const FEATURE_FLAGS = {
  NEW_PROXIMITY_DETECTION: false,
  REDIS_ROOM_STATE: false,
  IMPROVED_RECONNECTION: true,
};
```
