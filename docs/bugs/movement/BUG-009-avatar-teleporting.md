# BUG-009: Avatar Teleporting to Wrong Position

## Bug Information

**Bug ID**: BUG-009  
**Title**: Avatar Teleports to Position (800, 800) When Moving  
**Severity**: Critical  
**Status**: Fixed  
**Date Reported**: 2025-12-01  
**Date Fixed**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Development Team  

---

## Summary

When a user moves their avatar, it suddenly teleports to position (800, 800) pixels instead of moving one grid cell in the intended direction. This makes the application completely unusable as users lose control of their avatar position. The bug is caused by a coordinate system mismatch between frontend and backend.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Call Service | `frontend/src/services/proximityVideoCall.ts` | Frontend |
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |
| User Handler | `metaverse/apps/ws/src/User.ts` | Backend |

---

## Reproduction Steps

1. Join a space
2. Use arrow keys to move avatar
3. Observe avatar jumps to (800, 800) instead of moving one tile
4. Check console for coordinate mismatch logs

**Expected Behavior**:  
Avatar should move 20 pixels (1 tile) in the direction of arrow key press.

**Actual Behavior**:  
Avatar teleports to (800, 800) pixels after move attempt.

---

## Console Logs / Error Messages

```
📍 Sent movement request - Pixel: (60, 40) → Grid: (3, 2)
🚶 User moved: {userId: 'user123', x: 40, y: 40}  // ← Backend sent grid coords
🔄 [USER-MOVED] Converting Grid: (40, 40) → Pixel: (800, 800)  // ← Bug! 40 is grid, not pixel
✅ [SET CURRENT USER] Updating from (60, 40) to (800, 800)  // ← Teleported!
```

---

## Root Cause Analysis

### Problem

The coordinate system mismatch creates a feedback loop:

1. **Frontend sends**: Grid coordinates (3, 2) to backend
2. **Backend validates**: Position (3, 2) is valid, stores (3, 2)
3. **Backend broadcasts**: Position (3, 2) to all clients
4. **Frontend receives**: (3, 2) and INCORRECTLY multiplies by grid size
5. **Result**: User position becomes (60, 40) instead of (60, 40)

But the BUG was in proximity-position-update which sent PIXELS as if they were grid:

1. **Proximity service sends**: Pixel position (60, 40) labeled as "position"
2. **Backend receives**: Thinks (60, 40) is grid coordinates
3. **Backend rejects**: Grid (60, 40) is out of bounds for a 40x30 tile space
4. **Backend sends move-rejected**: With last valid position in grid coords (40, 40)
5. **Frontend receives**: (40, 40) grid × 20 = (800, 800) pixels
6. **Result**: Avatar teleports to (800, 800)

### Technical Details

**File**: `frontend/src/services/proximityVideoCall.ts` (Line ~110)

```typescript
// BUGGY CODE
updatePosition(x: number, y: number, z: number = 0): void {
  this.state.localPosition = { x, y, z };
  
  if (this.websocketService) {
    this.websocketService.emit('proximity-position-update', {
      userId: this.currentUserId,
      position: {
        x: x,  // ← 'x' is in PIXELS (e.g., 60)
        y: y,  // ← 'y' is in PIXELS (e.g., 40)
        z: z
      },
      isInVideoCall: this.state.isActive,
    });
  }
}
```

**Backend then processes this** in `User.ts`:

```typescript
private handleProximityPositionUpdate(payload: any): void {
  const { x, y, z } = payload;
  
  // Backend STORES pixel values as if they were grid
  if (typeof x === 'number' && typeof y === 'number') {
    this.x = x;  // ← Stores 60 as grid position!
    this.y = y;  // ← Stores 40 as grid position!
  }
}
```

This corrupts the user's server-side position, and subsequent move validations fail.

---

## Solution

### Approach

Convert pixel coordinates to grid coordinates BEFORE sending to backend.

### Code Changes

**File**: `frontend/src/services/proximityVideoCall.ts`

