# BUG-024: Chat Messages Not Delivered

## Bug Information

**Bug ID**: BUG-024  
**Title**: Chat Messages Fail to Deliver to Recipients  
**Severity**: Major  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

Chat messages sent by users sometimes fail to reach their intended recipients. The sender sees the message as sent, but the recipient never receives it. This happens intermittently, making it difficult to reproduce consistently.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Chat Panel | `frontend/src/components/ChatPanel.tsx` | Frontend |
| WebSocket Server | `metaverse/apps/ws/src/index.ts` | Backend |
| Kafka Chat Service | `metaverse/apps/ws/src/KafkaChatService.ts` | Backend |
| Redis Pub/Sub | `metaverse/packages/redis-client/` | Backend |

---

## Reproduction Steps

1. Open application with 3 users (A, B, C) in same space
2. User A sends message to room chat: "Hello everyone"
3. User B receives the message
4. User C does not receive the message
5. Refresh page - User C now sees the message (from history)

**Expected Behavior**:  
All users in the chatroom should receive the message in real-time.

**Actual Behavior**:  
Some users don't receive real-time messages but see them after refresh.

---

## Root Cause Analysis

### 1. Redis Pub/Sub Subscription Race

Users may not be subscribed to the chatroom channel when the message is published:

```typescript
// User joins room
joinChatroom(chatroomId: string) {
  this.redis.subscribe(`chat:${chatroomId}`);
  // Message sent before subscription completes!
}
```

### 2. Kafka Consumer Lag

If using Kafka for chat persistence, consumer lag can delay message delivery:

```typescript
// Kafka consumer may be behind
kafkaConsumer.on('message', (message) => {
  // May receive messages seconds after they were sent
  broadcastToRoom(message);
});
```

### 3. WebSocket Connection State

Message may be sent while WebSocket is reconnecting:

```typescript
// WebSocket might be in CONNECTING state
send(message: any) {
  if (this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(message));
  }
  // Silently fails if not OPEN!
}
```

### 4. Frontend Not Listening

React component might not be subscribed to chat events:

```typescript
// Missing cleanup and resubscription on re-render
useEffect(() => {
  socket.on('chat-message', handleMessage);
  // Missing return cleanup!
}, []);
```

---

## Solution

### 1. Ensure Subscription Before Allowing Messages

```typescript
// metaverse/apps/ws/src/ChatService.ts

class ChatService {
  private subscriptions: Map<string, Set<string>> = new Map();

  async joinChatroom(userId: string, chatroomId: string): Promise<void> {
    // Subscribe and wait for confirmation
    await this.redis.subscribe(`chat:${chatroomId}`);
    
    // Track subscription
    if (!this.subscriptions.has(chatroomId)) {
      this.subscriptions.set(chatroomId, new Set());
    }
    this.subscriptions.get(chatroomId)!.add(userId);
    
    console.log(`✅ ${userId} subscribed to ${chatroomId}`);
    
    // Notify client they can now send/receive
    this.notifyUser(userId, {
      type: 'chatroom-joined',
      payload: { chatroomId, status: 'ready' }
    });
  }

  async sendMessage(userId: string, chatroomId: string, content: string): Promise<void> {
    // Verify sender is subscribed
    if (!this.isSubscribed(userId, chatroomId)) {
      throw new Error('Must join chatroom before sending messages');
    }
    
    const message = {
      id: uuid(),
      userId,
      chatroomId,
      content,
      timestamp: Date.now()
    };
    
    // Persist to Kafka
    await this.kafka.send('chat-messages', message);
    
    // Publish to Redis for real-time delivery
    await this.redis.publish(`chat:${chatroomId}`, JSON.stringify(message));
  }
}
```

### 2. Implement Message Acknowledgment

```typescript
// frontend/src/services/chat.ts

class ChatService {
  private pendingMessages: Map<string, { message: any; timeout: NodeJS.Timeout }> = new Map();
  private readonly ACK_TIMEOUT = 5000;

  async sendMessage(content: string, chatroomId: string): Promise<void> {
    const messageId = uuid();
    
    const message = {
      id: messageId,
      content,
      chatroomId,
      timestamp: Date.now()
    };
    
    // Send message
    this.websocket.send({
      type: 'chat-message',
      payload: message
    });
    
    // Wait for acknowledgment
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Message delivery timeout'));
      }, this.ACK_TIMEOUT);
      
      this.pendingMessages.set(messageId, { message, timeout });
    });
  }

  handleAck(messageId: string): void {
    const pending = this.pendingMessages.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(messageId);
    }
  }
}
```

### 3. Add Message Delivery Retry

