import { io, Socket } from 'socket.io-client';

interface MessageHandler {
  (type: 'message' | 'recent-messages', data: any): void;
}

interface UserHandler {
  (type: 'joined' | 'left' | 'typing' | 'stop-typing', data: any): void;
}

interface ErrorHandler {
  (error: any): void;
}

interface ConnectionHandler {
  (status: 'connected' | 'disconnected' | 'reconnecting' | 'error'): void;
}

class ChatService {
    private socket: Socket | null = null;
    public isConnected: boolean = false;
    public currentRoom: string | null = null;
    private token: string | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    private messageHandlers: Set<MessageHandler> = new Set();
    private userHandlers: Set<UserHandler> = new Set();
    private errorHandlers: Set<ErrorHandler> = new Set();
    private connectionHandlers: Set<ConnectionHandler> = new Set();

    // Enhanced connect with automatic reconnection
    connect(token: string): void {
        this.token = token;
        this.attemptConnection();
    }

    private attemptConnection(): void {
        if (this.socket) {
            this.disconnect();
        }

        const chatServiceUrl = process.env.REACT_APP_CHAT_SERVICE_URL || 'http://localhost:3002';
        console.log(`Attempting to connect to chat service: ${chatServiceUrl}`);

        this.socket = io(chatServiceUrl, {
            auth: {
                token: this.token
            },
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: true
        });

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to chat service');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.connectionHandlers.forEach(handler => handler('connected'));

            // Rejoin current room if any
            if (this.currentRoom) {
                console.log(`Rejoining room: ${this.currentRoom}`);
                this.socket!.emit('join-room', this.currentRoom);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log(`Disconnected from chat service: ${reason}`);
            this.isConnected = false;
            this.stopHeartbeat();
            this.connectionHandlers.forEach(handler => handler('disconnected'));

            // Handle different disconnection reasons
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, don't reconnect automatically
                console.log('Server disconnected client');
            } else {
                // Client side disconnect or network issue, will auto-reconnect
                console.log('Will attempt to reconnect...');
                this.connectionHandlers.forEach(handler => handler('reconnecting'));
            }
        });

        this.socket.on('connect_error', (error: any) => {
            console.error('Chat connection error:', error);
            this.reconnectAttempts++;
            this.connectionHandlers.forEach(handler => handler('error'));
            this.errorHandlers.forEach(handler => handler({
                type: 'connection_error',
                message: 'Failed to connect to chat service',
                details: error.message
            }));
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected to chat service after ${attemptNumber} attempts`);
            this.isConnected = true;
            this.connectionHandlers.forEach(handler => handler('connected'));
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`Reconnection attempt ${attemptNumber}`);
            this.connectionHandlers.forEach(handler => handler('reconnecting'));
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
            this.errorHandlers.forEach(handler => handler({
                type: 'reconnection_error',
                message: 'Failed to reconnect to chat service',
                details: error.message
            }));
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Failed to reconnect after maximum attempts');
            this.isConnected = false;
            this.connectionHandlers.forEach(handler => handler('error'));
            this.errorHandlers.forEach(handler => handler({
                type: 'reconnection_failed',
                message: 'Failed to reconnect to chat service after maximum attempts'
            }));
        });

        // Message events
        this.socket.on('receive-message', (data: any) => {
            this.messageHandlers.forEach(handler => handler('message', data));
        });

        this.socket.on('recent-messages', (data: any) => {
            this.messageHandlers.forEach(handler => handler('recent-messages', data));
        });

        // User events
        this.socket.on('user-joined', (data: any) => {
            this.userHandlers.forEach(handler => handler('joined', data));
        });

        this.socket.on('user-left', (data: any) => {
            this.userHandlers.forEach(handler => handler('left', data));
        });

        this.socket.on('user-typing', (data: any) => {
            this.userHandlers.forEach(handler => handler('typing', data));
        });

        this.socket.on('user-stop-typing', (data: any) => {
            this.userHandlers.forEach(handler => handler('stop-typing', data));
        });

        // Error events
        this.socket.on('error', (error: any) => {
            console.error('Chat error:', error);
            this.errorHandlers.forEach(handler => handler(error));
        });

        // Server stats and info
        this.socket.on('room-stats', (data: any) => {
            console.log('Room stats:', data);
        });

        // Pong response for heartbeat
        this.socket.on('pong', (data: any) => {
            console.log('Heartbeat pong received:', data);
        });
    }

    // Heartbeat to keep connection alive
    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.socket) {
                this.socket.emit('ping');
            }
        }, 30000); // Every 30 seconds
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // Enhanced disconnect
    disconnect(): void {
        if (this.socket) {
            this.stopHeartbeat();
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.currentRoom = null;
        }
    }

    // Enhanced join room with retry logic
    joinRoom(roomId: string): void {
        if (!this.isConnected || !this.socket) {
            throw new Error('Not connected to chat service');
        }

        if (this.currentRoom === roomId) {
            return; // Already in this room
        }

        // Leave current room if any
        if (this.currentRoom) {
            this.leaveRoom();
        }

        this.socket.emit('join-room', roomId);
        this.currentRoom = roomId;
        console.log(`Joined room: ${roomId}`);

        // Request room stats
        setTimeout(() => {
            if (this.socket && this.isConnected) {
                this.socket.emit('get-room-stats', { roomId });
            }
        }, 1000);
    }

    // Leave current chatroom
    leaveRoom(): void {
        if (!this.isConnected || !this.socket || !this.currentRoom) {
            return;
        }

        this.socket.emit('leave-room', this.currentRoom);
        console.log(`Left room: ${this.currentRoom}`);
        this.currentRoom = null;
    }

    // Enhanced send message with retry
    sendMessage(message: string): void {
        if (!this.isConnected || !this.socket || !this.currentRoom) {
            throw new Error('Not connected or not in a room');
        }

        if (!message || message.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }

        if (message.length > 2000) {
            throw new Error('Message too long (max 2000 characters)');
        }

        this.socket.emit('send-message', {
            roomId: this.currentRoom,
            message: message.trim()
        });
    }

    // Enhanced typing indicators
    startTyping(): void {
        if (!this.isConnected || !this.socket || !this.currentRoom) {
            return;
        }

        this.socket.emit('typing', { roomId: this.currentRoom });
    }

    stopTyping(): void {
        if (!this.isConnected || !this.socket || !this.currentRoom) {
            return;
        }

        this.socket.emit('stop-typing', { roomId: this.currentRoom });
    }

    // Force reconnection
    forceReconnect(): void {
        if (this.token) {
            console.log('Forcing reconnection...');
            this.disconnect();
            setTimeout(() => {
                this.attemptConnection();
            }, 1000);
        }
    }

    // Get room statistics
    getRoomStats(): void {
        if (this.isConnected && this.socket && this.currentRoom) {
            this.socket.emit('get-room-stats', { roomId: this.currentRoom });
        }
    }

    // Event handlers
    onMessage(handler: MessageHandler): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    onUser(handler: UserHandler): () => void {
        this.userHandlers.add(handler);
        return () => this.userHandlers.delete(handler);
    }

    onError(handler: ErrorHandler): () => void {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    onConnection(handler: ConnectionHandler): () => void {
        this.connectionHandlers.add(handler);
        return () => this.connectionHandlers.delete(handler);
    }

    // Get enhanced connection status
    getStatus(): { 
        isConnected: boolean; 
        currentRoom: string | null; 
        reconnectAttempts: number;
        socketId?: string;
    } {
        return {
            isConnected: this.isConnected,
            currentRoom: this.currentRoom,
            reconnectAttempts: this.reconnectAttempts,
            socketId: this.socket?.id
        };
    }
}

// HTTP API methods for chat management
class ChatAPI {
    private baseURL: string;

    constructor(baseURL: string = process.env.REACT_APP_API_URL || 'http://localhost:3000') {
        this.baseURL = baseURL;
    }

    // Get auth headers
    private getHeaders(): Record<string, string> {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    // Create a new chatroom
    async createChatroom(spaceId: string, name: string, description: string = '', isPrivate: boolean = false): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/chatroom/create`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                roomid: spaceId,
                name,
                description,
                isPrivate
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create chatroom: ${response.statusText}`);
        }

        return await response.json();
    }

    // Get chatrooms in a space
    async getChatrooms(spaceId: string): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/chatroom/rooms?spaceId=${spaceId}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to get chatrooms: ${response.statusText}`);
        }

        return await response.json();
    }

    // Join a chatroom
    async joinChatroom(chatroomId: string): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/chatroom/join`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chatroomId })
        });

        if (!response.ok) {
            throw new Error(`Failed to join chatroom: ${response.statusText}`);
        }

        return await response.json();
    }

    // Leave a chatroom
    async leaveChatroom(chatroomId: string): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/chatroom/leave`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chatroomId })
        });

        if (!response.ok) {
            throw new Error(`Failed to leave chatroom: ${response.statusText}`);
        }

        return await response.json();
    }

    // Get chatroom details
    async getChatroomDetails(chatroomId: string): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/chatroom/${chatroomId}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to get chatroom details: ${response.statusText}`);
        }

        return await response.json();
    }

    // Get user's chatrooms
    async getUserChatrooms(): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/messages/chatrooms`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to get user chatrooms: ${response.statusText}`);
        }

        return await response.json();
    }

    // Get messages from a chatroom
    async getMessages(chatroomId: string, limit: number = 50): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/messages?chatroomId=${chatroomId}&limit=${limit}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to get messages: ${response.statusText}`);
        }

        return await response.json();
    }

    // Mark user as active in chatroom
    async markActive(chatroomId: string): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/messages/active`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chatroomId })
        });

        if (!response.ok) {
            throw new Error(`Failed to mark as active: ${response.statusText}`);
        }

        return await response.json();
    }

    // Mark user as inactive in chatroom
    async markInactive(chatroomId: string): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/v1/messages/inactive`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chatroomId })
        });

        if (!response.ok) {
            throw new Error(`Failed to mark as inactive: ${response.statusText}`);
        }

        return await response.json();
    }
}

// Export singleton instances
export const chatService = new ChatService();
export const chatAPI = new ChatAPI();

// Export classes for custom instances
export { ChatService, ChatAPI };