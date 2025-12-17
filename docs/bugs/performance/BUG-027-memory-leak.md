# BUG-027: Memory Leak on Long Sessions

## Bug Information

**Bug ID**: BUG-027  
**Title**: Memory Usage Grows Continuously During Long Sessions  
**Severity**: Critical  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When a user keeps the application open for extended periods (1+ hours), browser memory usage grows continuously from ~150MB to 500MB+ eventually causing the tab to become unresponsive or crash. This affects user experience and makes the application unusable for all-day use in a virtual office setting.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Call Manager | `frontend/src/services/proximityVideoCall.ts` | Frontend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |
| WebSocket Service | `frontend/src/services/websocket.ts` | Frontend |
| Office Space Viewer | `frontend/src/components/OfficeSpaceViewer.tsx` | Frontend |

---

## Reproduction Steps

1. Open Chrome with DevTools → Performance Monitor
2. Note initial memory usage (~150MB)
3. Join a space with 5+ other users
4. Leave the application running for 1 hour
5. Occasionally move around to trigger video calls
6. Observe memory growing over time
7. After 2+ hours, tab becomes sluggish

**Expected Behavior**:  
Memory should stabilize around initial usage with minor fluctuations.

**Actual Behavior**:  
Memory grows continuously, eventually causing crashes.

---

## Memory Profile Analysis

```
Time        | Heap Size | Nodes   | Listeners | Issue
------------|-----------|---------|-----------|---------------------------
0 min       | 150 MB    | 50,000  | 100       | Baseline
30 min      | 220 MB    | 85,000  | 450       | Growing
60 min      | 310 MB    | 140,000 | 1,200     | Event listeners accumulating
90 min      | 420 MB    | 210,000 | 2,500     | DOM nodes not cleaned
120 min     | 550 MB    | 300,000 | 4,000     | Critical - tab sluggish
```

---

## Root Cause Analysis

### Multiple Memory Leak Sources

#### 1. Event Listener Accumulation
The WebSocket service and proximity manager add event listeners but don't always remove them:

```typescript
// frontend/src/services/websocket.ts
on<T = unknown>(event: string, listener: EventListener<T>): void {
  if (!this.eventListeners.has(event)) {
    this.eventListeners.set(event, []);
  }
  this.eventListeners.get(event)!.push(listener as EventListener);
  // Listeners accumulate - same listener may be added multiple times!
}
```

#### 2. RTCPeerConnection Leak (See BUG-004)
Video calls create peer connections that aren't fully cleaned up.

#### 3. Console Logging
Extensive debug logging holds references to large objects:

```typescript
console.log('🎥 [DEBUG] Proximity detection:', {
  localPosition: this.state.localPosition,
  nearbyUsers: nearbyUsers,  // Large array
  // Chrome DevTools holds references to logged objects!
});
```

#### 4. React Component State Growth
Chat messages and user lists grow without bounds:

```typescript
// frontend/src/app/space/[id]/page.tsx
const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage[]>>(new Map());
// Messages accumulate forever - no cleanup for old messages
```

#### 5. Phaser Game Objects
If using Phaser for rendering, game objects may not be properly destroyed.

---

## Solution

### 1. Fix Event Listener Management

```typescript
// frontend/src/services/websocket.ts

// Track listener references for cleanup
private listenerRefs: WeakMap<Function, Set<string>> = new WeakMap();

on<T = unknown>(event: string, listener: EventListener<T>): void {
  // Prevent duplicate listeners
  const listeners = this.eventListeners.get(event) || [];
  if (listeners.includes(listener as EventListener)) {
    console.warn(`⚠️ Duplicate listener for ${event}`);
    return;
  }
  
  if (!this.eventListeners.has(event)) {
    this.eventListeners.set(event, []);
  }
  this.eventListeners.get(event)!.push(listener as EventListener);
  
  // Track for debugging
  const refs = this.listenerRefs.get(listener) || new Set();
  refs.add(event);
  this.listenerRefs.set(listener, refs);
}

// Add method to check for leaks
getListenerStats(): { event: string; count: number }[] {
  return Array.from(this.eventListeners.entries())
    .map(([event, listeners]) => ({ event, count: listeners.length }))
    .filter(stat => stat.count > 0);
}
```

