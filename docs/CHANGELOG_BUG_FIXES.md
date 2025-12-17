# Bug Fixes Implementation Changelog

This document tracks all changes made during the bug-fixing implementation phase, including code modifications, new files created, and documentation added.

## Session Date: December 2, 2025

---

## Summary of Changes

### 🆕 New Files Created

#### 1. `packages/redis-client/src/ConnectionRegistry.ts`
**Purpose:** Redis-based connection tracking for multi-server WebSocket deployments

**Features:**
- Tracks user connections across multiple WebSocket servers
- Enables page refresh recovery (BUG-032 fix)
- Provides reconnection token management
- Supports user position tracking
- Implements heartbeat mechanism for connection health

**Key Classes/Functions:**
- `ConnectionRegistry` class - Main registry for connection management
- `registerConnection()` - Register a new user connection
- `getConnection()` - Retrieve connection info for a user
- `removeConnection()` - Clean up disconnected user
- `createReconnectionToken()` - Generate token for page refresh recovery
- `validateReconnectionToken()` - Validate and consume reconnection token
- `heartbeat()` - Update connection heartbeat timestamp
- `getSpaceUsers()` - Get all users in a space
- `cleanupStaleConnections()` - Remove expired connections

**Data Structures in Redis:**
```
conn:{userId}                    -> Hash: connection info
server:{serverId}:connections    -> Set: user IDs on this server
space:{spaceId}:users           -> Set: user IDs in this space
conn:pending:{userId}           -> Hash: reconnection token data (TTL: 30s)
```

---

#### 2. `packages/redis-client/src/BloomFilter.ts`
**Purpose:** Space-efficient probabilistic data structure for username uniqueness checking

**Features:**
- O(1) lookup time for membership testing
- Memory efficient: ~1.2MB for 10 million items at 1% false positive rate
- Redis-based for distributed use across servers
- Batch operations for efficient bulk adds/checks

**Key Methods:**
- `add()` - Add an item to the filter
- `addBatch()` - Add multiple items efficiently
- `mightContain()` - Check if item might be in set
- `mightContainBatch()` - Check multiple items
- `getStats()` - Get filter statistics

---

#### 3. `frontend/src/utils/coordinates.ts`
**Purpose:** Centralized coordinate conversion utility (BUG-011 fix)

**Features:**
- Single source of truth for grid/pixel conversion
- Constants: GRID_SIZE (20px), MAX_GRID_X, MAX_GRID_Y
- Type-safe coordinate conversion functions

**Key Functions:**
- `toGrid(pixelX, pixelY)` - Convert pixel coordinates to grid
- `toPixel(gridX, gridY)` - Convert grid coordinates to pixels
- `clampToGrid(x, y)` - Clamp coordinates within valid grid bounds
- `gridDistance(x1, y1, x2, y2)` - Calculate Manhattan distance
- `isWithinProximity(x1, y1, x2, y2, range)` - Check if within range
- `gridToPixelBounds(gridX, gridY)` - Get pixel bounding box

---

#### 4. `packages/redis-client/package.json`
**Purpose:** Package configuration for the redis-client module

---

#### 5. `packages/redis-client/tsconfig.json`
**Purpose:** TypeScript configuration for the redis-client module

---

#### 6. `packages/redis-client/src/index.ts`
**Purpose:** Module entry point exporting ConnectionRegistry and BloomFilter

---

### 📝 Modified Files

#### 1. `frontend/src/services/websocket.ts`

**Bugs Fixed:** 
- BUG-032 - Page refresh connection loss
- BUG-015 - WebSocket disconnection loop

**Changes Made:**

1. **Added Connection State Machine (BUG-015)**
   - New `ConnectionState` enum with states: DISCONNECTED, CONNECTING, CONNECTED, AUTHENTICATING, AUTHENTICATED, RECONNECTING, FAILED
   - Prevents invalid state transitions
   - Properly tracks connection lifecycle

2. **Added Non-Recoverable Error Handling (BUG-015)**
   - `CLOSE_CODES` constants for custom WebSocket close codes (4001-4007)
   - `NON_RECOVERABLE_CODES` set to identify permanent failures
   - Prevents infinite reconnection loops on auth failures
   - Emits `fatal-error` event for UI to handle

