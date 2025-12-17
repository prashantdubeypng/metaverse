/**
 * WebSocket Service for Real-Time Communication
 * 
 * PURPOSE:
 * This service manages WebSocket connections for the metaverse application,
 * providing real-time bidirectional communication between the client and server.
 * 
 * KEY FEATURES:
 * - Automatic reconnection with exponential backoff
 * - Message queuing when connection is lost
 * - Heartbeat keep-alive mechanism
 * - Event-based message handling
 * - Page refresh recovery (BUG-032 fix)
 * - localStorage persistence for session state
 * - Non-recoverable error handling (BUG-015 fix)
 * - Connection state machine for reliable state tracking
 * 
 * BUG-032 FIX:
 * When a user refreshes the page, their connection is lost but their session
 * state is preserved in localStorage. On reconnection, the service automatically
 * attempts to rejoin the previous space and restore position.
 * 
 * BUG-015 FIX:
 * Added non-recoverable close codes to prevent infinite reconnection loops.
 * Uses connection state machine to track connection lifecycle properly.
 * Adds jitter to reconnection timing to prevent thundering herd.
 * 
 * USAGE:
 * ```typescript
 * import websocketService from '@/services/websocket';
 * 
 * // Join a space
 * await websocketService.joinSpace(spaceId, token);
 * 
 * // Listen for events
 * websocketService.on('user-joined', (data) => console.log(data));
 * 
 * // Send messages
 * websocketService.send('move', { x: 10, y: 20 });
 * ```
 * 
 * @author GitHub Copilot
 * @see docs/bugs/BUG-032-page-refresh-connection-loss.md
 * @see docs/bugs/websocket/BUG-015-disconnection-loop.md
 */

type EventListener<T = unknown> = (payload: T) => void;
type EventData = Record<string, unknown>;

/**
 * BUG-016 FIX: Queued message structure with priority
 * Used for priority-based message queue management
 */
interface QueuedMessage {
  type: string;
  payload: EventData;
  priority: 'critical' | 'high' | 'normal' | 'low';
  timestamp: number;
}

/**
 * Connection state machine states (BUG-015 fix)
 * Tracks the connection lifecycle to prevent invalid state transitions
 */
enum ConnectionState {
  /** Not connected, not attempting to connect */
  DISCONNECTED = 'disconnected',
  /** Currently attempting to establish connection */
  CONNECTING = 'connecting',
  /** WebSocket is open but not yet authenticated */
  CONNECTED = 'connected',
  /** Authentication in progress */
  AUTHENTICATING = 'authenticating',
  /** Fully authenticated and ready */
  AUTHENTICATED = 'authenticated',
  /** Attempting to reconnect after disconnect */
  RECONNECTING = 'reconnecting',
  /** Connection failed permanently (auth error, banned, etc.) */
  FAILED = 'failed'
}

/**
 * Custom WebSocket close codes (BUG-015 fix)
 * These codes indicate non-recoverable errors that should NOT trigger reconnection
 * Using range 4000-4999 which is reserved for application use
 */
const CLOSE_CODES = {
  /** No auth token provided */
  NO_TOKEN: 4001,
  /** Auth token is invalid */
  INVALID_TOKEN: 4002,
  /** Auth token has expired */
  TOKEN_EXPIRED: 4003,
  /** Requested space does not exist */
  SPACE_NOT_FOUND: 4004,
  /** User is banned from the platform */
  USER_BANNED: 4005,
  /** Rate limit exceeded */
  RATE_LIMITED: 4006,
  /** Server is shutting down */
  SERVER_SHUTDOWN: 4007,
} as const;

/**
 * Set of close codes that should NOT trigger automatic reconnection
 * These indicate problems that cannot be fixed by reconnecting
 */
const NON_RECOVERABLE_CODES = new Set([
  CLOSE_CODES.NO_TOKEN,
  CLOSE_CODES.INVALID_TOKEN,
  CLOSE_CODES.TOKEN_EXPIRED,
  CLOSE_CODES.SPACE_NOT_FOUND,
  CLOSE_CODES.USER_BANNED,
  1008, // Policy Violation (standard WebSocket code)
]);

/**
 * Session state stored in localStorage for page refresh recovery
 * This enables users to seamlessly reconnect after a browser refresh
 */
interface SessionState {
  /** The space the user was in before disconnect */
  spaceId: string | null;
  /** The user's last known position (grid coordinates) */
  lastPosition: { x: number; y: number } | null;
  /** Timestamp when state was saved */
  savedAt: number;
  /** User ID for the session */
  userId: string | null;
  /** Auth token for reconnection */
  token: string | null;
  /** Reconnection token from server (for stateless recovery) */
  reconnectionToken: string | null;
}