### 2. Implement Message Cleanup

```typescript
// frontend/src/app/space/[id]/page.tsx

const MAX_MESSAGES_PER_ROOM = 100;

const addMessage = (chatroomId: string, message: ChatMessage) => {
  setChatMessages(prev => {
    const newMap = new Map(prev);
    const existing = newMap.get(chatroomId) || [];
    
    // Keep only last N messages
    const updated = [...existing, message].slice(-MAX_MESSAGES_PER_ROOM);
    newMap.set(chatroomId, updated);
    
    return newMap;
  });
};

// Cleanup old chatrooms when leaving space
useEffect(() => {
  return () => {
    // Clear all chat messages on unmount
    setChatMessages(new Map());
  };
}, []);
```

### 3. Reduce Console Logging in Production

```typescript
// frontend/src/utils/logger.ts

const isDev = process.env.NODE_ENV === 'development';

export const debugLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

export const debugTable = (data: any) => {
  if (isDev) {
    console.table(data);
  }
};

// Usage
import { debugLog } from '@/utils/logger';

debugLog('🎥 [DEBUG] Proximity detection:', data);
// Won't log in production, won't hold references
```

### 4. Implement Cleanup on Component Unmount

```typescript
// frontend/src/app/space/[id]/page.tsx

useEffect(() => {
  // Setup
  const cleanup = () => {
    // Clear all state
    setUsers([]);
    setChatMessages(new Map());
    setActiveChatrooms(new Set());
    
    // Disconnect services
    websocketService.disconnect();
    proximityVideoCall.destroy();
    
    // Force garbage collection hint
    if (window.gc) window.gc();
  };
  
  // Handle page hide (tab switch, minimize)
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Reduce memory usage when tab is hidden
      // Pause non-essential updates
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    cleanup();
  };
}, []);
```

### 5. Implement Periodic Cleanup

```typescript
// frontend/src/services/memoryManager.ts

class MemoryManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  start(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  performCleanup(): void {
    console.log('🧹 Running periodic memory cleanup');
    
    // Report memory stats
    if (performance.memory) {
      console.log('Memory:', {
        usedHeap: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
        totalHeap: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
      });
    }

    // Clean up old data
    this.cleanupOldChatMessages();
    this.cleanupDetachedEventListeners();
    
    // Hint to browser GC
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
  }

  private cleanupOldChatMessages(): void {
    // Implementation depends on chat state management
  }

  private cleanupDetachedEventListeners(): void {
    // Check for orphaned listeners
    const stats = websocketService.getListenerStats();
    const suspicious = stats.filter(s => s.count > 10);
    if (suspicious.length > 0) {
      console.warn('⚠️ Possible listener leak:', suspicious);
    }
  }
}

export const memoryManager = new MemoryManager();
```

---

## Testing

### Manual Memory Testing

1. Open Chrome DevTools → Memory tab
2. Take heap snapshot before starting
3. Use application for 30 minutes
4. Take another heap snapshot
5. Compare snapshots for growing objects
6. Look for "Detached" DOM elements

### Automated Memory Monitoring

```javascript
// Add to application for monitoring
setInterval(() => {
  if (performance.memory) {
    const usage = performance.memory.usedJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;
    const percent = (usage / limit * 100).toFixed(1);
    
    console.log(`Memory: ${Math.round(usage/1024/1024)}MB (${percent}%)`);
    
    if (usage / limit > 0.8) {
      console.warn('⚠️ High memory usage!');
    }
  }
}, 30000); // Every 30 seconds
```

---

## Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Heap Size Growth/Hour | < 10 MB | > 50 MB |
| Event Listeners Count | < 200 | > 500 |
| DOM Nodes Count | < 100,000 | > 200,000 |
| Detached DOM Elements | 0 | > 100 |

---

## Related Issues

- **Related Bugs**: BUG-004 (peer connection leak), BUG-030 (event listener accumulation)
- **Performance**: Also causes CPU spikes during garbage collection
- **User Experience**: Should warn user when memory is high

---

## Notes

- Chrome's `--enable-precise-memory-info` flag gives more accurate memory readings
- Firefox has better memory profiling tools in some cases
- Consider using a WeakMap/WeakSet for caching where appropriate
- Production builds have less logging overhead but may still leak