```typescript
// BEFORE (buggy)
updatePosition(x: number, y: number, z: number = 0): void {
  this.state.localPosition = { x, y, z };
  
  if (this.websocketService) {
    this.websocketService.emit('proximity-position-update', {
      userId: this.currentUserId,
      position: {
        x: x,  // Pixel coordinates - WRONG!
        y: y,
        z: z
      },
      isInVideoCall: this.state.isActive,
    });
  }
}

// AFTER (fixed)
updatePosition(x: number, y: number, z: number = 0): void {
  const oldPosition = { ...this.state.localPosition };
  this.state.localPosition = { x, y, z };
  
  // Convert pixel coordinates to grid coordinates for backend
  const GRID_SIZE = 20;
  const gridX = Math.round(x / GRID_SIZE);
  const gridY = Math.round(y / GRID_SIZE);
  
  console.log('📍 [DEBUG] Position updated:', {
    pixelPosition: { x, y },
    gridPosition: { x: gridX, y: gridY }
  });
  
  if (this.websocketService) {
    this.websocketService.emit('proximity-position-update', {
      userId: this.currentUserId,
      position: {
        x: gridX,  // Grid coordinates - CORRECT!
        y: gridY,
        z: z
      },
      isInVideoCall: this.state.isActive,
    });
  }
}
```

---

## Testing

### Manual Testing

1. Join a space
2. Move avatar using arrow keys
3. Verify console shows correct coordinate conversion:
   ```
   📍 [DEBUG] Position updated: pixelPosition: {x: 60, y: 40}, gridPosition: {x: 3, y: 2}
   ```
4. Verify avatar moves smoothly without teleporting
5. Verify other users see correct position

### Automated Testing

```typescript
describe('BUG-009: Coordinate Conversion', () => {
  const GRID_SIZE = 20;

  it('should convert pixel to grid coordinates correctly', () => {
    const testCases = [
      { pixel: { x: 0, y: 0 }, grid: { x: 0, y: 0 } },
      { pixel: { x: 20, y: 20 }, grid: { x: 1, y: 1 } },
      { pixel: { x: 60, y: 40 }, grid: { x: 3, y: 2 } },
      { pixel: { x: 100, y: 100 }, grid: { x: 5, y: 5 } },
      { pixel: { x: 800, y: 600 }, grid: { x: 40, y: 30 } },
    ];

    testCases.forEach(({ pixel, grid }) => {
      expect(Math.round(pixel.x / GRID_SIZE)).toBe(grid.x);
      expect(Math.round(pixel.y / GRID_SIZE)).toBe(grid.y);
    });
  });

  it('should convert grid to pixel coordinates correctly', () => {
    const testCases = [
      { grid: { x: 0, y: 0 }, pixel: { x: 0, y: 0 } },
      { grid: { x: 1, y: 1 }, pixel: { x: 20, y: 20 } },
      { grid: { x: 3, y: 2 }, pixel: { x: 60, y: 40 } },
    ];

    testCases.forEach(({ grid, pixel }) => {
      expect(grid.x * GRID_SIZE).toBe(pixel.x);
      expect(grid.y * GRID_SIZE).toBe(pixel.y);
    });
  });
});
```

---

## Coordinate System Reference

| Context | Unit | Example | Description |
|---------|------|---------|-------------|
| Frontend Display | Pixels | (60, 40) | Position on canvas |
| Backend Storage | Grid | (3, 2) | Logical position in grid |
| WebSocket Messages | Grid | (3, 2) | Backend always uses grid |
| User Movement | Grid | (1, 0) | Delta for one tile move |

### Conversion Formulas

```typescript
const GRID_SIZE = 20; // pixels per grid cell

// Pixel to Grid
const gridX = Math.round(pixelX / GRID_SIZE);
const gridY = Math.round(pixelY / GRID_SIZE);

// Grid to Pixel
const pixelX = gridX * GRID_SIZE;
const pixelY = gridY * GRID_SIZE;
```

---

## Related Issues

- **Related Bugs**: BUG-010, BUG-011, BUG-014 (all coordinate-related)
- **Same Root Cause**: Inconsistent coordinate system usage
- **Prevention**: Consider creating a shared Coordinates utility

---

## Prevention Recommendations

1. **Type Safety**: Create distinct types for GridCoordinates vs PixelCoordinates
2. **Utility Functions**: Centralize all coordinate conversions
3. **Validation**: Add runtime checks for coordinate ranges
4. **Documentation**: Clear documentation of coordinate systems

```typescript
// Suggested types
type GridCoordinates = { gridX: number; gridY: number };
type PixelCoordinates = { pixelX: number; pixelY: number };

// Utility functions
function pixelToGrid(pixel: PixelCoordinates): GridCoordinates {
  return {
    gridX: Math.round(pixel.pixelX / GRID_SIZE),
    gridY: Math.round(pixel.pixelY / GRID_SIZE)
  };
}

function gridToPixel(grid: GridCoordinates): PixelCoordinates {
  return {
    pixelX: grid.gridX * GRID_SIZE,
    pixelY: grid.gridY * GRID_SIZE
  };
}
```