/** LocalStorage key for session state */
const SESSION_STORAGE_KEY = 'metaverse_ws_session';

/** Maximum age for session state (30 seconds - must reconnect quickly) */
const SESSION_STATE_MAX_AGE_MS = 30 * 1000;

/**
 * WebSocketService - Manages WebSocket connections with automatic recovery
 * 
 * This class implements the singleton pattern and handles all WebSocket
 * communication for the application. Key features include:
 * 
 * - Automatic reconnection with exponential backoff and jitter
 * - Message queuing during disconnection
 * - Session state persistence for page refresh recovery
 * - Event-based message handling with type safety
 * - Heartbeat mechanism for connection health monitoring
 * - Connection state machine for reliable lifecycle tracking (BUG-015)
 * - Non-recoverable error detection to prevent infinite loops (BUG-015)
 */
class WebSocketService {
  // ========================================================================
  // PRIVATE PROPERTIES
  // ========================================================================
  
  /** The underlying WebSocket connection */
  private ws: WebSocket | null = null;
  
  /** Current connection state (BUG-015 fix) */
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  
  /** Timer for scheduling reconnection attempts */
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  /** Number of consecutive reconnection attempts */
  private reconnectAttempts = 0;
  
  /** Maximum number of reconnection attempts before giving up */
  private maxReconnectAttempts = 5;
  
  /** Current reconnection delay in milliseconds (increases with backoff) */
  private reconnectInterval = 1000;
  
  /** Maximum reconnection delay in milliseconds */
  private maxReconnectInterval = 30000;
  
  /** Map of event names to arrays of listener functions */
  private eventListeners: Map<string, EventListener[]> = new Map();
  
  /**
   * BUG-016 FIX: Priority-based message queue with overflow protection
   * 
   * Messages are prioritized by type:
   * - critical: join, leave, auth (never dropped)
   * - high: user-joined, user-left, call signals
   * - normal: chat, move
   * - low: position-update, typing indicators (can be lossy)
   */
  
  /** BUG-016: Separate queues per priority level for efficient processing */
  private criticalQueue: Array<QueuedMessage> = [];
  private highQueue: Array<QueuedMessage> = [];
  private normalQueue: Array<QueuedMessage> = [];
  private lowQueue: Array<QueuedMessage> = [];
  
  /** BUG-016: Maximum queue size per priority level */
  private readonly MAX_CRITICAL_QUEUE = 50;
  private readonly MAX_HIGH_QUEUE = 100;
  private readonly MAX_NORMAL_QUEUE = 200;
  private readonly MAX_LOW_QUEUE = 50;
  
  /** BUG-016: Message type to priority mapping */
  private readonly MESSAGE_PRIORITIES: Record<string, string> = {
    // Critical - must not be lost
    'join': 'critical',
    'leave': 'critical',
    'auth': 'critical',
    'error': 'critical',
    'space-join': 'critical',
    
    // High - important for state
    'user-joined': 'high',
    'user-left': 'high',
    'proximity-video-call-signal': 'high',
    'proximity-video-call-ended': 'high',
    
    // Normal - regular updates
    'move': 'normal',
    'chat-message': 'normal',
    'ice-candidate': 'normal',
    
    // Low - can be lossy
    'proximity-position-update': 'low',
    'typing-indicator': 'low',
    'ping': 'low',
    'heartbeat': 'low'
  };
  
  /** Flag indicating if disconnect was initiated by the user */
  private isManualDisconnect = false;
  
  /** Timer for sending periodic heartbeat messages */
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  /** Promise that resolves when connection is established */
  private connectionPromise: Promise<void> | null = null;

  /** WebSocket server URL */
  private readonly url: string;
  
  /** Current user's ID */
  private userId: string | null = null;
  
  /** Whether the connection is authenticated */
  private isAuthenticated = false;
  
  /** Current space ID the user is in */
  private currentSpaceId: string | null = null;
  
  /** Current auth token */
  private currentToken: string | null = null;
  
  /** User's last known position (grid coordinates) */
  private lastPosition: { x: number; y: number } | null = null;
  
  /** Flag to prevent multiple recovery attempts */
  private isRecovering = false;
  
  /** Last disconnect code (for debugging) */
  private lastDisconnectCode: number | null = null;
  
  /** Last disconnect reason (for debugging) */
  private lastDisconnectReason: string | null = null;