3. **Added Session State Management (BUG-032)**
   - New interface `SessionState` for storing connection state
   - `saveSessionState()` - Saves current space/position to localStorage
   - `loadSessionState()` - Loads state on initialization
   - `clearSessionState()` - Clears stored state

4. **Added Page Refresh Recovery (BUG-032)**
   - `setupBeforeUnloadHandler()` - Saves state before page unload
   - `setupVisibilityHandler()` - Recovers on tab visibility change
   - `attemptRecovery()` - Reconnects and rejoins previous space

5. **Added New Properties**
   - `connectionState` - Current state machine state
   - `lastDisconnectCode` - Last close code for debugging
   - `lastDisconnectReason` - Last close reason

6. **New Public Methods**
   - `getConnectionState()` - Get current state
   - `hasFailedPermanently()` - Check if connection failed
   - `resetConnectionState()` - Reset after re-auth
   - `getLastDisconnectInfo()` - Debug info
   - `getErrorMessageForCode()` - User-friendly error messages

---

#### 2. `apps/ws/src/RedisService.ts`

**Bug Fixed:** BUG-031 - Room state not synchronized across servers

**Changes Made:**

1. **Added Room/Space State Management**
   - `addUserToSpace()` - Track user in space with position
   - `updateUserPosition()` - Update position in Redis
   - `removeUserFromSpace()` - Clean up when user leaves
   - `getSpaceUsers()` - Get all users in a space
   - `getSpaceUserCount()` - Get user count

2. **Added Cross-Server Event Sync**
   - `publishSpaceEvent()` - Publish events to Redis pub/sub
   - `subscribeToSpaceEvents()` - Listen for events from other servers
   - Events: user-joined, user-moved, user-left

3. **Added Server Identification**
   - `serverId` - Unique ID per server instance
   - `getServerId()` - Public accessor

4. **Added Cleanup Methods**
   - `cleanupServerData()` - Called on shutdown
   - `cleanupStaleUsers()` - Remove inactive users
   - TTL on user data (5 minutes)

5. **Enhanced Documentation**
   - Comprehensive header comments
   - Section separators
   - Data structure documentation

---

#### 3. `apps/ws/src/Roommanager.ts`

**Bug Fixed:** BUG-031 - Room state not synchronized across servers

**Changes Made:**

1. **Added Redis Integration**
   - Optional Redis service integration
   - Dual storage: local Map + Redis for sync
   - Graceful degradation if Redis unavailable

2. **Added Position Tracking**
   - `updateUserPosition()` - Sync position to Redis
   - `getSpaceUsersWithPositions()` - Get users with coordinates
   - `getSpaceUsersFromRedis()` - Cross-server user list

3. **Added Cross-Server Event Handling**
   - `subscribeToSpaceEvents()` - Listen for Redis events
   - `handleRedisSpaceEvent()` - Process events from other servers
   - Broadcasts updates to local users

4. **Added Periodic Cleanup**
   - 30-second cleanup interval
   - Removes disconnected users
   - Cleans Redis stale data

5. **Added Graceful Shutdown**
   - `shutdown()` - Clean up resources
   - Unsubscribes from all Redis channels

---

#### 4. `frontend/src/services/proximityVideoCall.ts`

**Bugs Fixed:**
- BUG-001 - Proximity video call not triggering (coordinate fix)
- BUG-003 - ICE connection failure

**Changes Made:**

1. **Added Centralized Coordinate Conversion (BUG-001)**
   - Now imports `toGrid`, `gridDistance` from coordinates.ts
   - Uses `PROXIMITY_DISTANCE_TILES` constant
   - Consistent grid-based distance calculations

2. **Enhanced RTC Configuration (BUG-003)**
   - Added additional STUN servers
   - Added TURN server support (via environment variables)
   - `iceTransportPolicy: 'all'` configuration

3. **Added ICE Restart Logic (BUG-003)**
   - `iceRestartAttempts` Map to track attempts per user
   - `MAX_ICE_RESTART_ATTEMPTS` constant (3 attempts)
   - `sendICERestartOffer()` - Creates offer with iceRestart flag

4. **Enhanced ICE State Handling**
   - Handles 'failed' state with restart
   - Handles 'disconnected' with 5s delay before restart
   - Resets restart counter on successful connection

