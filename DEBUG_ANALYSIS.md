# Movement Rejection Debug Analysis

## Issue: Movement gets rejected even for 1 step

### Root Cause Analysis

#### Backend Movement Validation (User.ts line 346-378)
```typescript
const maxGridX = Math.floor((space.width || 800) / 20) - 1;
const maxGridY = Math.floor((space.height || 600) / 20) - 1;

// For 800x600 space:
// maxGridX = floor(800/20) - 1 = 40 - 1 = 39
// maxGridY = floor(600/20) - 1 = 30 - 1 = 29
```

#### Frontend Movement (page.tsx line 211-218)
```typescript
const gridX = Math.round(clampedX / GRID_SIZE);
const gridY = Math.round(clampedY / GRID_SIZE);

// Frontend already clamps to pixel boundaries:
const maxPixelX = space.width - GRID_SIZE; // 800 - 20 = 780
const maxPixelY = space.height - GRID_SIZE; // 600 - 20 = 580

// If user moves to pixel 780:
// gridX = Math.round(780/20) = Math.round(39) = 39 ✅
```

### Identified Problems

1. **Avatar Visibility Issue - FIXED**
   - Backend sends `{x, y}` in `user-joined-space`
   - Frontend expects `{spawn: {x, y}}` at line 786
   - **Fix**: Added both formats to backend broadcast

2. **Potential Rounding Issue**
   - `Math.round()` can cause issues when position is at X.5
   - Example: pixel 790 → grid 39.5 → rounds to 40 → REJECTED (40 > 39)
   - **Fix**: Should use `Math.floor()` instead of `Math.round()`

3. **Space Dimension Mismatch**
   - Backend uses `space.width || 800` as fallback
   - If database has NULL width, backend uses 800
   - Frontend might have received a different width
   - **Check**: Database space dimensions

4. **Race Condition**
   - User sends move request
   - Position NOT updated locally (waits for server)
   - If rejected, restored to old position
   - But if another move happens before rejection, state is inconsistent
   - **Fix**: Add pending movement state

## Recommended Fixes

### Fix 1: Change Math.round to Math.floor in Frontend
Line 211-212 in page.tsx:
```typescript
// BEFORE:
const gridX = Math.round(clampedX / GRID_SIZE);
const gridY = Math.round(clampedY / GRID_SIZE);

// AFTER:
const gridX = Math.floor(clampedX / GRID_SIZE);
const gridY = Math.floor(clampedY / GRID_SIZE);
```

### Fix 2: Add Movement Debouncing
Prevent rapid-fire movements from causing race conditions

### Fix 3: Video Call Proximity Check
Ensure proximity detection uses consistent coordinate system