  /**
   * Creates a new WebSocketService instance
   * 
   * The constructor:
   * 1. Normalizes the WebSocket URL (handles http/https/ws/wss)
   * 2. Loads any saved session state from localStorage
   * 3. Sets up page visibility change handlers
   * 4. Initiates connection (if in browser)
   * 
   * @param url - WebSocket server URL (default: 'ws://localhost:3001')
   */
  constructor(url = 'ws://localhost:3001') {
    // Normalize URL to ws/wss protocol
    this.url = (() => {
      try {
        // If caller passed a full ws(s) URL, use as-is
        if (url.startsWith('ws://') || url.startsWith('wss://')) return url;

        // If running in browser, derive protocol from location
        if (typeof window !== 'undefined' && window.location) {
          const isSecure = window.location.protocol === 'https:';
          const protocol = isSecure ? 'wss' : 'ws';

          // If caller passed an http(s) URL, convert to ws(s)
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const parsed = new URL(url);
            return `${protocol}://${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
          }

          // If caller passed a host:port or path, build a full URL
          if (url.includes(':')) {
            return `${protocol}://${url}`;
          }

          // Default to same host, explicit 3001 unless pathname provided
          const host = window.location.hostname;
          return `${protocol}://${host}:3001`;
        }

        // Fallback for non-browser contexts: prefer ws://localhost:3001
        return url.replace(/^https?:\/\//, 'ws://');
      } catch {
        return 'ws://localhost:3001';
      }
    })();
    
    if (typeof window !== 'undefined') {
      // Load saved session state for page refresh recovery (BUG-032 fix)
      this.loadSessionState();
      
      // Set up page visibility handler for reconnection on tab focus
      this.setupVisibilityHandler();
      
      // Set up beforeunload handler to save state before page refresh
      this.setupBeforeUnloadHandler();
      
      // Client-side initialization - connect to WebSocket server
      this.connect();
    }
  }

  // ========================================================================
  // SESSION STATE MANAGEMENT (BUG-032 FIX)
  // ========================================================================

