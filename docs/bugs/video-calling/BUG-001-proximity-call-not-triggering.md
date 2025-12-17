# BUG-001: Proximity Video Call Not Triggering

## Bug Information

**Bug ID**: BUG-001  
**Title**: Proximity Video Call Not Triggering When Users Are Within 2 Tiles  
**Severity**: Critical  
**Status**: Fixed (Partially)  
**Date Reported**: 2025-12-01  
**Date Fixed**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Development Team  

---

## Summary

When two users move within 2 tiles (40 pixels) of each other, the proximity video call system fails to automatically initiate a video call. The proximity detection logic runs but does not properly trigger the WebRTC connection establishment. This breaks the core "virtual office" experience where users should seamlessly start video calls by walking up to each other.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Call Manager | `frontend/src/services/proximityVideoCall.ts` | Frontend |
| Proximity Manager Component | `frontend/src/components/ProximityManager.tsx` | Frontend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |
| WebSocket User Handler | `metaverse/apps/ws/src/User.ts` | Backend |
| Video Call Manager | `metaverse/apps/ws/src/VideoCallManager.ts` | Backend |

---

## Reproduction Steps

1. Open the application in two different browser windows
2. Log in with two different user accounts
3. Join the same space
4. Move User A to position (100, 100) pixels
5. Move User B to position (120, 100) pixels (within 2 tiles)
6. Observe: Video call should auto-start but doesn't

**Expected Behavior**:  
When two users are within 2 tiles (40 pixels) of each other, video call UI should appear and WebRTC connection should be established automatically.

**Actual Behavior**:  
Users can be standing next to each other and no video call initiates. Console logs show proximity detection is running but `initiateProximityCall` is not being called.

---

## Console Logs / Error Messages

```
🎥 [DEBUG] Proximity detection in video service: {
  localPosition: {x: 100, y: 100},
  localGridPos: {x: 5, y: 5},
  nearbyUsers: [{
    username: "User2",
    pixelPos: {x: 800, y: 800},  // ← WRONG! Should be 120, 100
    gridPos: {x: 40, y: 40},     // ← WRONG! Backend sent pixels as grid
    manhattanDistance: 70,       // ← Too far because of wrong coordinates
    inRange: false
  }],
  usersInRange: 0
}
```

---

## Root Cause Analysis

### Problem

There are **multiple issues** causing this bug:

1. **Coordinate System Mismatch**: The `proximity-position-update` message was sending pixel coordinates (e.g., 100, 100) to the backend, but the backend expected grid coordinates (e.g., 5, 5). The backend then sent these "grid" coordinates back to other users, who converted them to pixels again (100 * 20 = 2000 pixels), causing users to appear far apart.

2. **Missing User List**: The `ProximityManager` component was not receiving the full list of all users in the space, only relying on WebSocket events which may miss users already present.

3. **Initialization Timing**: The proximity video call system was initialized before the current user's position was known, causing incorrect distance calculations.

### Technical Details

**File**: `frontend/src/services/proximityVideoCall.ts` (Line ~110)

```typescript
// BUGGY CODE - Sending pixel coordinates
updatePosition(x: number, y: number, z: number = 0): void {
  this.state.localPosition = { x, y, z };
  
  if (this.websocketService) {
    this.websocketService.emit('proximity-position-update', {
      userId: this.currentUserId,
      position: {
        x: x,  // ← This is PIXELS, backend expects GRID!
        y: y,
        z: z
      },
      isInVideoCall: this.state.isActive,
    });
  }
}
```

---

## Solution

### Approach

1. Convert pixel coordinates to grid coordinates before sending to backend
2. Pass all users list to ProximityManager component
3. Add active proximity checking in addition to WebSocket event listening

### Code Changes

**File**: `frontend/src/services/proximityVideoCall.ts`

