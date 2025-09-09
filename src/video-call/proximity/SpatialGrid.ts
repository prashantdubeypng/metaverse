import { Position3D, UserPosition, PROXIMITY_RANGE } from '../../types/video-call.js';
import { calculateDistance, isValidPosition3D, isValidUserPosition } from '../../utils/validation.js';

/**
 * 3D Spatial Hash Grid for efficient proximity queries
 * Optimized for fixed 10-unit proximity range
 */
export class SpatialGrid {
  private grid: Map<string, Set<string>> = new Map();
  private userPositions: Map<string, UserPosition> = new Map();
  private readonly cellSize: number;

  constructor(cellSize: number = PROXIMITY_RANGE) {
    this.cellSize = cellSize;
  }

  /**
   * Generate cell key for a 3D position
   */
  private getCellKey(position: Position3D): string {
    const x = Math.floor(position.x / this.cellSize);
    const y = Math.floor(position.y / this.cellSize);
    const z = Math.floor(position.z / this.cellSize);
    return `${x},${y},${z}`;
  }

  /**
   * Get all neighboring cells within proximity range
   */
  private getNeighboringCells(position: Position3D, range: number): string[] {
    const cells: string[] = [];
    const cellRadius = Math.ceil(range / this.cellSize);
    
    const centerX = Math.floor(position.x / this.cellSize);
    const centerY = Math.floor(position.y / this.cellSize);
    const centerZ = Math.floor(position.z / this.cellSize);

    for (let x = centerX - cellRadius; x <= centerX + cellRadius; x++) {
      for (let y = centerY - cellRadius; y <= centerY + cellRadius; y++) {
        for (let z = centerZ - cellRadius; z <= centerZ + cellRadius; z++) {
          cells.push(`${x},${y},${z}`);
        }
      }
    }

    return cells;
  }

  /**
   * Add or update user position in the spatial grid
   */
  updateUserPosition(userPosition: UserPosition): void {
    if (!isValidUserPosition(userPosition)) {
      throw new Error('Invalid user position data');
    }

    const userId = userPosition.userId;
    const newCellKey = this.getCellKey(userPosition.position);

    // Remove user from old cell if exists
    const oldUserPosition = this.userPositions.get(userId);
    if (oldUserPosition) {
      const oldCellKey = this.getCellKey(oldUserPosition.position);
      if (oldCellKey !== newCellKey) {
        const oldCell = this.grid.get(oldCellKey);
        if (oldCell) {
          oldCell.delete(userId);
          if (oldCell.size === 0) {
            this.grid.delete(oldCellKey);
          }
        }
      }
    }

    // Add user to new cell
    if (!this.grid.has(newCellKey)) {
      this.grid.set(newCellKey, new Set());
    }
    this.grid.get(newCellKey)!.add(userId);

    // Update user position cache
    this.userPositions.set(userId, { ...userPosition });
  }

  /**
   * Remove user from the spatial grid
   */
  removeUser(userId: string): void {
    const userPosition = this.userPositions.get(userId);
    if (!userPosition) {
      return;
    }

    const cellKey = this.getCellKey(userPosition.position);
    const cell = this.grid.get(cellKey);
    if (cell) {
      cell.delete(userId);
      if (cell.size === 0) {
        this.grid.delete(cellKey);
      }
    }

    this.userPositions.delete(userId);
  }

  /**
   * Find all users within proximity range of a given user
   * Excludes the user themselves and applies availability filters
   */
  findNearbyUsers(userId: string, range: number = PROXIMITY_RANGE): UserPosition[] {
    const userPosition = this.userPositions.get(userId);
    if (!userPosition) {
      return [];
    }

    const nearbyUsers: UserPosition[] = [];
    const cellsToCheck = this.getNeighboringCells(userPosition.position, range);

    for (const cellKey of cellsToCheck) {
      const usersInCell = this.grid.get(cellKey);
      if (!usersInCell) continue;

      for (const otherUserId of usersInCell) {
        if (otherUserId === userId) continue;

        const otherUserPosition = this.userPositions.get(otherUserId);
        if (!otherUserPosition || !otherUserPosition.isAvailable) continue;

        // Check actual distance
        const distance = calculateDistance(userPosition.position, otherUserPosition.position);
        if (distance <= range) {
          nearbyUsers.push(otherUserPosition);
        }
      }
    }

    return nearbyUsers;
  }

  /**
   * Get user position by ID
   */
  getUserPosition(userId: string): UserPosition | undefined {
    return this.userPositions.get(userId);
  }

  /**
   * Get all users in the grid
   */
  getAllUsers(): UserPosition[] {
    return Array.from(this.userPositions.values());
  }

  /**
   * Get grid statistics for debugging/monitoring
   */
  getStats(): {
    totalUsers: number;
    totalCells: number;
    averageUsersPerCell: number;
    maxUsersInCell: number;
  } {
    const totalUsers = this.userPositions.size;
    const totalCells = this.grid.size;
    
    let maxUsersInCell = 0;
    let totalUsersInCells = 0;

    for (const cell of this.grid.values()) {
      const cellSize = cell.size;
      maxUsersInCell = Math.max(maxUsersInCell, cellSize);
      totalUsersInCells += cellSize;
    }

    return {
      totalUsers,
      totalCells,
      averageUsersPerCell: totalCells > 0 ? totalUsersInCells / totalCells : 0,
      maxUsersInCell
    };
  }

  /**
   * Clear all data from the grid
   */
  clear(): void {
    this.grid.clear();
    this.userPositions.clear();
  }
}