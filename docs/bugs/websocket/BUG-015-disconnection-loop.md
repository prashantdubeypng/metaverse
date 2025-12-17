# BUG-015: WebSocket Disconnection Reconnection Loop

## Bug Information

**Bug ID**: BUG-015  
**Title**: WebSocket Repeatedly Disconnects and Reconnects in Infinite Loop  
**Severity**: Critical  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

Under certain network conditions, the WebSocket connection enters a loop where it connects, authenticates, then immediately disconnects, then reconnects again. This cycle repeats indefinitely, causing high CPU usage, rapid console logging, and preventing users from actually using the application.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| WebSocket Service | `frontend/src/services/websocket.ts` | Frontend |
| WebSocket Server | `metaverse/apps/ws/src/index.ts` | Backend |
| User Handler | `metaverse/apps/ws/src/User.ts` | Backend |

---

## Reproduction Steps

1. Open the application in a browser
2. Join a space
3. Throttle network to "Slow 3G" in DevTools
4. Observe WebSocket repeatedly connecting/disconnecting
5. Console shows rapid connect/disconnect cycle

**Expected Behavior**:  
WebSocket should connect once and maintain stable connection, with automatic reconnection only when truly needed.

**Actual Behavior**:  
WebSocket connects, then disconnects within 1-2 seconds, then reconnects, in endless loop.

---

## Console Logs / Error Messages

```
🔗 WebSocket connected
✅ WebSocket authenticated
🎮 Successfully joined space
🔌 WebSocket disconnected 1006 
🔄 Scheduling WebSocket reconnect attempt 1/5 in 1000ms
🔗 WebSocket connected
✅ WebSocket authenticated
🎮 Successfully joined space
🔌 WebSocket disconnected 1006 
🔄 Scheduling WebSocket reconnect attempt 2/5 in 2000ms
// ... continues indefinitely
```

---

## Root Cause Analysis

### Potential Causes

1. **Authentication Race Condition**: Multiple auth attempts trigger disconnection
2. **Heartbeat Timeout**: Server heartbeat interval vs client timeout mismatch
3. **Message Processing Error**: Uncaught exception in message handler closes connection
4. **Token Expiry**: JWT token expires but client keeps reconnecting with expired token
5. **Server-Side Timeout**: Server closes idle connections too aggressively

### Technical Details

**File**: `frontend/src/services/websocket.ts`

```typescript
// Current reconnection logic doesn't check WHY connection failed
private scheduleReconnect(): void {
  this.reconnectAttempts++;
  
  // Problem: Keeps reconnecting even if problem is not network-related
  this.reconnectTimeout = setTimeout(() => {
    if (!this.isManualDisconnect) {
      this.connect().catch(() => {
        this.reconnectInterval = Math.min(
          this.reconnectInterval * 2, 
          this.maxReconnectInterval
        );
      });
    }
  }, this.reconnectInterval);
}
```

**File**: `metaverse/apps/ws/src/User.ts`

```typescript
// Server might close connection for various reasons
private async handleJoin(payload: JoinPayload): Promise<void> {
  if (!token) {
    this.ws.close(1008, 'No token provided');  // Triggers client reconnect!
    return;
  }
  // ...
}
```

---

## Solution

### Approach

1. Add disconnect reason tracking to prevent reconnecting for auth failures
2. Implement connection state machine
3. Add jitter to reconnection timing
4. Implement proper backoff that eventually stops trying

### Code Changes

**File**: `frontend/src/services/websocket.ts`

```typescript
// BEFORE (reconnects infinitely)
ws.onclose = (event) => {
  console.log('🔌 WebSocket disconnected', event.code, event.reason);
  if (!this.isManualDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
    this.scheduleReconnect();
  }
};

// AFTER (smart reconnection)
private NON_RECOVERABLE_CODES = new Set([
  1008,  // Policy Violation (auth failure)
  4001,  // Custom: Invalid token
  4002,  // Custom: User banned
  4003,  // Custom: Space not found
]);

ws.onclose = (event) => {
  console.log('🔌 WebSocket disconnected', event.code, event.reason);
  
  this.stopHeartbeat();
  this.isAuthenticated = false;
  this.connectionPromise = null;

  // Check if this is a recoverable disconnect
  if (this.NON_RECOVERABLE_CODES.has(event.code)) {
    console.error('❌ Non-recoverable disconnect:', event.reason);
    this.emitInternal('fatal-error', { 
      code: event.code, 
      reason: event.reason 
    });
    // Do NOT reconnect - user needs to re-authenticate
    return;
  }

  // Only reconnect for network-related issues
  if (!this.isManualDisconnect && 
      this.reconnectAttempts < this.maxReconnectAttempts) {
    this.scheduleReconnect();
  } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.error('❌ Max reconnection attempts reached');
    this.emitInternal('connection-failed', { 
      attempts: this.reconnectAttempts 
    });
  }

  this.emitInternal('disconnect', { 
    code: event.code, 
    reason: event.reason 
  });
};
```