```typescript
// BEFORE (buggy code)
updatePosition(x: number, y: number, z: number = 0): void {
  this.state.localPosition = { x, y, z };
  
  if (this.websocketService) {
    this.websocketService.emit('proximity-position-update', {
      userId: this.currentUserId,
      position: { x, y, z },
      isInVideoCall: this.state.isActive,
    });
  }
}

// AFTER (fixed code)
updatePosition(x: number, y: number, z: number = 0): void {
  const oldPosition = { ...this.state.localPosition };
  this.state.localPosition = { x, y, z };
  
  // Convert pixel coordinates to grid coordinates for backend
  const GRID_SIZE = 20;
  const gridX = Math.round(x / GRID_SIZE);
  const gridY = Math.round(y / GRID_SIZE);
  
  console.log('📍 [DEBUG] Position updated in video service:', {
    oldPosition,
    newPosition: this.state.localPosition,
    gridPosition: { x: gridX, y: gridY },
    currentUserId: this.currentUserId
  });
  
  // Send GRID coordinates to backend (not pixel coordinates!)
  if (this.websocketService) {
    this.websocketService.emit('proximity-position-update', {
      userId: this.currentUserId,
      position: {
        x: gridX,  // ← Send grid coordinates
        y: gridY,  // ← Send grid coordinates
        z: z
      },
      isInVideoCall: this.state.isActive,
    });
  }

  // Check if we need to disconnect from users who are too far
  this.checkProximityDisconnections();
}
```

**File**: `frontend/src/app/space/[id]/page.tsx`

```typescript
// BEFORE - ProximityManager not receiving all users
<ProximityManager
  userId={currentUser.id}
  username={currentUser.username}
  currentPosition={{ x: currentUser.x, y: currentUser.y, z: 0 }}
  onNearbyUsersChange={(nearbyUsers) => {
    console.log('Nearby users:', nearbyUsers);
  }}
/>

// AFTER - Pass all users to ProximityManager
<ProximityManager
  userId={currentUser.id}
  username={currentUser.username}
  currentPosition={{ x: currentUser.x, y: currentUser.y, z: 0 }}
  allUsers={[...users, { ...currentUser, isCurrentUser: true }]}  // ← Add this
  onNearbyUsersChange={(nearbyUsers) => {
    console.log('🎥 [SPACE PAGE] Nearby users updated:', nearbyUsers);
  }}
/>
```

---

## Testing

### Manual Testing

1. Open two browser windows with different users
2. Join the same space
3. Move users to be 2 tiles apart (40 pixels)
4. Verify console shows correct coordinates:
   ```
   📍 [DEBUG] Position updated: gridPosition: {x: 5, y: 5}
   ```
5. Verify proximity detection shows users in range:
   ```
   🎥 [DEBUG] Proximity detection: usersInRange: 1
   ```
6. Verify video call UI appears
7. Verify WebRTC connection is established

### Automated Testing

```typescript
describe('BUG-001: Proximity Video Call Trigger', () => {
  it('should convert pixel to grid coordinates before sending', () => {
    const GRID_SIZE = 20;
    const pixelX = 100;
    const pixelY = 140;
    
    const gridX = Math.round(pixelX / GRID_SIZE);
    const gridY = Math.round(pixelY / GRID_SIZE);
    
    expect(gridX).toBe(5);
    expect(gridY).toBe(7);
  });

  it('should trigger video call when Manhattan distance <= 2', () => {
    const user1 = { x: 5, y: 5 }; // Grid coordinates
    const user2 = { x: 6, y: 6 }; // Grid coordinates
    
    const manhattanDistance = Math.abs(user1.x - user2.x) + Math.abs(user1.y - user2.y);
    
    expect(manhattanDistance).toBe(2);
    expect(manhattanDistance <= 2).toBe(true);
  });
});
```

---

## Remaining Issues

This bug is **partially fixed**. The coordinate conversion is now correct, but there are still edge cases:

1. **Race Condition**: If both users try to initiate call simultaneously, duplicate connections may occur
2. **Quick Movement**: If a user moves in and out of range quickly, call may not clean up properly
3. **Multiple Users**: With 3+ users in proximity, call management becomes complex

See related bugs:
- BUG-004: Peer Connection Leak
- BUG-006: Call Not Ending Properly

---

## Related Issues

- **Related Bugs**: BUG-004, BUG-006, BUG-011
- **Root Cause Issue**: Coordinate system mismatch (grid vs pixel)
- **Similar Pattern**: BUG-009, BUG-010, BUG-014

---

## Notes

The proximity range is intentionally set to 2 tiles (40 pixels) to create a natural "personal space" interaction. Consider making this configurable in the future for different room types (e.g., conference rooms might have larger range).