---

#### 5. `frontend/src/components/ProximityManager.tsx`

**Bug Fixed:** BUG-001, BUG-011 - Coordinate system consistency

**Changes Made:**

1. **Added Centralized Coordinate Import**
   - Imports `GRID_SIZE`, `toPixel`, `gridDistance`, `isWithinProximity`
   - Moved constants to module level with documentation

2. **Added Comprehensive Header Comments**
   - Purpose documentation
   - Coordinate system explanation
   - Bug fix references

---

#### 6. `apps/ws/src/User.ts`

**Bug Fixed:** Duplicate switch cases causing potential double-handling of messages

**Changes Made:**

1. **Removed Duplicate Cases**
   - Removed 7 duplicate case handlers
   - Added section headers
   - Comprehensive documentation

---

## Testing Recommendations

### BUG-015 Testing (Disconnection Loop)

1. **Auth Failure Test:**
   ```
   1. Connect to a space
   2. Invalidate the token (modify localStorage)
   3. Force a disconnect
   4. Expected: Should NOT infinitely reconnect, should show error
   ```

2. **Max Attempts Test:**
   ```
   1. Block WebSocket server
   2. Observe reconnection attempts
   3. Expected: Should stop after 5 attempts
   ```

### BUG-003 Testing (ICE Connection)

1. **ICE Restart Test:**
   ```
   1. Start video call
   2. Disconnect network briefly
   3. Reconnect network
   4. Expected: ICE should restart and recover
   ```

2. **TURN Server Test:**
   ```
   1. Set NEXT_PUBLIC_TURN_SERVER_URL env var
   2. Force relay-only mode in config
   3. Start video call
   4. Expected: Should connect via TURN
   ```

### BUG-031 Testing (Room State Sync)

1. **Multi-Server Test:**
   ```
   1. Start two WebSocket servers
   2. Connect User A to Server 1
   3. Connect User B to Server 2
   4. Both join same space
   5. Expected: Both should see each other
   ```

---

## Environment Variables Added

```bash
# For TURN server support (BUG-003)
NEXT_PUBLIC_TURN_SERVER_URL=turn:your-turn-server.com:3478
NEXT_PUBLIC_TURN_USERNAME=username
NEXT_PUBLIC_TURN_CREDENTIAL=password
```

---

## Files Changed Summary

| File | Type | Primary Change |
|------|------|----------------|
| `packages/redis-client/src/ConnectionRegistry.ts` | New | Connection tracking |
| `packages/redis-client/src/BloomFilter.ts` | New | Username validation |
| `frontend/src/utils/coordinates.ts` | New | Coordinate conversion |
| `frontend/src/services/websocket.ts` | Modified | BUG-015, BUG-032 |
| `apps/ws/src/RedisService.ts` | Modified | BUG-031 room state |
| `apps/ws/src/Roommanager.ts` | Modified | BUG-031 Redis sync |
| `frontend/src/services/proximityVideoCall.ts` | Modified | BUG-001, BUG-003, BUG-006 |
| `frontend/src/components/ProximityManager.tsx` | Modified | BUG-001, BUG-011 |
| `apps/ws/src/User.ts` | Modified | Duplicate handlers |

---

## Bugs Status Summary

| Bug ID | Title | Status |
|--------|-------|--------|
| BUG-001 | Proximity Video Call Not Triggering | ✅ Fixed |
| BUG-002 | Video Stream Black Screen | ✅ Fixed |
| BUG-003 | ICE Connection Failure | ✅ Fixed |
| BUG-004 | Peer Connection Memory Leak | ✅ Fixed |
| BUG-005 | Audio/Video Sync Issues | ✅ Fixed |
| BUG-006 | Video Call Not Ending Properly | ✅ Fixed |
| BUG-009 | Avatar Teleporting | ✅ Fixed |
| BUG-011 | Coordinate System Mismatch | ✅ Fixed |
| BUG-015 | WebSocket Disconnection Loop | ✅ Fixed |
| BUG-016 | Message Queue Overflow | ✅ Fixed |
| BUG-020 | Users Not Visible After Reconnect | ✅ Fixed |
| BUG-021 | Ghost Users in Space | ✅ Fixed |
| BUG-024 | Chat Messages Not Delivered | ✅ Fixed |
| BUG-027 | Memory Leak on Long Sessions | ✅ Fixed |
| BUG-028 | Audio Echo in Video Calls | ✅ Fixed |
| BUG-029 | Stale Position After Reconnect | ✅ Fixed |
| BUG-030 | Keyboard Controls Stop Working | ✅ Fixed |
| BUG-031 | Room State Not Synced | ✅ Fixed |
| BUG-032 | Connection Lost on Refresh | ✅ Fixed |

