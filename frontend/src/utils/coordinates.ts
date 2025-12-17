/**
 * Coordinate Utility Module
 * 
 * PURPOSE:
 * This module provides a centralized, type-safe way to convert between
 * grid coordinates (used by backend) and pixel coordinates (used by frontend).
 * 
 * COORDINATE SYSTEMS:
 * - Grid: Backend stores positions as grid units (0-39 for 800px width)
 * - Pixel: Frontend renders avatars in pixel positions (0-800)
 * 
 * CONVERSION:
 * - Grid to Pixel: gridX * GRID_SIZE = pixelX
 * - Pixel to Grid: Math.round(pixelX / GRID_SIZE) = gridX
 * 
 * BUG FIXES:
 * - BUG-009: Avatar teleporting (coordinate mismatch)
 * - BUG-010: Movement rejected (wrong coordinate validation)
 * - BUG-011: Coordinate system mismatch
 * - BUG-014: Position desync between users
 * 
 * @author GitHub Copilot
 * @see docs/bugs/movement/BUG-011-coordinate-system-mismatch.md
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Size of each grid cell in pixels
 * This is the fundamental unit for all coordinate conversions
 */
export const GRID_SIZE = 20;

/**
 * Proximity range for video calls in grid units
 * Two tiles = Manhattan distance of 2 = users within 2 tiles will auto-call
 */
export const PROXIMITY_RANGE_TILES = 2;

/**
 * Proximity range in pixels (for backwards compatibility)
 */
export const PROXIMITY_RANGE_PIXELS = PROXIMITY_RANGE_TILES * GRID_SIZE;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Position in grid coordinates (used by backend)
 */
export interface GridPosition {
  /** X coordinate in grid units (0 to maxGridX) */
  gridX: number;
  /** Y coordinate in grid units (0 to maxGridY) */
  gridY: number;
}

/**
 * Position in pixel coordinates (used by frontend rendering)
 */
export interface PixelPosition {
  /** X coordinate in pixels (0 to spaceWidth) */
  pixelX: number;
  /** Y coordinate in pixels (0 to spaceHeight) */
  pixelY: number;
}

/**
 * Generic position interface (for API compatibility)
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 3D position interface (for video call proximity)
 */
export interface Position3D extends Position {
  z: number;
}

// =============================================================================
// CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert pixel coordinates to grid coordinates
 * 
 * USE WHEN: Sending position data TO backend
 * 
 * @param pixel - Position in pixels
 * @returns Position in grid units
 * 
 * @example
 * ```typescript
 * const pixelPos = { x: 60, y: 40 };
 * const gridPos = toGrid(pixelPos);
 * // gridPos = { gridX: 3, gridY: 2 }
 * websocket.send('move', { x: gridPos.gridX, y: gridPos.gridY });
 * ```
 */
export function toGrid(pixel: Position): GridPosition {
  return {
    gridX: Math.round(pixel.x / GRID_SIZE),
    gridY: Math.round(pixel.y / GRID_SIZE),
  };
}

/**
 * Convert grid coordinates to pixel coordinates
 * 
 * USE WHEN: Receiving position data FROM backend
 * 
 * @param grid - Position in grid units
 * @returns Position in pixels
 * 
 * @example
 * ```typescript
 * // Server sends: { x: 3, y: 2 }
 * const gridPos = { x: 3, y: 2 };
 * const pixelPos = toPixel(gridPos);
 * // pixelPos = { pixelX: 60, pixelY: 40 }
 * avatar.style.left = pixelPos.pixelX + 'px';
 * ```
 */
export function toPixel(grid: Position): PixelPosition {
  return {
    pixelX: grid.x * GRID_SIZE,
    pixelY: grid.y * GRID_SIZE,
  };
}

/**
 * Convert pixel position to grid position (returns Position interface)
 * Convenience function that returns the same shape as input
 * 
 * @param pixel - Position in pixels
 * @returns Position in grid units with x, y properties
 */
