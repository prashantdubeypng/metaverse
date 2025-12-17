# BUG-016: WebSocket Message Queue Overflow

## Bug Information

**Bug ID**: BUG-016  
**Title**: Messages Lost When Reconnecting Due to Queue Overflow  
**Severity**: Major  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When a WebSocket connection is briefly lost and reconnects, any messages that were queued during the disconnection period may be lost if the queue exceeds its capacity. Additionally, queued messages may be delivered out of order or all at once causing a flood.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| WebSocket Service | `frontend/src/services/websocket.ts` | Frontend |
| WebSocket Server | `metaverse/apps/ws/src/index.ts` | Backend |

---

## Reproduction Steps

1. Connect to the WebSocket server
2. Simulate network disruption (disconnect WiFi briefly)
3. While disconnected, have other users send multiple position updates
4. Reconnect to the network
5. Check if all position updates were received

**Expected Behavior**:  
All messages during disconnection should be delivered in order upon reconnection.

**Actual Behavior**:  
- Some messages may be lost if queue overflows
- Messages may arrive all at once causing performance issues
- Messages may arrive out of order

---

## Root Cause Analysis

### 1. Limited Queue Size

```typescript
// frontend/src/services/websocket.ts
class WebSocketService {
  private messageQueue: QueuedMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 100;  // Too small for busy rooms

  queueMessage(message: any): void {
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      // Messages silently dropped!
      console.warn('Message queue full, dropping message');
      this.messageQueue.shift(); // Drop oldest
    }
    this.messageQueue.push(message);
  }
}
```

### 2. No Message Prioritization

All messages are treated equally, so important join/leave events can be lost while less important position updates are preserved:

```typescript
// Current: All messages queued equally
queueMessage({ type: 'join', ... });     // Critical
queueMessage({ type: 'move', ... });     // Less critical
queueMessage({ type: 'move', ... });     // Less critical
// Queue fills with moves, join may be dropped
```

### 3. Burst Processing on Reconnect

When reconnecting, all queued messages are sent at once:

```typescript
// On reconnect
flushQueue(): void {
  while (this.messageQueue.length > 0) {
    this.send(this.messageQueue.shift()!);
  }
  // Flood of messages all at once!
}
```

---

## Solution

### 1. Implement Priority Queue

```typescript
// frontend/src/services/websocket.ts

interface QueuedMessage {
  message: any;
  priority: 'critical' | 'high' | 'normal' | 'low';
  timestamp: number;
  retries: number;
}

class MessageQueue {
  private critical: QueuedMessage[] = [];
  private high: QueuedMessage[] = [];
  private normal: QueuedMessage[] = [];
  private low: QueuedMessage[] = [];
  
  private readonly MAX_CRITICAL = 50;
  private readonly MAX_HIGH = 100;
  private readonly MAX_NORMAL = 200;
  private readonly MAX_LOW = 100;

  enqueue(message: any, priority: string = 'normal'): void {
    const queued: QueuedMessage = {
      message,
      priority,
      timestamp: Date.now(),
      retries: 0
    };

    switch (priority) {
      case 'critical':
        this.addToQueue(this.critical, queued, this.MAX_CRITICAL);
        break;
      case 'high':
        this.addToQueue(this.high, queued, this.MAX_HIGH);
        break;
      case 'low':
        this.addToQueue(this.low, queued, this.MAX_LOW);
        break;
      default:
        this.addToQueue(this.normal, queued, this.MAX_NORMAL);
    }
  }

  private addToQueue(queue: QueuedMessage[], msg: QueuedMessage, max: number): void {
    if (queue.length >= max) {
      // Drop oldest low-priority message instead
      this.dropLowestPriority();
    }
    queue.push(msg);
  }

  private dropLowestPriority(): void {
    if (this.low.length > 0) {
      this.low.shift();
    } else if (this.normal.length > 0) {
      this.normal.shift();
    }
    // Never drop critical/high unless absolutely necessary
  }

  dequeue(): QueuedMessage | null {
    return this.critical.shift() || 
           this.high.shift() || 
           this.normal.shift() || 
           this.low.shift() || 
           null;
  }

  get size(): number {
    return this.critical.length + this.high.length + 
           this.normal.length + this.low.length;
  }
}
```

### 2. Categorize Messages by Priority

```typescript
// frontend/src/services/websocket.ts

const MESSAGE_PRIORITIES: Record<string, 'critical' | 'high' | 'normal' | 'low'> = {
  // Critical - must not be lost
  'join': 'critical',
  'leave': 'critical',
  'auth': 'critical',
  'error': 'critical',
  
  // High - important for state
  'user-joined': 'high',
  'user-left': 'high',
  'call-start': 'high',
  'call-end': 'high',
  
  // Normal - regular updates
  'move': 'normal',
  'chat': 'normal',
  'ice-candidate': 'normal',
  
  // Low - can be lossy
  'position-update': 'low',
  'typing-indicator': 'low',
  'ping': 'low'
};

send(message: any): void {
  if (this.isConnected()) {
    this.ws.send(JSON.stringify(message));
  } else {
    const priority = MESSAGE_PRIORITIES[message.type] || 'normal';
    this.queue.enqueue(message, priority);
  }
}
```