---

## BUG-016 Fix Details: Message Queue Overflow

### Problem
WebSocket message queue could overflow during network instability, causing:
1. Memory exhaustion from unbounded queue growth
2. Critical messages (video signaling) getting dropped
3. Low-priority messages blocking important ones
4. No feedback on queue health

### Solution Implemented

#### 1. Added Priority Queue System
**File**: `frontend/src/services/websocket.ts`

```typescript
// Define priority levels for different message types
private readonly MESSAGE_PRIORITIES: Record<string, string> = {
  // Critical - must not be lost
  'join': 'critical',
  'leave': 'critical',
  'auth': 'critical',
  'proximity-video-call-signal': 'high',
  // ... more mappings
};

// Separate queues per priority level
private criticalQueue: Array<QueuedMessage> = [];
private highQueue: Array<QueuedMessage> = [];
private normalQueue: Array<QueuedMessage> = [];
private lowQueue: Array<QueuedMessage> = [];
```

#### 2. Added Queue Size Limits
```typescript
private readonly MAX_CRITICAL_QUEUE = 50;
private readonly MAX_HIGH_QUEUE = 100;
private readonly MAX_NORMAL_QUEUE = 200;
private readonly MAX_LOW_QUEUE = 50;
```

#### 3. Implemented Overflow Protection
```typescript
private queueMessage(message: { type: string; payload: EventData }): boolean {
  // Check queue capacity before adding
  // Drop from lower priority queues to make room for higher priority
  // Never drop critical messages
  // Returns false if message was dropped
}
```

#### 4. Priority-Based Processing
```typescript
private processMessageQueue(): void {
  // Process critical messages first (always all of them)
  // Then high priority (batch limited)
  // Then normal (batch limited)
  // Then low priority (batch limited)
  // Throttle between batches (50ms) to prevent overwhelming connection
}
```

#### 5. Added Queue Statistics
```typescript
public getQueueStats(): { 
  critical: number; 
  high: number; 
  normal: number; 
  low: number; 
  total: number 
}
```

### Priority Classification

| Priority | Message Types | Behavior |
|----------|---------------|----------|
| Critical | join, leave, auth, error | Never dropped, always processed first |
| High | video signals, user-joined/left | Can drop low priority to make room |
| Normal | move, chat-message | Standard processing |
| Low | position-update, typing | Can be dropped freely |

### Testing Recommendations
1. **Queue overflow test:** Disconnect network, send many messages, reconnect
2. **Priority test:** Verify critical messages delivered even when queue is full
3. **Monitor:** Check `getQueueStats()` during high load

---

## BUG-029 Fix Details: Stale Position After Reconnect

### Problem
After disconnecting and reconnecting (page refresh, tab sleep, network issue), user avatar appeared at old cached position for other users:
1. User-joined event appended instead of replacing existing user
2. No mechanism to refresh state after tab becomes visible
3. Server didn't have a way to send fresh room state on demand

### Solution Implemented

#### 1. Replace User on Join Instead of Append
**File**: `frontend/src/app/space/[id]/page.tsx`

```typescript
websocketService.on('user-joined-space', (payload) => {
  // BUG-029 FIX: Remove existing entry before adding
  setUsers(prev => {
    const filtered = prev.filter(u => u.id !== payload.userId);
    return [...filtered, newUser];
  });
});
```

#### 2. Added Visibility Change Handler
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden && isConnected && spaceId) {
      // Request fresh room state when tab becomes visible
      websocketService.send('request-room-state', { spaceId });
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [isConnected, spaceId]);
```

#### 3. Added request-room-state Message Handler
**File**: `metaverse/apps/ws/src/User.ts`

```typescript
case 'request-room-state':
  await this.handleRequestRoomState(parseData.payload);
  break;