**Add jitter to prevent thundering herd**:

```typescript
private scheduleReconnect(): void {
  this.reconnectAttempts++;

  if (this.reconnectTimeout) {
    clearTimeout(this.reconnectTimeout);
  }

  // Add random jitter (±30%)
  const jitter = this.reconnectInterval * 0.3 * (Math.random() * 2 - 1);
  const delay = Math.round(this.reconnectInterval + jitter);

  console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

  this.reconnectTimeout = setTimeout(async () => {
    if (this.isManualDisconnect) return;

    try {
      await this.connect();
      // Reset on successful connect
      this.reconnectAttempts = 0;
      this.reconnectInterval = 1000;
    } catch (error) {
      // Exponential backoff with max
      this.reconnectInterval = Math.min(
        this.reconnectInterval * 2,
        this.maxReconnectInterval
      );
    }
  }, delay);
}
```

**Add connection state machine**:

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

class WebSocketService {
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  async connect(): Promise<void> {
    if (this.state === ConnectionState.CONNECTING) {
      console.log('⏳ Already connecting...');
      return this.connectionPromise!;
    }

    if (this.state === ConnectionState.CONNECTED || 
        this.state === ConnectionState.AUTHENTICATED) {
      console.log('✅ Already connected');
      return Promise.resolve();
    }

    if (this.state === ConnectionState.FAILED) {
      console.log('❌ Connection failed, not retrying');
      return Promise.reject(new Error('Connection failed permanently'));
    }

    this.state = ConnectionState.CONNECTING;
    // ... rest of connect logic
  }
}
```

---

## Server-Side Fixes

**File**: `metaverse/apps/ws/src/User.ts`

Use custom close codes to indicate non-recoverable errors:

```typescript
// Custom close codes (4000-4999 range)
const CLOSE_CODES = {
  NO_TOKEN: 4001,
  INVALID_TOKEN: 4002,
  TOKEN_EXPIRED: 4003,
  SPACE_NOT_FOUND: 4004,
  USER_BANNED: 4005,
  RATE_LIMITED: 4006,
};

private async handleJoin(payload: JoinPayload): Promise<void> {
  if (!token) {
    this.ws.close(CLOSE_CODES.NO_TOKEN, 'No token provided');
    return;
  }

  try {
    jwt.verify(token, jwt_password);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      this.ws.close(CLOSE_CODES.TOKEN_EXPIRED, 'Token expired');
    } else {
      this.ws.close(CLOSE_CODES.INVALID_TOKEN, 'Invalid token');
    }
    return;
  }

  // ...
}
```

---

## Testing

### Manual Testing

1. Connect to space successfully
2. Expire the JWT token manually (edit localStorage)
3. Cause a reconnection (disconnect network briefly)
4. Verify client does NOT infinitely reconnect
5. Verify user sees "Please log in again" error

### Debugging

```javascript
// Add to websocket.ts for debugging
this.ws.onclose = (event) => {
  console.table({
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
    reconnectAttempts: this.reconnectAttempts,
    isManualDisconnect: this.isManualDisconnect,
    state: this.state
  });
};
```

---

## Related Issues

- **Related Bugs**: BUG-017 (auth race condition), BUG-018 (heartbeat timeout)
- **User Experience**: Should show clear error message when connection fails permanently
- **Token Refresh**: Consider implementing token refresh before expiry

---

## Notes

- WebSocket close codes 4000-4999 are available for application use
- Consider implementing ping/pong at application level for more control
- Monitor reconnection frequency in production for early warning of issues