export function pixelToGrid(pixel: Position): Position {
  return {
    x: Math.round(pixel.x / GRID_SIZE),
    y: Math.round(pixel.y / GRID_SIZE),
  };
}

/**
 * Convert grid position to pixel position (returns Position interface)
 * Convenience function that returns the same shape as input
 * 
 * @param grid - Position in grid units
 * @returns Position in pixels with x, y properties
 */
export function gridToPixel(grid: Position): Position {
  return {
    x: grid.x * GRID_SIZE,
    y: grid.y * GRID_SIZE,
  };
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a grid position is within space bounds
 * 
 * @param grid - Position in grid units
 * @param spaceWidth - Space width in pixels
 * @param spaceHeight - Space height in pixels
 * @returns true if position is valid
 */
export function isValidGridPosition(
  grid: GridPosition,
  spaceWidth: number,
  spaceHeight: number
): boolean {
  const maxGridX = Math.floor(spaceWidth / GRID_SIZE) - 1;
  const maxGridY = Math.floor(spaceHeight / GRID_SIZE) - 1;

  return (
    grid.gridX >= 0 &&
    grid.gridX <= maxGridX &&
    grid.gridY >= 0 &&
    grid.gridY <= maxGridY
  );
}

/**
 * Check if a pixel position is within space bounds
 * 
 * @param pixel - Position in pixels
 * @param spaceWidth - Space width in pixels
 * @param spaceHeight - Space height in pixels
 * @returns true if position is valid
 */
export function isValidPixelPosition(
  pixel: PixelPosition,
  spaceWidth: number,
  spaceHeight: number
): boolean {
  return (
    pixel.pixelX >= GRID_SIZE &&
    pixel.pixelX <= spaceWidth - GRID_SIZE &&
    pixel.pixelY >= GRID_SIZE &&
    pixel.pixelY <= spaceHeight - GRID_SIZE
  );
}

// =============================================================================
// CLAMPING FUNCTIONS
// =============================================================================

/**
 * Clamp a pixel position to valid space bounds
 * Ensures avatar stays within the space boundaries
 * 
 * @param pixel - Position in pixels (may be out of bounds)
 * @param spaceWidth - Space width in pixels
 * @param spaceHeight - Space height in pixels
 * @returns Clamped position guaranteed to be in bounds
 */
export function clampPixelPosition(
  pixel: Position,
  spaceWidth: number,
  spaceHeight: number
): PixelPosition {
  return {
    pixelX: Math.max(GRID_SIZE, Math.min(spaceWidth - GRID_SIZE, pixel.x)),
    pixelY: Math.max(GRID_SIZE, Math.min(spaceHeight - GRID_SIZE, pixel.y)),
  };
}

/**
 * Clamp a grid position to valid space bounds
 * 
 * @param grid - Position in grid units (may be out of bounds)
 * @param spaceWidth - Space width in pixels
 * @param spaceHeight - Space height in pixels
 * @returns Clamped position guaranteed to be in bounds
 */
export function clampGridPosition(
  grid: Position,
  spaceWidth: number,
  spaceHeight: number
): GridPosition {
  const maxGridX = Math.floor(spaceWidth / GRID_SIZE) - 1;
  const maxGridY = Math.floor(spaceHeight / GRID_SIZE) - 1;

  return {
    gridX: Math.max(0, Math.min(maxGridX, grid.x)),
    gridY: Math.max(0, Math.min(maxGridY, grid.y)),
  };
}

// =============================================================================
// DISTANCE FUNCTIONS
// =============================================================================

/**
 * Calculate Manhattan distance between two grid positions
 * Used for proximity video call triggering (should be <= 2 for video call)
 * 
 * @param a - First position in grid units
 * @param b - Second position in grid units
 * @returns Manhattan distance (|dx| + |dy|)
 * 
 * @example
 * ```typescript
 * const user1 = { gridX: 5, gridY: 5 };
 * const user2 = { gridX: 6, gridY: 6 };
 * const dist = gridManhattanDistance(user1, user2);
 * // dist = 2 (within proximity range)
 * ```
 */
export function gridManhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY);
}