```

#### 4. Implemented handleRequestRoomState
```typescript
private async handleRequestRoomState(payload: { spaceId?: string }): Promise<void> {
  const targetSpaceId = payload?.spaceId || this.spaceId;
  const currentUsers = Roommanager.getInstance().getUsersInSpace(targetSpaceId);
  
  // Map to positions, excluding self
  const userPositions = currentUsers
    .filter(user => user.getUserId() !== this.userId)
    .map(user => ({
      userId: user.getUserId(),
      username: user.getUsername(),
      x: user.getPosition()?.x || 0,
      y: user.getPosition()?.y || 0
    }));
  
  this.send({
    type: 'room-state-refresh',
    payload: { spaceId: targetSpaceId, users: userPositions, timestamp: Date.now() }
  });
}
```

#### 5. Added getUsersInSpace to RoomManager
**File**: `metaverse/apps/ws/src/Roommanager.ts`

```typescript
public getUsersInSpace(spaceId: string): User[] {
  return this.rooms.get(spaceId) || [];
}
```

#### 6. Frontend Handles room-state-refresh
```typescript
websocketService.on('room-state-refresh', (payload) => {
  const freshUsers = payload.users.map(user => ({
    id: user.userId,
    username: user.username,
    x: user.x * GRID_SIZE,
    y: user.y * GRID_SIZE
  }));
  
  setUsers(prev => {
    const userMap = new Map(prev.map(u => [u.id, u]));
    freshUsers.forEach(u => userMap.set(u.id, u));
    if (currentUser) userMap.delete(currentUser.id);
    return Array.from(userMap.values());
  });
});
```

### Testing Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Refresh page | User appears at spawn, not old position |
| Tab sleep/wake | Positions refresh when tab becomes visible |
| Network reconnect | Fresh positions sent on rejoin |

---

## BUG-030 Fix Details: Keyboard Controls Stop Working

### Problem
After clicking on UI elements like chat input, arrow key movement for the avatar stopped working because:
1. Browser focus moved to form elements (input, textarea)
2. Keyboard events captured by focused element, not the window listener
3. No way to easily return focus to the game canvas

### Solution Implemented

#### 1. Created useFocusTracker Hook
**File**: `frontend/src/hooks/useFocusTracker.ts`

```typescript
export function useFocusTracker(): boolean {
  const [isUIFocused, setIsUIFocused] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      if (isFormElement(target)) {
        setIsUIFocused(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        setIsUIFocused(isFormElement(active));
      }, 10); // Small delay for focus transfer between elements
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => { /* cleanup */ };
  }, []);

  return isUIFocused;
}
```

#### 2. Added Global Escape Handler
```typescript
export function useGlobalEscape(): void {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.dispatchEvent(new CustomEvent('global-escape'));
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);
}
```

#### 3. Updated Keyboard Handler to Check Focus
**File**: `frontend/src/app/space/[id]/page.tsx`

```typescript
// Import the hooks
import { useFocusTracker, useGlobalEscape } from '@/hooks/useFocusTracker';

// In component
const isUIFocused = useFocusTracker();
useGlobalEscape();