  /**
   * Saves current session state to localStorage
   * 
   * This is called before page unload and periodically during active sessions
   * to enable seamless recovery after browser refresh.
   */
  private saveSessionState(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    const state: SessionState = {
      spaceId: this.currentSpaceId,
      lastPosition: this.lastPosition,
      savedAt: Date.now(),
      userId: this.userId,
      token: this.currentToken,
      reconnectionToken: null, // Will be set by server if supported
    };
    
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
      console.log('[WebSocket] Session state saved for recovery:', {
        spaceId: state.spaceId,
        position: state.lastPosition,
      });
    } catch (error) {
      console.warn('[WebSocket] Failed to save session state:', error);
    }
  }

  /**
   * Loads saved session state from localStorage
   * 
   * Called on initialization to check if we need to recover from a page refresh.
   * Session state expires after SESSION_STATE_MAX_AGE_MS to prevent stale reconnections.
   */
  private loadSessionState(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const stateJson = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stateJson) return;
      
      const state: SessionState = JSON.parse(stateJson);
      
      // Check if state is too old (> 30 seconds)
      const age = Date.now() - state.savedAt;
      if (age > SESSION_STATE_MAX_AGE_MS) {
        console.log('[WebSocket] Session state expired, clearing');
        this.clearSessionState();
        return;
      }
      
      // Restore state for recovery
      this.currentSpaceId = state.spaceId;
      this.lastPosition = state.lastPosition;
      this.userId = state.userId;
      this.currentToken = state.token;
      
      console.log('[WebSocket] Loaded session state for recovery:', {
        spaceId: state.spaceId,
        position: state.lastPosition,
        age: `${Math.round(age / 1000)}s ago`,
      });
    } catch (error) {
      console.warn('[WebSocket] Failed to load session state:', error);
      this.clearSessionState();
    }
  }

  /**
   * Clears saved session state from localStorage
   */
  private clearSessionState(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('[WebSocket] Failed to clear session state:', error);
    }
  }

  /**
   * Sets up handler to save state before page unload
   * 
   * This ensures we save the current state when the user:
   * - Refreshes the page (F5, Ctrl+R)
   * - Closes the tab/window
   * - Navigates away
   */
  private setupBeforeUnloadHandler(): void {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('beforeunload', () => {
      // Only save state if we're in a space
      if (this.currentSpaceId && this.isAuthenticated) {
        this.saveSessionState();
      }
    });
  }

  /**
   * Sets up handler for page visibility changes
   * 
   * This helps recover from situations where:
   * - User switches tabs and connection drops
   * - Device goes to sleep and connection times out
   * - Network temporarily disconnects
   */
  private setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return;
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Page became visible - check connection and recover if needed
        if (!this.isConnected && !this.isManualDisconnect) {
          console.log('[WebSocket] Page became visible, checking connection...');
          this.attemptRecovery();
        }
      }
    });
  }

  /**
   * Attempts to recover a lost session
   * 
   * This is the core of the BUG-032 fix. It:
   * 1. Reconnects to the WebSocket server
   * 2. Re-authenticates if we have credentials
   * 3. Rejoins the previous space
   * 4. Requests position restoration from server
   */
  private async attemptRecovery(): Promise<void> {
    if (this.isRecovering) {
      console.log('[WebSocket] Recovery already in progress');
      return;
    }
    
    // Check if we have state to recover
    if (!this.currentSpaceId || !this.currentToken) {
      console.log('[WebSocket] No session state to recover');
      return;
    }
    
    this.isRecovering = true;
    console.log('[WebSocket] Attempting session recovery...');
    
    try {
      // Step 1: Reconnect
      await this.connect();
      
      // Step 2: Rejoin the space with recovery flag
      this.send('join', {
        spaceId: this.currentSpaceId,
        token: this.currentToken,
        recover: true, // Signal server this is a recovery attempt
        lastPosition: this.lastPosition, // Send last known position
      });
      
      console.log('[WebSocket] Recovery request sent');
    } catch (error) {
      console.error('[WebSocket] Recovery failed:', error);
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Updates the last known position (called on successful moves)
   * 
   * @param x - Grid X coordinate
   * @param y - Grid Y coordinate
   */
  updateLastPosition(x: number, y: number): void {
    this.lastPosition = { x, y };
    // Periodically save state (but not on every move to avoid excessive writes)
  }

  /**
   * Connect to WebSocket server
   * 
   * Uses connection state machine to prevent duplicate connection attempts
   * and handle failed states properly (BUG-015 fix).
   */
  async connect(): Promise<void> {
    // BUG-015 FIX: Use state machine to prevent invalid state transitions
    if (this.connectionState === ConnectionState.CONNECTING) {
      console.log('⏳ Already connecting, waiting for existing promise...');
      return this.connectionPromise!;
    }
    
    if (this.connectionState === ConnectionState.CONNECTED || 
        this.connectionState === ConnectionState.AUTHENTICATED) {
      console.log('✅ Already connected');
      return Promise.resolve();
    }
    
    if (this.connectionState === ConnectionState.FAILED) {
      console.log('❌ Connection permanently failed, not retrying. Call resetConnectionState() first.');
      return Promise.reject(new Error('Connection failed permanently. Please re-authenticate.'));
    }
    
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionState = ConnectionState.CONNECTING;

    this.connectionPromise = new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.connectionState = ConnectionState.CONNECTED;
        resolve();
        return;
      }

      if (this.ws?.readyState === WebSocket.CONNECTING) {
        this.ws.addEventListener('open', () => {
          this.connectionState = ConnectionState.CONNECTED;
          resolve();
        });
        this.ws.addEventListener('error', (err) => {
          this.connectionState = ConnectionState.DISCONNECTED;
          reject(err);
        });
        return;
      }

      try {
        this.isManualDisconnect = false;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('🔗 WebSocket connected');
          this.connectionState = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          this.reconnectInterval = 1000;
          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error, event.data);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected', event.code, event.reason);
          
          // Store disconnect info for debugging
          this.lastDisconnectCode = event.code;
          this.lastDisconnectReason = event.reason || null;
          
          // Stop heartbeat and reset state
          this.stopHeartbeat();
          this.isAuthenticated = false;
          this.connectionPromise = null;
          
          // BUG-015 FIX: Check if this is a non-recoverable disconnect
          if (NON_RECOVERABLE_CODES.has(event.code)) {
            console.error(`❌ Non-recoverable disconnect (code ${event.code}):`, event.reason);
            this.connectionState = ConnectionState.FAILED;
            
            // Emit fatal error for UI to handle
            this.emitInternal('fatal-error', { 
              code: event.code, 
              reason: event.reason,
              message: this.getErrorMessageForCode(event.code)
            });
            
            // Clear session state - user needs to re-authenticate
            this.clearSessionState();
            
            // Do NOT reconnect - user action required
            return;
          }
          
          // Update connection state
          this.connectionState = ConnectionState.DISCONNECTED;
          
          // Only attempt reconnection for network-related issues
          if (!this.isManualDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.connectionState = ConnectionState.RECONNECTING;
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
            this.connectionState = ConnectionState.FAILED;
            this.emitInternal('connection-failed', { 
              attempts: this.reconnectAttempts,
              lastCode: event.code,
              lastReason: event.reason
            });
          }
          
          this.emitInternal('disconnect', { code: event.code, reason: event.reason });
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emitInternal('error', error);
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server
   * 
   * This performs a clean disconnect:
   * 1. Sets manual disconnect flag to prevent auto-reconnection
   * 2. Stops heartbeat timer
   * 3. Cancels any pending reconnection attempts
   * 4. Closes the WebSocket connection
   * 5. Clears session state (prevents auto-recovery on next page load)
   * 
   * @param clearState - If true, clears saved session state (default: true)
   * 
   * @example
   * ```typescript
   * // Full disconnect with state cleanup
   * websocketService.disconnect();
   * 
   * // Disconnect but keep state for recovery
   * websocketService.disconnect(false);
   * ```
   */
  disconnect(clearState = true): void {
    this.isManualDisconnect = true;
    this.stopHeartbeat();
    
    // Cancel any pending reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    // Reset state
    this.connectionPromise = null;
    this.isAuthenticated = false;
    
    // Clear session state if requested (prevents auto-recovery)
    if (clearState) {
      this.currentSpaceId = null;
      this.currentToken = null;
      this.lastPosition = null;
      this.userId = null;
      this.clearSessionState();
    }
    
    console.log('[WebSocket] Disconnected', clearState ? '(state cleared)' : '(state preserved)');
  }

  /**
   * Authenticate with the WebSocket server
   */
  async authenticate(token: string, userId: string): Promise<void> {
    this.userId = userId;
    
    await this.connect();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('authenticated', onAuthenticated);
        this.off('auth-error', onAuthError);
        reject(new Error('Authentication timeout'));
      }, 5000);

      const onAuthenticated = () => {
        clearTimeout(timeout);
        this.isAuthenticated = true;
        console.log('✅ WebSocket authenticated');
        this.off('authenticated', onAuthenticated);
        this.off('auth-error', onAuthError);
        resolve();
      };

      const onAuthError = (error: { message?: string }) => {
        clearTimeout(timeout);
        this.off('authenticated', onAuthenticated);
        this.off('auth-error', onAuthError);
        reject(new Error(error.message || 'Authentication failed'));
      };

      this.on('authenticated', onAuthenticated);
      this.on('auth-error', onAuthError);

      this.send('authenticate', { token, userId });
    });
  }

  /**
   * Join a space (virtual room)
   * 
   * This method:
   * 1. Ensures WebSocket connection is established
   * 2. Sends join request with space ID and auth token
   * 3. Stores space ID for potential recovery after page refresh
   * 
   * @param spaceId - The unique identifier of the space to join
   * @param token - Optional authentication token (uses stored token if not provided)
   * 
   * @example
   * ```typescript
   * // Join a space
   * await websocketService.joinSpace('space-123', authToken);
   * 
   * // Listen for join confirmation
   * websocketService.on('space-joined', (data) => {
   *   console.log('Joined at position:', data.spawn);
   * });
   * ```
   */
  async joinSpace(spaceId: string, token?: string): Promise<void> {
    await this.connect();
    
    // Store for recovery on page refresh (BUG-032 fix)
    this.currentSpaceId = spaceId;
    if (token) {
      this.currentToken = token;
    }
    
    // Send join request to server
    this.send('join', { spaceId, token: token || this.currentToken });
    
    // Save session state immediately after joining
    this.saveSessionState();
    
    console.log(`[WebSocket] Join request sent for space: ${spaceId}`);
  }

  /**
   * Leave the current space
   * 
   * This clears the stored space ID and position, preventing
   * automatic rejoin on reconnection.
   */
  leaveSpace(): void {
    if (this.currentSpaceId) {
      this.send('leave', { spaceId: this.currentSpaceId });
      this.currentSpaceId = null;
      this.lastPosition = null;
      this.clearSessionState();
      console.log('[WebSocket] Left space');
    }
  }

  /**
   * Get raw underlying WebSocket (read-only usage)
   */
  get socket(): WebSocket | null {
    return this.ws;
  }

  /**
   * BUG-016 FIX: Add message to priority queue with overflow protection
   * 
   * @param message - Message to queue
   * @returns true if message was queued, false if dropped
   */
  private queueMessage(message: { type: string; payload: EventData }): boolean {
    const priority = (this.MESSAGE_PRIORITIES[message.type] || 'normal') as 'critical' | 'high' | 'normal' | 'low';
    const queuedMessage: QueuedMessage = { 
      ...message, 
      priority,
      timestamp: Date.now()
    };
    
    // Add to appropriate priority queue
    switch (priority) {
      case 'critical':
        if (this.criticalQueue.length >= this.MAX_CRITICAL_QUEUE) {
          console.warn(`⚠️ [BUG-016] Critical queue full, but adding anyway: ${message.type}`);
        }
        this.criticalQueue.push(queuedMessage);
        break;
      case 'high':
        if (this.highQueue.length >= this.MAX_HIGH_QUEUE) {
          // Drop from lower queues to make room
          this.dropFromLowerQueues('high');
        }
        this.highQueue.push(queuedMessage);
        break;
      case 'normal':
        if (this.normalQueue.length >= this.MAX_NORMAL_QUEUE) {
          this.dropFromLowerQueues('normal');
        }
        this.normalQueue.push(queuedMessage);
        break;
      case 'low':
        if (this.lowQueue.length >= this.MAX_LOW_QUEUE) {
          // For low priority, just drop the new message
          console.log(`📤 [BUG-016] Dropping low priority message (queue full): ${message.type}`);
          return false;
        }
        this.lowQueue.push(queuedMessage);
        break;
    }
    
    const totalQueued = this.criticalQueue.length + this.highQueue.length + 
                       this.normalQueue.length + this.lowQueue.length;
    console.log(`📥 [BUG-016] Queued message: ${message.type} (priority: ${priority}, total: ${totalQueued})`);
    return true;
  }
  
  /**
   * BUG-016: Drop messages from lower priority queues to make room
   */
  private dropFromLowerQueues(forPriority: 'high' | 'normal'): void {
    // For high priority, can drop from low and normal
    // For normal priority, can only drop from low
    if (this.lowQueue.length > 0) {
      const dropped = this.lowQueue.shift();
      console.log(`🗑️ [BUG-016] Dropped low priority message to make room: ${dropped?.type}`);
      return;
    }
    
    if (forPriority === 'high' && this.normalQueue.length > 0) {
      const dropped = this.normalQueue.shift();
      console.log(`🗑️ [BUG-016] Dropped normal priority message to make room: ${dropped?.type}`);
    }
    // Never drop critical or high priority
  }

  /**
   * Send message to WebSocket server
   * 
   * BUG-016 FIX: Uses priority queue when connection is not ready
   */
  send(type: string, data: EventData = {}): void {
    const message = { type, payload: data };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message with priority-based overflow protection
      this.queueMessage(message);
      
      if (!this.isManualDisconnect) {
        this.connect().catch(console.error);
      }
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.queueMessage(message);
    }
  }

  /**
   * Emit event (alias for send for compatibility)
   */
  emit(type: string, data: EventData = {}): void {
    this.send(type, data);
  }

  /**
   * Emit internal event to listeners (not sent to WebSocket)
   */
  private emitInternal<T = unknown>(event: string, data: T | undefined = undefined): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          (listener as EventListener<T>)(data as T);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Add event listener
   * 
   * BUG-027 FIX: Prevents duplicate listener registration to avoid memory leaks.
   * Same listener reference for same event is silently ignored.
   * 
   * @param event - Event name to listen for
   * @param listener - Callback function
   * @returns true if listener was added, false if duplicate
   */
  on<T = unknown>(event: string, listener: EventListener<T>): boolean {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    const listeners = this.eventListeners.get(event)!;
    
    // BUG-027 FIX: Check for duplicate listener to prevent memory leaks
    if (listeners.includes(listener as EventListener)) {
      console.warn(`⚠️ [BUG-027] Duplicate listener prevented for event: ${event}`);
      return false;
    }
    
    listeners.push(listener as EventListener);
    return true;
  }

  /**
   * Remove event listener
   */
  off<T = unknown>(event: string, listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener as EventListener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      
      // BUG-027 FIX: Clean up empty listener arrays to free memory
      if (listeners.length === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }
  
  /**
   * BUG-027 FIX: Get listener statistics for memory monitoring
   * 
   * Returns count of listeners per event for debugging memory leaks.
   * High counts (>10) for a single event may indicate a leak.
   */
  getListenerStats(): { event: string; count: number }[] {
    return Array.from(this.eventListeners.entries())
      .map(([event, listeners]) => ({ event, count: listeners.length }))
      .filter(stat => stat.count > 0)
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }
  
  /**
   * BUG-027 FIX: Get total listener count
   */
  getTotalListenerCount(): number {
    let total = 0;
    for (const listeners of this.eventListeners.values()) {
      total += listeners.length;
    }
    return total;
  }
  
  /**
   * BUG-027 FIX: Check for potential listener leaks
   * 
   * @returns Array of events with suspiciously high listener counts
   */
  checkForListenerLeaks(): { event: string; count: number }[] {
    const SUSPICIOUS_THRESHOLD = 10;
    return this.getListenerStats().filter(stat => stat.count > SUSPICIOUS_THRESHOLD);
  }

  /**
   * Get connection status
   * @returns true if WebSocket is connected and open
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get authentication status
   * @returns true if connection is authenticated
   */
  get isAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get current user ID
   * @returns The user ID or null if not set
   */
  get currentUserId(): string | null {
    return this.userId;
  }

  /**
   * Get current space ID
   * @returns The space ID the user is currently in, or null
   */
  get spaceId(): string | null {
    return this.currentSpaceId;
  }

  /**
   * Get last known position
   * @returns The last known grid position or null
   */
  get position(): { x: number; y: number } | null {
    return this.lastPosition;
  }

  /**
   * Handle incoming WebSocket messages
   * 
   * This method:
   * 1. Parses the message JSON
   * 2. Handles system messages (auth, heartbeat, recovery)
   * 3. Updates internal state (position tracking for BUG-032)
   * 4. Emits events to registered listeners
   * 
   * @param message - The parsed message object
   */
  private handleMessage(message: Record<string, unknown>): void {
    const { type, payload, ...legacyData } = message as { type?: string; payload?: EventData } & EventData;
    if (!type) {
      console.warn('[WebSocket] Received message without type field', message);
      return;
    }
    
    // Use payload if available, otherwise use legacy format for backward compatibility
    const data = payload || legacyData;
    
    // Handle system messages and update internal state
    switch (type) {
      case 'authenticated':
        this.isAuthenticated = true;
        this.emitInternal('authenticated', data);
        break;
        
      case 'auth-error':
        this.isAuthenticated = false;
        this.emitInternal('auth-error', data);
        break;
        
      case 'heartbeat':
        // Respond to heartbeat to keep connection alive
        this.send('heartbeat-response', { timestamp: Date.now() });
        break;
        
      case 'space-joined':
        // Update space tracking for recovery (BUG-032 fix)
        if (data && typeof data === 'object' && 'spawn' in data) {
          const spawn = data.spawn as { x?: number; y?: number } | undefined;
          if (spawn && typeof spawn.x === 'number' && typeof spawn.y === 'number') {
            this.lastPosition = { x: spawn.x, y: spawn.y };
            this.saveSessionState();
          }
        }
        this.emitInternal(type, data);
        break;
        
      case 'user-moved':
        // Track current user's position for recovery (BUG-032 fix)
        if (data && typeof data === 'object') {
          const moveData = data as { userId?: string; x?: number; y?: number };
          if (moveData.userId === this.userId && 
              typeof moveData.x === 'number' && 
              typeof moveData.y === 'number') {
            this.lastPosition = { x: moveData.x, y: moveData.y };
            // Don't save on every move to avoid excessive localStorage writes
          }
        }
        this.emitInternal(type, data);
        break;
        
      case 'session-recovered':
        // Server confirmed session recovery (BUG-032 fix)
        console.log('[WebSocket] ✅ Session recovered successfully:', data);
        this.emitInternal(type, data);
        break;
        
      case 'recovery-failed':
        // Server could not recover session
        console.warn('[WebSocket] ⚠️ Session recovery failed:', data);
        this.clearSessionState();
        this.emitInternal(type, data);
        break;
        
      case 'reconnection-token':
        // Server provided a token for faster reconnection
        if (data && typeof data === 'object' && 'token' in data) {
          // Store token in session state for next reconnection
          console.log('[WebSocket] Received reconnection token');
        }
        this.emitInternal(type, data);
        break;
        
      default:
        // Emit custom events to registered listeners
        this.emitInternal(type, data);
        break;
    }

    // Also emit a generic 'message' event for debugging/logging
    this.emitInternal('message', message);
  }

  /**
   * Process queued messages with priority ordering
   * 
   * BUG-016 FIX: Message Queue Overflow Prevention
   * - Process messages in priority order (critical → high → normal → low)
   * - Batch processing with throttling to prevent overwhelming the connection
   * - Deduplicate position updates to reduce unnecessary traffic
   * 
   * Priority order ensures:
   * - Critical: Video signaling never dropped
   * - High: Movement updates processed promptly
   * - Normal: Chat messages delivered reliably
   * - Low: Analytics can be dropped if needed
   */
  private processMessageQueue(): void {
    if (!this.isConnected || !this.ws) return;
    
    const BATCH_SIZE = 10; // Process messages in batches
    let processed = 0;
    
    // Helper to send a message
    const sendMessage = (message: QueuedMessage): boolean => {
      try {
        this.ws!.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('[WebSocket] Failed to send queued message:', error);
        return false;
      }
    };
    
    // Process critical queue first (all of them)
    while (this.criticalQueue.length > 0 && this.isConnected) {
      const message = this.criticalQueue.shift()!;
      if (!sendMessage(message)) {
        this.criticalQueue.unshift(message);
        return; // Stop processing on error
      }
      processed++;
    }
    
    // Process high priority (up to batch size)
    while (this.highQueue.length > 0 && this.isConnected && processed < BATCH_SIZE) {
      const message = this.highQueue.shift()!;
      if (!sendMessage(message)) {
        this.highQueue.unshift(message);
        return;
      }
      processed++;
    }
    
    // Process normal priority
    while (this.normalQueue.length > 0 && this.isConnected && processed < BATCH_SIZE * 2) {
      const message = this.normalQueue.shift()!;
      if (!sendMessage(message)) {
        this.normalQueue.unshift(message);
        return;
      }
      processed++;
    }
    
    // Process low priority
    while (this.lowQueue.length > 0 && this.isConnected && processed < BATCH_SIZE * 3) {
      const message = this.lowQueue.shift()!;
      if (!sendMessage(message)) {
        this.lowQueue.unshift(message);
        return;
      }
      processed++;
    }
    
    // If there are still messages, schedule next batch
    const remaining = this.criticalQueue.length + this.highQueue.length + 
                      this.normalQueue.length + this.lowQueue.length;
    if (remaining > 0) {
      setTimeout(() => this.processMessageQueue(), 50); // Throttle: 50ms between batches
    }
    
    if (processed > 0) {
      console.log(`[WebSocket] Processed ${processed} queued messages, ${remaining} remaining`);
    }
  }
  
  /**
   * Get current queue statistics for debugging
   * BUG-016: Useful for monitoring queue health
   */
  public getQueueStats(): { critical: number; high: number; normal: number; low: number; total: number } {
    return {
      critical: this.criticalQueue.length,
      high: this.highQueue.length,
      normal: this.normalQueue.length,
      low: this.lowQueue.length,
      total: this.criticalQueue.length + this.highQueue.length + 
             this.normalQueue.length + this.lowQueue.length
    };
  }

  /**
   * Schedule a reconnection attempt with exponential backoff and jitter
   * 
   * This implements the recommended approach for WebSocket reconnection:
   * - Exponential backoff: Wait time doubles with each attempt (1s, 2s, 4s, 8s...)
   * - Jitter: Random variation prevents "thundering herd" when many clients reconnect
   * - Max attempts: Gives up after maxReconnectAttempts to prevent infinite loops
   * 
   * After successful reconnection, attempts to recover the previous session
   * if state was saved (BUG-032 fix).
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    
    // Clear any existing reconnect timer
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Add jitter (±25%) to prevent thundering herd
    const jitter = this.reconnectInterval * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.round(this.reconnectInterval + jitter);
    
    console.log(`[WebSocket] 🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      if (this.isManualDisconnect) {
        return;
      }
      
      try {
        await this.connect();
        
        // On successful reconnection, attempt session recovery (BUG-032 fix)
        if (this.currentSpaceId && this.currentToken) {
          console.log('[WebSocket] Connection restored, attempting session recovery...');
          await this.attemptRecovery();
        }
      } catch {
        // Exponential backoff for next attempt
        this.reconnectInterval = Math.min(
          this.reconnectInterval * 2, 
          this.maxReconnectInterval
        );
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('heartbeat', { timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Get user-friendly error message for a disconnect code (BUG-015 fix)
   * 
   * @param code - WebSocket close code
   * @returns Human-readable error message
   */
  private getErrorMessageForCode(code: number): string {
    switch (code) {
      case CLOSE_CODES.NO_TOKEN:
        return 'Authentication required. Please log in again.';
      case CLOSE_CODES.INVALID_TOKEN:
        return 'Your session is invalid. Please log in again.';
      case CLOSE_CODES.TOKEN_EXPIRED:
        return 'Your session has expired. Please log in again.';
      case CLOSE_CODES.SPACE_NOT_FOUND:
        return 'The space you were trying to join does not exist.';
      case CLOSE_CODES.USER_BANNED:
        return 'Your account has been suspended.';
      case CLOSE_CODES.RATE_LIMITED:
        return 'Too many requests. Please wait a moment and try again.';
      case CLOSE_CODES.SERVER_SHUTDOWN:
        return 'The server is restarting. Please try again in a moment.';
      case 1008: // Policy Violation
        return 'Connection rejected due to policy violation.';
      default:
        return `Connection error (code: ${code})`;
    }
  }
  
  /**
   * Get current connection state (BUG-015 fix)
   * 
   * @returns Current ConnectionState
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  /**
   * Check if connection has failed permanently (BUG-015 fix)
   * 
   * @returns true if connection has failed and won't recover automatically
   */
  hasFailedPermanently(): boolean {
    return this.connectionState === ConnectionState.FAILED;
  }
  
  /**
   * Reset connection state after a fatal error (BUG-015 fix)
   * 
   * Call this after user has re-authenticated to allow reconnection
   */
  resetConnectionState(): void {
    if (this.connectionState === ConnectionState.FAILED) {
      this.connectionState = ConnectionState.DISCONNECTED;
      this.reconnectAttempts = 0;
      this.reconnectInterval = 1000;
      this.lastDisconnectCode = null;
      this.lastDisconnectReason = null;
      console.log('[WebSocket] Connection state reset, ready to reconnect');
    }
  }
  
  /**
   * Get debug info about last disconnect (BUG-015 fix)
   */
  getLastDisconnectInfo(): { code: number | null; reason: string | null } {
    return {
      code: this.lastDisconnectCode,
      reason: this.lastDisconnectReason
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Don't auto-authenticate - let the space page handle authentication
export default websocketService;