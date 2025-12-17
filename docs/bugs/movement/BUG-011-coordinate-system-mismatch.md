# BUG-011: Coordinate System Mismatch (Grid vs Pixel)

## Bug Information

**Bug ID**: BUG-011  
**Title**: Inconsistent Coordinate System Usage Across Frontend and Backend  
**Severity**: Critical  
**Status**: Partially Fixed  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Development Team  

---

## Summary

The application uses two coordinate systems—grid coordinates (used by backend) and pixel coordinates (used by frontend rendering)—but there is no consistent conversion layer. This leads to multiple bugs where coordinates are interpreted incorrectly, causing position desync, movement rejection, and avatar teleportation. This is the root cause of BUG-009, BUG-010, and BUG-014.

---

## Affected Components

| Component | File Path | Coordinate System |
|-----------|-----------|-------------------|
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Mixed (bug source) |
| Office Space Viewer | `frontend/src/components/OfficeSpaceViewer.tsx` | Pixel |
| Proximity Video Service | `frontend/src/services/proximityVideoCall.ts` | Mixed (bug source) |
| WebSocket Service | `frontend/src/services/websocket.ts` | Converts on receive |
| User Handler Backend | `metaverse/apps/ws/src/User.ts` | Grid |
| Room Manager | `metaverse/apps/ws/src/Roommanager.ts` | Grid |

---

## The Problem

### Backend Coordinate System

The backend stores and validates all positions in **grid coordinates**:

```typescript
// metaverse/apps/ws/src/User.ts
private x: number;  // Grid X (0-39 for 800px width / 20px grid)
private y: number;  // Grid Y (0-29 for 600px height / 20px grid)

// Space bounds calculation
const maxGridX = Math.floor((space.width || 800) / 20) - 1;  // 39
const maxGridY = Math.floor((space.height || 600) / 20) - 1; // 29
```

### Frontend Coordinate System

The frontend renders avatars in **pixel coordinates**:

```typescript
// frontend/src/components/OfficeSpaceViewer.tsx
<div style={{
  left: user.x,   // Pixel X (0-800)
  top: user.y,    // Pixel Y (0-600)
}}>
```

### The Mismatch

| Message | Sender Thinks | Receiver Thinks | Bug? |
|---------|--------------|-----------------|------|
| `join` response | Grid (3, 2) | Grid → Pixel (60, 40) | ✅ Correct |
| `user-moved` | Grid (3, 2) | Grid → Pixel (60, 40) | ✅ Correct |
| `move` request | Grid (4, 2) | Grid (4, 2) | ✅ Correct |
| `proximity-position-update` | Pixel (60, 40) | Grid (60, 40) | ❌ BUG! |

---

## All Affected Message Types

### ✅ Correct Handling

| Message | Direction | Conversion |
|---------|-----------|------------|
| `space-joined.spawn` | Server → Client | Grid × 20 = Pixel |
| `user-joined-space.spawn` | Server → Client | Grid × 20 = Pixel |
| `user-moved` | Server → Client | Grid × 20 = Pixel |
| `move` | Client → Server | Pixel / 20 = Grid |

### ❌ Incorrect Handling (Bugs)

| Message | Direction | Current (Buggy) | Should Be |
|---------|-----------|-----------------|-----------|
| `proximity-position-update` | Client → Server | Pixel | Grid |
| `proximity-user-position` | Server → Client | Grid | Grid (but clients may interpret as Pixel) |

---

## Solution

### Approach 1: Centralized Coordinate Utility (Recommended)

Create a shared coordinate utility used everywhere:

**File**: `frontend/src/utils/coordinates.ts`

```typescript
export const GRID_SIZE = 20; // pixels per grid cell

export interface GridPosition {
  gridX: number;
  gridY: number;
}

export interface PixelPosition {
  pixelX: number;
  pixelY: number;
}

/**
 * Convert pixel coordinates to grid coordinates
 * Use when sending data TO backend
 */
export function toGrid(pixel: { x: number; y: number }): GridPosition {
  return {
    gridX: Math.round(pixel.x / GRID_SIZE),
    gridY: Math.round(pixel.y / GRID_SIZE)
  };
}

/**
 * Convert grid coordinates to pixel coordinates
 * Use when receiving data FROM backend
 */
export function toPixel(grid: { x: number; y: number }): PixelPosition {
  return {
    pixelX: grid.x * GRID_SIZE,
    pixelY: grid.y * GRID_SIZE
  };
}

/**
 * Validate grid position is within space bounds
 */
export function isValidGridPosition(
  grid: GridPosition, 
  spaceWidth: number, 
  spaceHeight: number
): boolean {
  const maxX = Math.floor(spaceWidth / GRID_SIZE) - 1;
  const maxY = Math.floor(spaceHeight / GRID_SIZE) - 1;
  
  return (
    grid.gridX >= 0 && 
    grid.gridX <= maxX && 
    grid.gridY >= 0 && 
    grid.gridY <= maxY
  );
}

/**
 * Calculate Manhattan distance in grid units
 */
export function gridDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY);
}

/**
 * Clamp pixel position to space bounds
 */
export function clampPixel(
  pixel: { x: number; y: number },
  spaceWidth: number,
  spaceHeight: number
): PixelPosition {
  return {
    pixelX: Math.max(GRID_SIZE, Math.min(spaceWidth - GRID_SIZE, pixel.x)),
    pixelY: Math.max(GRID_SIZE, Math.min(spaceHeight - GRID_SIZE, pixel.y))
  };
}
```