// In keyboard handler
const handleKeyPress = (event: KeyboardEvent) => {
  // Don't handle movement when user is typing
  if (isUIFocused) return;
  // ... rest of movement logic
};
```

#### 4. Auto-Blur Chat Input After Sending
```typescript
const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
    // Return focus to game
    (e.target as HTMLInputElement).blur();
  }
  if (e.key === 'Escape') {
    (e.target as HTMLInputElement).blur();
  }
};
```

#### 5. Added Visual Indicator
Shows a hint when keyboard controls are disabled:
```tsx
{isUIFocused && (
  <div className="... bg-yellow-500/90 ...">
    ⌨️ Press <kbd>Esc</kbd> or click canvas to enable movement
  </div>
)}
```

### Testing Scenarios

| Action | Expected Result |
|--------|-----------------|
| Move with arrows | Avatar moves |
| Click chat input | Controls hint appears |
| Press Enter to send | Input blurs, controls re-enabled |
| Press Escape | Input blurs, controls re-enabled |
| Click on canvas | Controls re-enabled |

---

## BUG-006 Fix Details: Video Call Not Ending Properly

### Problem
Video calls were not ending properly when users moved out of proximity range due to:
1. `checkProximityDisconnections()` using Euclidean pixel distance instead of Manhattan grid distance
2. Participant positions not being updated when users moved
3. No hysteresis or grace period causing call flickering at boundaries

### Solution Implemented

#### 1. Added Hysteresis Constants
```typescript
const CALL_END_DISTANCE_TILES = PROXIMITY_DISTANCE_TILES + 1; // 3 tiles
const GRACE_PERIOD_MS = 2000; // 2 seconds before call actually ends
const COOLDOWN_PERIOD_MS = 3000; // 3 seconds after call ends before new call can start
```

#### 2. Extended ProximityCallParticipant Interface
```typescript
interface ProximityCallParticipant {
  // ... existing fields ...
  disconnectGraceTimer: ReturnType<typeof setTimeout> | null;
  isLeavingProximity: boolean;
}
```

#### 3. Added Cooldown Map
```typescript
private callCooldowns: Map<string, number> = new Map();
```

#### 4. Rewrote `checkProximityDisconnections()` Method
- Uses `toGrid()` and `gridDistance()` for accurate distance calculation
- Implements hysteresis: start at 2 tiles, end at 3 tiles
- Adds grace period: 2 second delay before actually ending
- Emits `participant-leaving` and `participant-returned` events

#### 5. Updated `handleNearbyUsersUpdate()` Method
- Cleans up expired cooldowns
- Updates participant positions BEFORE distance checks
- Respects cooldown before initiating new calls
- Lets `checkProximityDisconnections()` handle gradual disconnection

#### 6. Updated `endProximityCallWithUser()` Method
- Clears grace timer on disconnect
- Sets cooldown to prevent rapid reconnection

### Events Added
```typescript
// Emitted when user is leaving proximity (grace period started)
this.emit('participant-leaving', { userId, username, gracePeriodMs });

// Emitted when user returned during grace period
this.emit('participant-returned', { userId, username });
```

### Testing Recommendations
1. **Boundary Test:**
   - Move to exactly 2 tiles distance → call should be active
   - Move to exactly 3 tiles distance → call should start grace period
   - Return to 2 tiles → call should continue (no interruption)
   
2. **Grace Period Test:**
   - Move beyond 3 tiles → wait < 2 seconds → return → call should continue
   - Move beyond 3 tiles → wait > 2 seconds → call should end
   
3. **Cooldown Test:**
   - End a call by moving away
   - Immediately return to proximity
   - Call should NOT restart for 3 seconds

---

## BUG-002 Fix Details: Video Stream Black Screen

### Problem
Remote video showed black screen despite camera being active due to:
1. Video element `srcObject` set before element fully mounted
2. Missing explicit `play()` call
3. Browser autoplay policies blocking video
4. No error handling or retry logic

### Solution Implemented

#### 1. Enhanced VideoStream Component
**File**: `frontend/src/components/ProximityVideoCallUI.tsx`

```typescript
const VideoStream: React.FC<VideoStreamProps> = ({...}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const attachStream = async () => {
      // 1. Set srcObject
      videoElement.srcObject = stream;
      
      // 2. Wait for metadata (with 5s timeout)
      await waitForMetadata();
      
      // 3. Start muted to bypass autoplay
      videoElement.muted = true;
      await videoElement.play();
      
      // 4. Unmute for remote video
      if (!isLocal) videoElement.muted = false;
    };
    
    attachStream();
  }, [stream]);
};
```

#### 2. Added Loading and Error States
- Spinner shown while video is loading
- Error overlay shown if video fails to play
- Track ended event handling

#### 3. Added Debug Logging
```typescript
onLoadedMetadata={() => console.log(`📹 [BUG-002] Metadata loaded`)}
onPlay={() => console.log(`▶️ [BUG-002] Video playing`)}
onError={(e) => console.error(`❌ [BUG-002] Video error:`, e)}
```

### Testing Recommendations
1. **Autoplay Test:**
   - Start video call in Chrome/Firefox/Safari
   - Verify video plays (may start muted due to autoplay policy)
   
2. **Track State Test:**
   - Check console for track info logs
   - Verify readyState and enabled properties

3. **Error Recovery Test:**
   - Deny camera permissions
   - Verify error overlay shown

---

## BUG-004 Fix Details: Peer Connection Memory Leak

### Problem
RTCPeerConnection objects were not properly cleaned up when users moved in/out of proximity:
1. Event listeners not removed before closing connections
2. Tracks not removed from senders
3. References held preventing garbage collection
4. No cleanup on page unload

### Solution Implemented

#### 1. Enhanced Cleanup in `endProximityCallWithUser()`
**File**: `frontend/src/services/proximityVideoCall.ts`

```typescript
private endProximityCallWithUser(userId: string): void {
  // 1. Remove ALL event listeners first
  peerConnection.ontrack = null;
  peerConnection.onicecandidate = null;
  peerConnection.onconnectionstatechange = null;
  // ... all other handlers
  
  // 2. Remove tracks from senders
  peerConnection.getSenders().forEach(sender => {
    peerConnection.removeTrack(sender);
  });
  
  // 3. Close connection
  peerConnection.close();
  
  // 4. Stop and remove remote tracks
  remoteStream.getTracks().forEach(track => {
    track.stop();
    remoteStream.removeTrack(track);
  });
  
  // 5. Clear ICE restart attempts
  this.iceRestartAttempts.delete(userId);
  
  // 6. Null out references
  participant.peerConnection = null;
  participant.remoteStream = null;
  participant.localStream = null;
}
```

#### 2. Page Unload Handlers
```typescript
constructor() {
  super();
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', this.handlePageUnload);
    window.addEventListener('pagehide', this.handlePageUnload);
  }
}

