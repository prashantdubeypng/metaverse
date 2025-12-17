# BUG-006: Video Call Not Ending Properly

## Bug Information

**Bug ID**: BUG-006  
**Title**: Video Call Continues After User Leaves Proximity  
**Severity**: Major  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

When a user moves away from another user beyond the 2-tile proximity threshold, the video call doesn't automatically end. Users remain connected even when they're across the room, defeating the purpose of proximity-based calls.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Call Manager | `frontend/src/services/proximityVideoCall.ts` | Frontend |
| Proximity Detection | `frontend/src/utils/ProximityVideoCallHandler.ts` | Frontend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |

---

## Reproduction Steps

1. Open application in two browser windows (User A, User B)
2. Both users join the same space
3. Move User A and User B within 2 tiles of each other
4. Video call automatically starts - works correctly
5. Move User A 10 tiles away from User B
6. Video call continues playing!
7. Video should have ended when distance > 2 tiles

**Expected Behavior**:  
Video call should automatically end when users move beyond 2-tile proximity.

**Actual Behavior**:  
Video call continues indefinitely regardless of distance.

---

## Root Cause Analysis

### 1. Proximity Check Only on Move

The proximity check may only run when initiating a call, not continuously:

```typescript
// Current: Only checks proximity when starting call
updatePosition(position: Position) {
  // ... updates position but doesn't check for ending calls
}
```

### 2. Missing Distance Check in Update Loop

```typescript
// proximityVideoCall.ts
updatePosition(x: number, y: number) {
  this.state.localPosition = { x, y };
  
  // Checks for NEW nearby users, but not for existing connections
  const nearbyUsers = this.getNearbyUsers();
  for (const user of nearbyUsers) {
    if (!this.hasActiveCall(user.id)) {
      this.initiateCall(user.id);
    }
  }
  // Missing: Check if existing calls should end!
}
```

### 3. No End Call Trigger

There's no mechanism to end calls based on distance:

```typescript
// Should exist but doesn't:
checkForCallsToEnd() {
  for (const [userId, call] of this.activeCalls) {
    const distance = this.getDistanceToUser(userId);
    if (distance > this.proximityRange) {
      this.endCall(userId);
    }
  }
}
```

---

## Solution

### 1. Add Continuous Proximity Checking

```typescript
// frontend/src/services/proximityVideoCall.ts

class ProximityVideoCallManager {
  private readonly CALL_START_DISTANCE = 40;  // 2 tiles * 20px
  private readonly CALL_END_DISTANCE = 60;    // Hysteresis to prevent flickering
  private activeCalls: Map<string, RTCPeerConnection> = new Map();

  updatePosition(x: number, y: number): void {
    this.state.localPosition = { x, y };
    
    // Check for new calls to start
    this.checkForNewCalls();
    
    // Check for existing calls to end
    this.checkForCallsToEnd();
  }

  private checkForNewCalls(): void {
    const nearbyUsers = this.getUsersWithinDistance(this.CALL_START_DISTANCE);
    
    for (const user of nearbyUsers) {
      if (!this.activeCalls.has(user.id)) {
        console.log(`📞 Starting call with ${user.id} (distance: ${this.getDistance(user)})`);
        this.initiateCall(user.id);
      }
    }
  }

  private checkForCallsToEnd(): void {
    for (const [userId, connection] of this.activeCalls) {
      const distance = this.getDistanceToUser(userId);
      
      if (distance > this.CALL_END_DISTANCE) {
        console.log(`📴 Ending call with ${userId} (distance: ${distance})`);
        this.endCall(userId, 'proximity-lost');
      }
    }
  }

  private getDistanceToUser(userId: string): number {
    const user = this.state.users.get(userId);
    if (!user || !this.state.localPosition) {
      return Infinity;
    }
    
    const dx = user.x - this.state.localPosition.x;
    const dy = user.y - this.state.localPosition.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getUsersWithinDistance(maxDistance: number): UserData[] {
    return Array.from(this.state.users.values())
      .filter(user => this.getDistanceToUser(user.id) <= maxDistance);
  }
}
```

### 2. Implement Proper Call Ending

```typescript
// frontend/src/services/proximityVideoCall.ts

async endCall(userId: string, reason: string = 'manual'): Promise<void> {
  const connection = this.activeCalls.get(userId);
  
  if (!connection) {
    console.warn(`No active call with ${userId} to end`);
    return;
  }

  console.log(`📴 Ending call with ${userId}, reason: ${reason}`);

  // Close the peer connection
  connection.close();
  
  // Remove from active calls
  this.activeCalls.delete(userId);
  
  // Notify the other user
  this.sendSignaling({
    type: 'call-ended',
    targetUserId: userId,
    payload: { reason }
  });

  // Stop local media if no active calls remaining
  if (this.activeCalls.size === 0) {
    this.stopLocalMedia();
  }

  // Update UI
  this.emit('call-ended', { userId, reason });
}

private stopLocalMedia(): void {
  if (this.localStream) {
    for (const track of this.localStream.getTracks()) {
      track.stop();
    }
    this.localStream = null;
  }
}
```