### Approach 2: WebSocket Message Wrapper

Create typed WebSocket messages that auto-convert:

**File**: `frontend/src/services/websocketMessages.ts`

```typescript
import { toGrid, toPixel, GRID_SIZE } from '@/utils/coordinates';

// Send move request (converts pixel to grid)
export function sendMove(ws: WebSocketService, pixelX: number, pixelY: number) {
  const { gridX, gridY } = toGrid({ x: pixelX, y: pixelY });
  ws.send('move', { x: gridX, y: gridY });
}

// Send proximity position (converts pixel to grid)
export function sendProximityPosition(
  ws: WebSocketService, 
  pixelX: number, 
  pixelY: number,
  userId: string,
  isInVideoCall: boolean
) {
  const { gridX, gridY } = toGrid({ x: pixelX, y: pixelY });
  ws.send('proximity-position-update', {
    userId,
    position: { x: gridX, y: gridY, z: 0 },
    isInVideoCall
  });
}

// Handle received user position (converts grid to pixel)
export function parseUserPosition(payload: { x: number; y: number }) {
  const { pixelX, pixelY } = toPixel({ x: payload.x, y: payload.y });
  return { x: pixelX, y: pixelY };
}
```

---

## Files That Need Updates

### High Priority (Currently Buggy)

1. **`frontend/src/services/proximityVideoCall.ts`** - Line ~110
   - `updatePosition()` sends pixel as grid ❌
   - Fixed: Convert to grid before sending ✅

2. **`frontend/src/components/ProximityManager.tsx`**
   - May receive grid coordinates and use as pixel
   - Needs verification

### Medium Priority (Correct but Fragile)

3. **`frontend/src/app/space/[id]/page.tsx`**
   - `handleUserMove()` - correctly converts to grid
   - `user-moved` handler - correctly converts to pixel
   - Should use utility functions for consistency

4. **`frontend/src/services/websocket.ts`**
   - No conversion logic (raw passthrough)
   - Consider adding typed message handlers

---

## Testing

### Unit Tests

```typescript
import { toGrid, toPixel, GRID_SIZE } from '@/utils/coordinates';

describe('Coordinate Conversion', () => {
  it('should be reversible', () => {
    const original = { x: 60, y: 40 };
    const grid = toGrid(original);
    const pixel = toPixel({ x: grid.gridX, y: grid.gridY });
    
    expect(pixel.pixelX).toBe(original.x);
    expect(pixel.pixelY).toBe(original.y);
  });

  it('should round correctly', () => {
    // Just under a grid boundary
    expect(toGrid({ x: 19, y: 39 }).gridX).toBe(1);
    expect(toGrid({ x: 19, y: 39 }).gridY).toBe(2);
    
    // Exactly on boundary
    expect(toGrid({ x: 20, y: 40 }).gridX).toBe(1);
    expect(toGrid({ x: 20, y: 40 }).gridY).toBe(2);
    
    // Just over boundary
    expect(toGrid({ x: 21, y: 41 }).gridX).toBe(1);
    expect(toGrid({ x: 21, y: 41 }).gridY).toBe(2);
  });
});
```

### Integration Tests

```typescript
describe('End-to-end Coordinate Flow', () => {
  it('should maintain position through full message cycle', async () => {
    // 1. User clicks at pixel (60, 40)
    const clickPixel = { x: 60, y: 40 };
    
    // 2. Frontend converts to grid for backend
    const sentGrid = toGrid(clickPixel);
    expect(sentGrid).toEqual({ gridX: 3, gridY: 2 });
    
    // 3. Backend validates and broadcasts (simulated)
    const backendResponse = { x: 3, y: 2 };
    
    // 4. Frontend converts back to pixel
    const receivedPixel = toPixel(backendResponse);
    expect(receivedPixel).toEqual({ pixelX: 60, pixelY: 40 });
    
    // 5. Position should match original
    expect(receivedPixel.pixelX).toBe(clickPixel.x);
    expect(receivedPixel.pixelY).toBe(clickPixel.y);
  });
});
```

---

## Visual Reference

```
GRID COORDINATES (Backend)        PIXEL COORDINATES (Frontend)
┌───┬───┬───┬───┬───┐            ┌────────────────────────────┐
│0,0│1,0│2,0│3,0│4,0│            │0         100        200    │
├───┼───┼───┼───┼───┤            │  ┌──┐                      │
│0,1│1,1│2,1│3,1│4,1│     →      │  │  │ Avatar at (40,40)    │
├───┼───┼───┼───┼───┤            │40└──┘                      │
│0,2│1,2│2,2│3,2│4,2│            │                            │
└───┴───┴───┴───┴───┘            │80                          │
                                 └────────────────────────────┘

Grid (2,2) = Pixel (40, 40)
Grid (3,1) = Pixel (60, 20)
```

---

## Related Issues

- **Caused by this**: BUG-009 (teleporting), BUG-010 (rejection), BUG-014 (desync)
- **Solution applies to**: All movement and position-related features
- **Prevention**: TypeScript strict types, shared utility module

---

## Notes

- GRID_SIZE (20) is hardcoded in multiple places; should be a constant
- Consider using a Position class that encapsulates both systems
- Backend could optionally accept pixel coordinates and convert server-side
- Long-term: Consider switching entirely to grid coordinates in frontend state