private handlePageUnload = (): void => {
  this.forceCleanup();
};
```

#### 3. Force Cleanup Method
```typescript
forceCleanup(): void {
  // Clear all cooldowns and ICE restart attempts
  this.callCooldowns.clear();
  this.iceRestartAttempts.clear();
  
  // End all connections without cooldowns
  for (const userId of this.state.participants.keys()) {
    this.endProximityCallWithUser(userId, false);
  }
  
  // Stop local stream
  this.state.localStream?.getTracks().forEach(track => track.stop());
  
  // Remove all listeners
  this.removeAllListeners();
}
```

### Testing Recommendations
1. **Memory Test:**
   - Open DevTools → Memory → Take heap snapshot
   - Trigger 10+ video calls
   - Take second snapshot
   - RTCPeerConnection count should be similar
   
2. **GC Test:**
   - After ending calls, force GC in DevTools
   - Connection count should drop to 0

3. **Page Unload Test:**
   - Open `chrome://webrtc-internals`
   - Start video call
   - Navigate away
   - Verify connections are closed

---

## BUG-027 Fix Details: Memory Leak on Long Sessions

### Problem
Memory would grow from ~150MB to 500MB+ over 1-2 hours due to:
1. Event listeners being added multiple times without deduplication
2. Chat messages accumulating without bound
3. Console.log statements holding object references
4. No periodic cleanup of stale data

### Solution Implemented

#### 1. Created Production-Safe Logger Utility
**File**: `frontend/src/utils/logger.ts`

```typescript
/**
 * Production-Safe Logger Utility
 * Only logs in development mode to prevent memory leaks from
 * console.log holding object references in production.
 */

const isDev = process.env.NODE_ENV === 'development';

export const debugLog = (...args: unknown[]): void => {
  if (isDev) console.log(...args);
};

export const debugWarn = (...args: unknown[]): void => {
  if (isDev) console.warn(...args);
};

export const debugError = (...args: unknown[]): void => {
  // Always log errors
  console.error(...args);
};

// Sanitize large objects before logging
export const sanitizeForLog = (obj: unknown, maxDepth = 2): unknown => {
  // ... prevents circular refs and truncates large arrays
};
```

#### 2. Created Memory Manager Service
**File**: `frontend/src/services/memoryManager.ts`

