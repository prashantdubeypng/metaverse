import { SpatialGrid } from '../SpatialGrid.js';
import { UserPosition, Position3D } from '../../../types/video-call.js';

describe('SpatialGrid', () => {
  let spatialGrid: SpatialGrid;

  beforeEach(() => {
    spatialGrid = new SpatialGrid(10); // 10-unit cell size
  });

  const createUserPosition = (
    userId: string,
    x: number,
    y: number,
    z: number,
    isAvailable: boolean = true
  ): UserPosition => ({
    userId,
    position: { x, y, z, timestamp: Date.now() },
    isAvailable,
    proximityRange: 10
  });

  describe('updateUserPosition', () => {
    it('should add user to correct spatial cell', () => {
      const user = createUserPosition('user1', 5, 5, 5);
      spatialGrid.updateUserPosition(user);

      const retrievedUser = spatialGrid.getUserPosition('user1');
      expect(retrievedUser).toEqual(user);
    });

    it('should move user between cells when position changes', () => {
      const user1 = createUserPosition('user1', 5, 5, 5);
      spatialGrid.updateUserPosition(user1);

      // Move user to different cell
      const user1Moved = createUserPosition('user1', 25, 25, 25);
      spatialGrid.updateUserPosition(user1Moved);

      const retrievedUser = spatialGrid.getUserPosition('user1');
      expect(retrievedUser?.position).toEqual(user1Moved.position);
    });

    it('should throw error for invalid user position', () => {
      const invalidUser = {
        userId: '',
        position: { x: NaN, y: 5, z: 5, timestamp: Date.now() },
        isAvailable: true,
        proximityRange: 10
      };

      expect(() => spatialGrid.updateUserPosition(invalidUser as UserPosition)).toThrow();
    });
  });

  describe('findNearbyUsers', () => {
    it('should find users within 10-unit range', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      const user2 = createUserPosition('user2', 5, 0, 0); // 5 units away
      const user3 = createUserPosition('user3', 15, 0, 0); // 15 units away

      spatialGrid.updateUserPosition(user1);
      spatialGrid.updateUserPosition(user2);
      spatialGrid.updateUserPosition(user3);

      const nearbyUsers = spatialGrid.findNearbyUsers('user1', 10);
      
      expect(nearbyUsers).toHaveLength(1);
      expect(nearbyUsers[0].userId).toBe('user2');
    });

    it('should not include unavailable users', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      const user2 = createUserPosition('user2', 5, 0, 0, false); // unavailable

      spatialGrid.updateUserPosition(user1);
      spatialGrid.updateUserPosition(user2);

      const nearbyUsers = spatialGrid.findNearbyUsers('user1', 10);
      expect(nearbyUsers).toHaveLength(0);
    });

    it('should not include the user themselves', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      spatialGrid.updateUserPosition(user1);

      const nearbyUsers = spatialGrid.findNearbyUsers('user1', 10);
      expect(nearbyUsers).toHaveLength(0);
    });

    it('should handle 3D proximity correctly', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      const user2 = createUserPosition('user2', 3, 4, 0); // 5 units away (3-4-5 triangle)
      const user3 = createUserPosition('user3', 6, 8, 0); // 10 units away

      spatialGrid.updateUserPosition(user1);
      spatialGrid.updateUserPosition(user2);
      spatialGrid.updateUserPosition(user3);

      const nearbyUsers = spatialGrid.findNearbyUsers('user1', 10);
      
      expect(nearbyUsers).toHaveLength(2);
      expect(nearbyUsers.map(u => u.userId).sort()).toEqual(['user2', 'user3']);
    });

    it('should return empty array for non-existent user', () => {
      const nearbyUsers = spatialGrid.findNearbyUsers('nonexistent', 10);
      expect(nearbyUsers).toHaveLength(0);
    });
  });

  describe('removeUser', () => {
    it('should remove user from grid', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      spatialGrid.updateUserPosition(user1);

      expect(spatialGrid.getUserPosition('user1')).toBeDefined();

      spatialGrid.removeUser('user1');
      expect(spatialGrid.getUserPosition('user1')).toBeUndefined();
    });

    it('should handle removing non-existent user gracefully', () => {
      expect(() => spatialGrid.removeUser('nonexistent')).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      const user2 = createUserPosition('user2', 5, 5, 5);
      const user3 = createUserPosition('user3', 15, 15, 15);

      spatialGrid.updateUserPosition(user1);
      spatialGrid.updateUserPosition(user2);
      spatialGrid.updateUserPosition(user3);

      const stats = spatialGrid.getStats();
      
      expect(stats.totalUsers).toBe(3);
      expect(stats.totalCells).toBeGreaterThan(0);
      expect(stats.maxUsersInCell).toBeGreaterThanOrEqual(1);
    });

    it('should return zero stats for empty grid', () => {
      const stats = spatialGrid.getStats();
      
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalCells).toBe(0);
      expect(stats.averageUsersPerCell).toBe(0);
      expect(stats.maxUsersInCell).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all data from grid', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      spatialGrid.updateUserPosition(user1);

      expect(spatialGrid.getAllUsers()).toHaveLength(1);

      spatialGrid.clear();
      expect(spatialGrid.getAllUsers()).toHaveLength(0);
      expect(spatialGrid.getStats().totalUsers).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle users at exact 10-unit boundary', () => {
      const user1 = createUserPosition('user1', 0, 0, 0);
      const user2 = createUserPosition('user2', 10, 0, 0); // exactly 10 units away

      spatialGrid.updateUserPosition(user1);
      spatialGrid.updateUserPosition(user2);

      const nearbyUsers = spatialGrid.findNearbyUsers('user1', 10);
      expect(nearbyUsers).toHaveLength(1);
      expect(nearbyUsers[0].userId).toBe('user2');
    });

    it('should handle negative coordinates', () => {
      const user1 = createUserPosition('user1', -5, -5, -5);
      const user2 = createUserPosition('user2', 0, 0, 0);

      spatialGrid.updateUserPosition(user1);
      spatialGrid.updateUserPosition(user2);

      const nearbyUsers = spatialGrid.findNearbyUsers('user1', 10);
      expect(nearbyUsers).toHaveLength(1);
      expect(nearbyUsers[0].userId).toBe('user2');
    });

    it('should handle large coordinate values', () => {
      const user1 = createUserPosition('user1', 1000000, 1000000, 1000000);
      const user2 = createUserPosition('user2', 1000005, 1000000, 1000000);

      spatialGrid.updateUserPosition(user1);
      spatialGrid.updateUserPosition(user2);

      const nearbyUsers = spatialGrid.findNearbyUsers('user1', 10);
      expect(nearbyUsers).toHaveLength(1);
      expect(nearbyUsers[0].userId).toBe('user2');
    });
  });
});