```typescript
// frontend/src/components/ChatPanel.tsx

const ChatPanel = () => {
  const [failedMessages, setFailedMessages] = useState<Message[]>([]);

  const sendMessage = async (content: string) => {
    const tempId = uuid();
    
    // Add optimistically
    addMessage({ id: tempId, content, status: 'sending' });
    
    try {
      await chatService.sendMessage(content, chatroomId);
      updateMessageStatus(tempId, 'sent');
    } catch (error) {
      updateMessageStatus(tempId, 'failed');
      setFailedMessages(prev => [...prev, { id: tempId, content }]);
    }
  };

  const retryMessage = async (messageId: string) => {
    const failed = failedMessages.find(m => m.id === messageId);
    if (failed) {
      setFailedMessages(prev => prev.filter(m => m.id !== messageId));
      await sendMessage(failed.content);
    }
  };

  return (
    <div>
      {messages.map(msg => (
        <Message 
          key={msg.id} 
          {...msg}
          onRetry={msg.status === 'failed' ? () => retryMessage(msg.id) : undefined}
        />
      ))}
    </div>
  );
};
```

### 4. Ensure WebSocket is Ready

```typescript
// frontend/src/services/websocket.ts

class WebSocketService {
  async send(message: any): Promise<void> {
    // Wait for connection if not ready
    if (this.ws?.readyState !== WebSocket.OPEN) {
      await this.waitForConnection();
    }
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  private waitForConnection(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);
      
      this.once('connected', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
```

### 5. Sync Messages on Reconnect

```typescript
// frontend/src/hooks/useChatSync.ts

export function useChatSync(chatroomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    const syncMessages = async () => {
      // Fetch messages since last sync
      const newMessages = await fetchMessages(chatroomId, lastSyncRef.current);
      
      setMessages(prev => {
        // Merge new messages, avoiding duplicates
        const messageMap = new Map(prev.map(m => [m.id, m]));
        for (const msg of newMessages) {
          messageMap.set(msg.id, msg);
        }
        return Array.from(messageMap.values())
          .sort((a, b) => a.timestamp - b.timestamp);
      });
      
      if (newMessages.length > 0) {
        lastSyncRef.current = newMessages[newMessages.length - 1].timestamp;
      }
    };

    // Sync on mount
    syncMessages();
    
    // Sync on reconnect
    websocket.on('connected', syncMessages);
    
    // Sync periodically as backup
    const interval = setInterval(syncMessages, 30000);
    
    return () => {
      websocket.off('connected', syncMessages);
      clearInterval(interval);
    };
  }, [chatroomId]);

  return messages;
}
```

### 6. Show Message Delivery Status

```tsx
// frontend/src/components/Message.tsx

interface Props {
  message: Message;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  onRetry?: () => void;
}

const Message: React.FC<Props> = ({ message, status, onRetry }) => {
  return (
    <div className="message">
      <p>{message.content}</p>
      <div className="status">
        {status === 'sending' && <span>⏳ Sending...</span>}
        {status === 'sent' && <span>✓ Sent</span>}
        {status === 'delivered' && <span>✓✓ Delivered</span>}
        {status === 'failed' && (
          <button onClick={onRetry} className="text-red-500">
            ⚠️ Failed - Tap to retry
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## Testing

### Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Send message normally | All recipients receive instantly |
| Send during reconnection | Message queued and delivered after connect |
| Network failure mid-send | Retry button appears |
| Recipient joins after send | Message visible from history |

### Load Test

```typescript
describe('Chat Message Delivery', () => {
  it('should deliver message to all subscribers', async () => {
    const room = 'test-room';
    const users = [userA, userB, userC];
    
    // All users join room
    await Promise.all(users.map(u => u.joinChatroom(room)));
    
    // User A sends message
    await userA.sendMessage('Hello', room);
    
    // All users should receive
    await Promise.all(users.map(async u => {
      const messages = await u.getMessages(room);
      expect(messages).toContainEqual(expect.objectContaining({
        content: 'Hello'
      }));
    }));
  });
});
```

---

## Prevention

1. **Always confirm subscription** before allowing sends
2. **Implement acknowledgments** for message delivery
3. **Add retry mechanism** for failed messages
4. **Sync on reconnect** to catch missed messages
5. **Show delivery status** to users

---

## Related Issues

- **Related Bugs**: BUG-025 (chat history), BUG-026 (join race condition)
- **UX**: Users think messages are delivered when they're not
- **Reliability**: Consider adding message persistence queue

---

## Notes

- Kafka provides at-least-once delivery, but WebSocket is at-most-once
- Consider using message sequence numbers for ordering
- Read receipts could help users know if message was received
- DM vs room chat may have different reliability requirements