```typescript
/**
 * Memory Manager Service
 * Provides periodic cleanup and memory monitoring for long sessions.
 */

class MemoryManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupCallbacks: CleanupCallback[] = [];
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  start(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  registerCleanup(name: string, callback: () => void, priority = 10): void {
    // Register cleanup callback with priority
  }

  performCleanup(): void {
    // Run all registered cleanup callbacks
    // Log memory stats in development
    // Warn on high memory usage
  }

  getMemoryStats(): MemoryStats | null {
    // Return current heap usage
  }

  getMemoryTrend(): { growing: boolean; ratePerHour: number } | null {
    // Analyze memory growth rate
  }
}

export const memoryManager = new MemoryManager();
```

#### 3. Fixed Event Listener Deduplication
**File**: `frontend/src/services/websocket.ts`

```typescript
/**
 * BUG-027 FIX: Prevents duplicate listener registration
 */
on<T = unknown>(event: string, listener: EventListener<T>): boolean {
  const listeners = this.eventListeners.get(event) || [];
  
  // Check for duplicate listener
  if (listeners.includes(listener as EventListener)) {
    console.warn(`⚠️ Duplicate listener prevented for event: ${event}`);
    return false;
  }
  
  listeners.push(listener as EventListener);
  return true;
}

off<T = unknown>(event: string, listener: EventListener<T>): void {
  const listeners = this.eventListeners.get(event);
  if (listeners) {
    const index = listeners.indexOf(listener as EventListener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    // BUG-027: Clean up empty arrays
    if (listeners.length === 0) {
      this.eventListeners.delete(event);
    }
  }
}

// Stats methods for monitoring
getListenerStats(): { event: string; count: number }[] { ... }
getTotalListenerCount(): number { ... }
checkForListenerLeaks(): { event: string; count: number }[] { ... }
```

#### 4. Added Chat Message Bounds
**File**: `frontend/src/app/space/[id]/page.tsx`

```typescript
/**
 * BUG-027 FIX: Maximum messages per chatroom to prevent unbounded growth
 */
const MAX_MESSAGES_PER_ROOM = 100;

// When receiving messages
setChatMessages(prev => {
  const newMap = new Map(prev);
  const existing = newMap.get(chatroomId) || [];
  // Keep only last N messages
  newMap.set(chatroomId, [...existing, newMessage].slice(-MAX_MESSAGES_PER_ROOM));
  return newMap;
});
```

#### 5. Added Memory Manager Integration
```typescript
useEffect(() => {
  // Start memory monitoring
  memoryManager.start();
  
  // Register cleanup for chat messages
  memoryManager.registerCleanup('chatMessages', () => {
    setChatMessages(prev => {
      const newMap = new Map<string, ChatMessage[]>();
      for (const [roomId, messages] of prev.entries()) {
        if (activeChatrooms.has(roomId)) {
          // Keep only active rooms, trim to max
          newMap.set(roomId, messages.slice(-MAX_MESSAGES_PER_ROOM));
        }
      }
      return newMap;
    });
  }, 5);
  
  // Register listener leak check
  memoryManager.registerCleanup('staleUsers', () => {
    const leaks = websocketService.checkForListenerLeaks();
    if (leaks.length > 0) {
      debugWarn('⚠️ Potential listener leaks:', leaks);
    }
  }, 10);
  
  return () => {
    memoryManager.stop();
    // Clear all state on unmount
    setUsers([]);
    setChatMessages(new Map());
    setActiveChatrooms(new Set());
  };
}, []);
```

### Files Modified
1. `frontend/src/utils/logger.ts` - NEW: Production-safe logging
2. `frontend/src/services/memoryManager.ts` - NEW: Memory monitoring service
3. `frontend/src/services/websocket.ts` - Added listener deduplication and stats
4. `frontend/src/app/space/[id]/page.tsx` - Added message bounds and memory manager

### Testing Recommendations

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Memory Stability | Use app for 1 hour | Memory stays under 200MB |
| Listener Check | Call `websocketService.getListenerStats()` | No event has >10 listeners |
| Chat Bounds | Send 150 messages in one room | Only 100 messages in state |
| Cleanup Timing | Check console every 5 min | "🧹 Running periodic memory cleanup" appears |

### Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Heap Size Growth/Hour | < 10 MB | > 50 MB |
| Event Listeners Count | < 200 | > 500 |
| Messages Per Room | ≤ 100 | N/A (hard capped) |
| Chatroom Caches | Active only | Inactive cleared on cleanup |
