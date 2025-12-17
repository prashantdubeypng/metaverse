/**
 * Memory Manager Service
 * =====================
 * BUG-027 FIX: Memory Leak on Long Sessions
 * 
 * Problem: Long sessions (1-2 hours) cause memory to grow from ~150MB to 500MB+
 * due to accumulated data, event listeners, and unreleased resources.
 * 
 * Solution: Periodic cleanup service that:
 * - Monitors memory usage
 * - Reports memory stats in development
 * - Provides hooks for cleanup callbacks
 * - Warns when memory usage is high
 * 
 * Usage:
 *   import { memoryManager } from '@/services/memoryManager';
 *   
 *   // Start monitoring (call once in app)
 *   memoryManager.start();
 *   
 *   // Register cleanup callback
 *   memoryManager.registerCleanup('chatMessages', () => cleanOldMessages());
 *   
 *   // Stop when app closes
 *   memoryManager.stop();
 * 
 * @module services/memoryManager
 */

import { debugLog, debugWarn, debugTable, isDevMode } from '@/utils/logger';

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface CleanupCallback {
  name: string;
  callback: () => void;
  priority: number; // Lower = higher priority
}

interface MemoryStats {
  usedMB: number;
  totalMB: number;
  limitMB: number;
  usagePercent: number;
  timestamp: number;
}

class MemoryManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupCallbacks: CleanupCallback[] = [];
  private memoryHistory: MemoryStats[] = [];
  private isMonitoring = false;
  
  // Configuration
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly WARNING_THRESHOLD = 0.7; // 70% of limit
  private readonly CRITICAL_THRESHOLD = 0.85; // 85% of limit
  private readonly HISTORY_MAX_SIZE = 60; // Keep 1 hour of history (5min intervals)

  /**
   * Start the memory monitoring and periodic cleanup
   */
  start(): void {
    if (this.isMonitoring) {
      debugWarn('🧹 Memory manager already running');
      return;
    }

    debugLog('🧹 Starting memory manager');
    this.isMonitoring = true;

    // Initial stats
    this.recordMemoryStats();

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    // Listen for visibility change to optimize
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /**
   * Stop the memory monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    debugLog('🧹 Stopping memory manager');
    this.isMonitoring = false;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Run final cleanup
    this.performCleanup();
    this.cleanupCallbacks = [];
    this.memoryHistory = [];
  }

  /**
   * Register a cleanup callback
   * @param name Unique name for the cleanup task
   * @param callback Function to run during cleanup
   * @param priority Lower = runs first (default: 10)
   */
  registerCleanup(name: string, callback: () => void, priority = 10): void {
    // Check for duplicate
    const existing = this.cleanupCallbacks.findIndex(c => c.name === name);
    if (existing !== -1) {
      this.cleanupCallbacks[existing] = { name, callback, priority };
      debugLog(`🧹 Updated cleanup callback: ${name}`);
    } else {
      this.cleanupCallbacks.push({ name, callback, priority });
      debugLog(`🧹 Registered cleanup callback: ${name}`);
    }

    // Sort by priority
    this.cleanupCallbacks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Unregister a cleanup callback
   */
  unregisterCleanup(name: string): void {
    const index = this.cleanupCallbacks.findIndex(c => c.name === name);
    if (index !== -1) {
      this.cleanupCallbacks.splice(index, 1);
      debugLog(`🧹 Unregistered cleanup callback: ${name}`);
    }
  }

  /**
   * Perform cleanup operations
   */
  performCleanup(): void {
    debugLog('🧹 Running periodic memory cleanup');

    const beforeStats = this.getMemoryStats();
    
    // Run all cleanup callbacks
    for (const { name, callback } of this.cleanupCallbacks) {
      try {
        callback();
        debugLog(`🧹 Completed cleanup: ${name}`);
      } catch (error) {
        debugWarn(`🧹 Cleanup failed: ${name}`, error);
      }
    }

    const afterStats = this.getMemoryStats();

    // Record stats
    this.recordMemoryStats();

    // Log results in development
    if (isDevMode && beforeStats && afterStats) {
      const freedMB = beforeStats.usedMB - afterStats.usedMB;
      debugLog(`🧹 Cleanup freed: ${freedMB.toFixed(2)} MB`);
      this.logMemoryStats(afterStats);
    }

    // Check memory levels
    this.checkMemoryLevels();
  }

  /**
   * Force garbage collection hint (if available)
   * Note: This only works if browser was started with --expose-gc flag
   */
  requestGC(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      debugLog('🧹 Requesting garbage collection');
      try {
        (window as unknown as { gc: () => void }).gc();
      } catch {
        // GC not available
      }
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats | null {
    if (typeof performance === 'undefined' || !('memory' in performance)) {
      return null;
    }

    const memory = (performance as unknown as { memory: MemoryInfo }).memory;
    return {
      usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
      totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
      limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100,
      usagePercent: Math.round(memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100) / 100,
      timestamp: Date.now()
    };
  }

  /**
   * Get memory usage trend over time
   */
  getMemoryTrend(): { growing: boolean; ratePerHour: number } | null {
    if (this.memoryHistory.length < 2) return null;

    const first = this.memoryHistory[0];
    const last = this.memoryHistory[this.memoryHistory.length - 1];

    const durationHours = (last.timestamp - first.timestamp) / (1000 * 60 * 60);
    if (durationHours < 0.1) return null; // Need at least 6 minutes of data

    const memoryDiff = last.usedMB - first.usedMB;
    const ratePerHour = memoryDiff / durationHours;

    return {
      growing: ratePerHour > 10, // Growing more than 10MB/hour is concerning
      ratePerHour: Math.round(ratePerHour * 100) / 100
    };
  }

  /**
   * Get all registered cleanup names
   */
  getRegisteredCleanups(): string[] {
    return this.cleanupCallbacks.map(c => c.name);
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  // --- Private Methods ---

  private recordMemoryStats(): void {
    const stats = this.getMemoryStats();
    if (stats) {
      this.memoryHistory.push(stats);

      // Trim history to max size
      if (this.memoryHistory.length > this.HISTORY_MAX_SIZE) {
        this.memoryHistory.shift();
      }
    }
  }

  private logMemoryStats(stats: MemoryStats): void {
    debugLog(`📊 Memory: ${stats.usedMB}MB / ${stats.limitMB}MB (${(stats.usagePercent * 100).toFixed(1)}%)`);
  }

  private checkMemoryLevels(): void {
    const stats = this.getMemoryStats();
    if (!stats) return;

    if (stats.usagePercent >= this.CRITICAL_THRESHOLD) {
      debugWarn(`🚨 CRITICAL: Memory usage at ${(stats.usagePercent * 100).toFixed(1)}%! Force cleanup...`);
      
      // Force aggressive cleanup
      this.requestGC();
      
      // Dispatch event for app to handle
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('memory-critical', { 
          detail: { usagePercent: stats.usagePercent } 
        }));
      }
    } else if (stats.usagePercent >= this.WARNING_THRESHOLD) {
      debugWarn(`⚠️ WARNING: Memory usage at ${(stats.usagePercent * 100).toFixed(1)}%`);
    }

    // Check trend
    const trend = this.getMemoryTrend();
    if (trend && trend.growing) {
      debugWarn(`📈 Memory growing at ${trend.ratePerHour}MB/hour`);
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // Tab is hidden - run cleanup to reduce memory
      debugLog('🧹 Tab hidden - running memory cleanup');
      this.performCleanup();
    }
  };
}

// Singleton instance
export const memoryManager = new MemoryManager();

/**
 * React hook for memory monitoring
 * Automatically starts/stops memory manager with component lifecycle
 */
export const useMemoryManager = (
  cleanupCallbacks?: Array<{ name: string; callback: () => void; priority?: number }>
): void => {
  // This should be used with React's useEffect
  // The actual implementation will be in a separate hook file
};

// Export types
export type { MemoryStats, CleanupCallback };
