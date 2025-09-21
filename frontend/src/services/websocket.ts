// Removed unused BaseEventMap interface (was not referenced)

type EventListener<T = unknown> = (payload: T) => void;
type EventData = Record<string, unknown>;

/**
 * WebSocket service for real-time communication
 * Handles connection management, event listeners, and message sending
 */
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second
  private maxReconnectInterval = 30000; // Max 30 seconds
  private eventListeners: Map<string, EventListener[]> = new Map();
  private messageQueue: Array<{ type: string; payload: EventData }> = [];
  private isManualDisconnect = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;

  private readonly url: string;
  private userId: string | null = null;
  private isAuthenticated = false;

  constructor(url = 'http://localhost:3001') {
    this.url = url;
    
    if (typeof window !== 'undefined') {
      // Client-side initialization
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.ws?.readyState === WebSocket.CONNECTING) {
        this.ws.addEventListener('open', () => resolve());
        this.ws.addEventListener('error', reject);
        return;
      }

      try {
        this.isManualDisconnect = false;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('🔗 WebSocket connected');
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
          this.stopHeartbeat();
          this.isAuthenticated = false;
          this.connectionPromise = null;
          
          if (!this.isManualDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
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
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.connectionPromise = null;
    this.isAuthenticated = false;
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
   * Join a space (queues until connection open)
   */
  async joinSpace(spaceId: string, token?: string): Promise<void> {
    await this.connect();
    this.send('join', { spaceId, token });
  }

  /**
   * Get raw underlying WebSocket (read-only usage)
   */
  get socket(): WebSocket | null {
    return this.ws;
  }

  /**
   * Send message to WebSocket server
   */
  send(type: string, data: EventData = {}): void {
    const message = { type, payload: data };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message for sending when connection is ready
      this.messageQueue.push(message);
      
      if (!this.isManualDisconnect) {
        this.connect().catch(console.error);
      }
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.messageQueue.push(message);
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
   */
  on<T = unknown>(event: string, listener: EventListener<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener as EventListener);
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
   * Get connection status
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get authentication status
   */
  get isAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get current user ID
   */
  get currentUserId(): string | null {
    return this.userId;
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: Record<string, unknown>): void {
    const { type, payload, ...legacyData } = message as { type?: string; payload?: EventData } & EventData;
    if (!type) {
      console.warn('Received message without type field', message);
      return;
    }
    
    // Use payload if available, otherwise use legacy format for backward compatibility
    const data = payload || legacyData;
    
    // Handle system messages
    switch (type) {
      case 'authenticated':
        this.emitInternal('authenticated', data);
        break;
      case 'auth-error':
        this.emitInternal('auth-error', data);
        break;
      case 'heartbeat':
        // Respond to heartbeat
        this.send('heartbeat-response', { timestamp: Date.now() });
        break;
      default:
        // Emit custom events
        this.emitInternal(type, data);
        break;
    }

    // Also emit a generic 'message' event
    this.emitInternal('message', message);
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift()!;
      try {
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send queued message:', error);
        // Put message back at front of queue
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    console.log(`🔄 Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isManualDisconnect) {
        this.connect().catch(() => {
          // Exponential backoff
          this.reconnectInterval = Math.min(
            this.reconnectInterval * 2, 
            this.maxReconnectInterval
          );
        });
      }
    }, this.reconnectInterval);
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
}

// Create singleton instance
const websocketService = new WebSocketService();

// Don't auto-authenticate - let the space page handle authentication
export default websocketService;