### 3. Implement Throttled Queue Flush

```typescript
// frontend/src/services/websocket.ts

class WebSocketService {
  private isFlushingQueue = false;
  private readonly FLUSH_INTERVAL = 50; // ms between messages
  private readonly FLUSH_BATCH_SIZE = 10;

  async flushQueue(): Promise<void> {
    if (this.isFlushingQueue) return;
    this.isFlushingQueue = true;

    console.log(`📤 Flushing ${this.queue.size} queued messages`);

    while (this.queue.size > 0 && this.isConnected()) {
      const batch: QueuedMessage[] = [];
      
      // Get batch of messages
      for (let i = 0; i < this.FLUSH_BATCH_SIZE && this.queue.size > 0; i++) {
        const msg = this.queue.dequeue();
        if (msg) batch.push(msg);
      }
      
      // Send batch
      for (const { message } of batch) {
        try {
          this.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Failed to send queued message:', error);
          // Re-queue failed messages
          this.queue.enqueue(message, 'high');
        }
      }
      
      // Wait before next batch
      if (this.queue.size > 0) {
        await this.sleep(this.FLUSH_INTERVAL);
      }
    }

    this.isFlushingQueue = false;
    console.log('📤 Queue flush complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4. Implement Message Deduplication

```typescript
// Deduplicate position updates - only keep latest
class MessageQueue {
  private positionUpdates: Map<string, QueuedMessage> = new Map();

  enqueue(message: any, priority: string): void {
    // For position updates, only keep the latest per user
    if (message.type === 'move' || message.type === 'position-update') {
      const key = message.payload?.userId || 'local';
      this.positionUpdates.set(key, { message, priority, timestamp: Date.now() });
      return;
    }
    
    // Other messages go to priority queues
    // ... existing logic
  }

  // Include latest positions when dequeuing
  dequeueAll(): QueuedMessage[] {
    const messages: QueuedMessage[] = [];
    
    // Add latest position updates
    for (const msg of this.positionUpdates.values()) {
      messages.push(msg);
    }
    this.positionUpdates.clear();
    
    // Add other queued messages in priority order
    while (this.size > 0) {
      messages.push(this.dequeue()!);
    }
    
    return messages;
  }
}
```

### 5. Add Queue Persistence for Critical Messages

```typescript
// For critical messages, persist to localStorage as backup

class PersistentMessageQueue {
  private readonly STORAGE_KEY = 'ws_message_queue';

  persistCritical(message: QueuedMessage): void {
    if (message.priority === 'critical') {
      const stored = this.getStoredMessages();
      stored.push(message);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
    }
  }

  getStoredMessages(): QueuedMessage[] {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  clearPersisted(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // On reconnect, restore persisted messages
  restorePersistedMessages(): void {
    const stored = this.getStoredMessages();
    for (const msg of stored) {
      this.enqueue(msg.message, 'critical');
    }
    this.clearPersisted();
  }
}
```

---

## Testing

### Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Queue 50 critical + 50 normal messages | All critical delivered first |
| Disconnect with 200 pending moves | Only latest position per user kept |
| Reconnect with full queue | Messages delivered in batches |
| Critical message during disconnect | Message persisted and restored |

### Load Test

```typescript
describe('Message Queue Overflow', () => {
  it('should prioritize critical messages', async () => {
    const queue = new MessageQueue();
    
    // Fill with low priority
    for (let i = 0; i < 500; i++) {
      queue.enqueue({ type: 'move', i }, 'low');
    }
    
    // Add critical message
    queue.enqueue({ type: 'join' }, 'critical');
    
    // Critical should be first out
    const first = queue.dequeue();
    expect(first.message.type).toBe('join');
  });
});
```

---

## Prevention

1. **Always use priority queues** for message handling
2. **Deduplicate** frequently-updating messages
3. **Persist critical messages** to survive page reloads
4. **Rate limit** queue flushing to prevent floods
5. **Monitor queue size** and alert on overflow

---

## Related Issues

- **Related Bugs**: BUG-015 (disconnection loop), BUG-019 (state loss)
- **Performance**: Large queues can cause memory issues
- **UX**: Show reconnection status and queue depth

---

## Notes

- Consider using IndexedDB for larger persistence needs
- Service Workers could handle offline message queuing
- WebSocket servers should also implement message queuing