### 3. Add Hysteresis to Prevent Flickering

```typescript
// Prevent calls from rapidly starting/ending when user is at threshold
class ProximityCallManager {
  private readonly HYSTERESIS = 20; // pixels
  private recentlyEndedCalls: Map<string, number> = new Map();
  private readonly COOLDOWN_PERIOD = 3000; // 3 seconds

  private shouldStartCall(userId: string, distance: number): boolean {
    // Don't start if we just ended a call with this user
    const endedAt = this.recentlyEndedCalls.get(userId);
    if (endedAt && Date.now() - endedAt < this.COOLDOWN_PERIOD) {
      return false;
    }
    
    return distance <= this.CALL_START_DISTANCE;
  }

  private shouldEndCall(userId: string, distance: number): boolean {
    // Use higher threshold for ending (hysteresis)
    return distance > this.CALL_START_DISTANCE + this.HYSTERESIS;
  }

  endCall(userId: string, reason: string): void {
    // ... existing end logic ...
    
    // Record when call ended for cooldown
    this.recentlyEndedCalls.set(userId, Date.now());
    
    // Clean up old entries
    setTimeout(() => {
      this.recentlyEndedCalls.delete(userId);
    }, this.COOLDOWN_PERIOD);
  }
}
```

### 4. Handle User Disconnection

```typescript
// When user disconnects, clean up their calls
onUserDisconnected(userId: string): void {
  if (this.activeCalls.has(userId)) {
    console.log(`User ${userId} disconnected, ending call`);
    this.endCall(userId, 'user-disconnected');
  }
  
  // Remove from user list
  this.state.users.delete(userId);
}

// Subscribe to user-left events
websocket.on('user-left', (data) => {
  this.onUserDisconnected(data.userId);
});
```

### 5. Add Grace Period for Temporary Distance Changes

```typescript
// Allow brief excursions beyond threshold without ending call
class ProximityCallManager {
  private outOfRangeTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly GRACE_PERIOD = 2000; // 2 seconds

  checkForCallsToEnd(): void {
    for (const [userId, connection] of this.activeCalls) {
      const distance = this.getDistanceToUser(userId);
      
      if (distance > this.CALL_END_DISTANCE) {
        // Start grace period timer if not already started
        if (!this.outOfRangeTimers.has(userId)) {
          const timer = setTimeout(() => {
            // Check distance again after grace period
            if (this.getDistanceToUser(userId) > this.CALL_END_DISTANCE) {
              this.endCall(userId, 'proximity-lost');
            }
            this.outOfRangeTimers.delete(userId);
          }, this.GRACE_PERIOD);
          
          this.outOfRangeTimers.set(userId, timer);
        }
      } else {
        // Back in range, cancel timer
        const timer = this.outOfRangeTimers.get(userId);
        if (timer) {
          clearTimeout(timer);
          this.outOfRangeTimers.delete(userId);
        }
      }
    }
  }
}
```

---

## Testing

### Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Move beyond 2 tiles | Call ends within 2 seconds |
| Move beyond then quickly return | Call continues (grace period) |
| Other user disconnects | Call ends immediately |
| Refresh page during call | Call ends on both sides |
| Move exactly at 2 tile boundary | Call stable (hysteresis) |

### Automated Test

```typescript
describe('Proximity Call Ending', () => {
  it('should end call when user moves away', async () => {
    // Setup call between users at (0,0) and (20,0) - 1 tile apart
    await startCall(userA, userB);
    expect(userA.hasActiveCall(userB.id)).toBe(true);
    
    // Move userB to (100, 0) - 5 tiles away
    userB.updatePosition(100, 0);
    
    // Wait for proximity check
    await wait(100);
    
    // Call should be ended
    expect(userA.hasActiveCall(userB.id)).toBe(false);
  });
});
```

---

## Prevention

1. **Always pair call-start with call-end logic**
2. **Use hysteresis** for threshold-based behavior
3. **Handle all disconnection scenarios** (navigation, close, crash)
4. **Test proximity boundaries** thoroughly
5. **Add grace periods** for brief threshold crossings

---

## Related Issues

- **Related Bugs**: BUG-001 (call not triggering), BUG-004 (connection leak)
- **UX**: Consider visual indicator showing proximity status
- **Performance**: Frequent distance checks may impact performance

---

## Notes

- Consider WebSocket ping to detect disconnected users faster
- Mobile devices may have GPS-based proximity in future
- Grace period prevents jarring call endings during movement