/**
 * Alias for gridManhattanDistance for backwards compatibility
 * @see gridManhattanDistance
 */
export const gridDistance = gridManhattanDistance;

/**
 * Calculate Manhattan distance between two pixel positions
 * Converts to grid first for consistent distance calculation
 * 
 * @param a - First position in pixels
 * @param b - Second position in pixels
 * @returns Manhattan distance in grid units
 */
export function pixelManhattanDistance(a: Position, b: Position): number {
  const gridA = toGrid(a);
  const gridB = toGrid(b);
  return gridManhattanDistance(gridA, gridB);
}

/**
 * Calculate Euclidean distance between two positions
 * 
 * @param a - First position
 * @param b - Second position
 * @returns Euclidean distance
 */
export function euclideanDistance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two positions are within proximity range (2 tiles)
 * 
 * @param a - First position in pixels
 * @param b - Second position in pixels
 * @returns true if within video call proximity range
 */
export function isInProximityRange(a: Position, b: Position): boolean {
  return pixelManhattanDistance(a, b) <= PROXIMITY_RANGE_TILES;
}

/**
 * Check if two positions are within a specified range in tiles
 * More flexible version that accepts a custom range
 * 
 * @param a - First position in pixels
 * @param b - Second position in pixels
 * @param rangeTiles - Range in tiles (default: PROXIMITY_RANGE_TILES)
 * @returns true if within specified range
 */
export function isWithinProximity(a: Position, b: Position, rangeTiles: number = PROXIMITY_RANGE_TILES): boolean {
  return pixelManhattanDistance(a, b) <= rangeTiles;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get max valid grid coordinates for a space
 * 
 * @param spaceWidth - Space width in pixels
 * @param spaceHeight - Space height in pixels
 * @returns Object with maxGridX and maxGridY
 */
export function getMaxGridCoordinates(
  spaceWidth: number,
  spaceHeight: number
): { maxGridX: number; maxGridY: number } {
  return {
    maxGridX: Math.floor(spaceWidth / GRID_SIZE) - 1,
    maxGridY: Math.floor(spaceHeight / GRID_SIZE) - 1,
  };
}

/**
 * Snap a pixel position to the nearest grid position
 * Useful for aligning avatars to grid
 * 
 * @param pixel - Position in pixels
 * @returns Position snapped to nearest grid intersection
 */
export function snapToGrid(pixel: Position): Position {
  return {
    x: Math.round(pixel.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(pixel.y / GRID_SIZE) * GRID_SIZE,
  };
}

/**
 * Calculate movement delta in grid units
 * Used to validate movement is not too large (teleport prevention)
 * 
 * @param from - Starting position in grid units
 * @param to - Target position in grid units
 * @returns Object with dx, dy, and total Manhattan distance
 */
export function calculateMovementDelta(
  from: Position,
  to: Position
): { dx: number; dy: number; distance: number } {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return {
    dx,
    dy,
    distance: dx + dy,
  };
}

// =============================================================================
// DEBUG HELPERS
// =============================================================================

/**
 * Format position for debug logging
 * 
 * @param pixel - Position in pixels
 * @returns Formatted string with both pixel and grid coordinates
 */
export function formatPosition(pixel: Position): string {
  const grid = toGrid(pixel);
  return `Pixel(${pixel.x}, ${pixel.y}) → Grid(${grid.gridX}, ${grid.gridY})`;
}

/**
 * Log coordinate conversion for debugging
 * 
 * @param label - Debug label
 * @param pixel - Position in pixels
 */
export function debugLogPosition(label: string, pixel: Position): void {
  const grid = toGrid(pixel);
  console.log(`📍 [${label}] ${formatPosition(pixel)}`);
}
