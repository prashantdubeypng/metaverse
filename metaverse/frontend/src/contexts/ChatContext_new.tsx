import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { chatService, chatAPI } from '../services/chatService';
import { useAuth } from './AuthContext';

interface Message {
  id: string;
  message: string;
  userId: string;
  username: string;
  timestamp: number;
  messageType?: 'text' | 'system' | 'notification';
}

interface Chatroom {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  memberCount: number;
  activeCount: number;
  isMember: boolean;
  userRole?: string;
}

interface ChatContextType {
  // Connection state
  isConnected: boolean;
  currentRoom: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  
  // Messages
  messages: Message[];
  typingUsers: Array<{ userId: string; username: string }>;
  
  // Chatrooms
  chatrooms: Chatroom[];
  
  // Actions
  connectToChat: () => void;
  disconnectFromChat: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  sendMessage: (message: string) => void;
  loadChatrooms: (spaceId: string) => Promise<void>;
  createChatroom: (spaceId: string, name: string, description?: string, isPrivate?: boolean) => Promise<void>;
  
  // Typing
  startTyping: () => void;
  stopTyping: () => void;
  
  // UI state
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  
  // Loading states
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected');
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; username: string }>>([]);
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([]);
  const [isChatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const connectToChat = useCallback(() => {
    if (!token || isConnected) return;

    try {
      chatService.connect(token);
      setError(null);
    } catch (err) {
      setError('Failed to connect to chat service');
      console.error('Chat connection error:', err);
    }
  }, [token, isConnected]);

  const disconnectFromChat = useCallback(() => {
    chatService.disconnect();
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setCurrentRoom(null);
    setMessages([]);
    setTypingUsers([]);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    if (!isConnected) {
      setError('Not connected to chat service');
      return;
    }

    try {
      chatService.joinRoom(roomId);
      setCurrentRoom(roomId);
      setMessages([]); // Clear previous messages
      setTypingUsers([]); // Clear typing users
      setError(null);
    } catch (err) {
      setError('Failed to join room');
      console.error('Join room error:', err);
    }
  }, [isConnected]);

  const leaveRoom = useCallback(() => {
    if (currentRoom) {
      chatService.leaveRoom();
      setCurrentRoom(null);
      setMessages([]);
      setTypingUsers([]);
    }
  }, [currentRoom]);

  const sendMessage = useCallback((message: string) => {
    if (!isConnected || !currentRoom) {
      setError('Not connected or not in a room');
      return;
    }

    try {
      chatService.sendMessage(message);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      console.error('Send message error:', err);
    }
  }, [isConnected, currentRoom]);

  const startTyping = useCallback(() => {
    if (isConnected && currentRoom) {
      chatService.startTyping();
    }
  }, [isConnected, currentRoom]);

  const stopTyping = useCallback(() => {
    if (isConnected && currentRoom) {
      chatService.stopTyping();
    }
  }, [isConnected, currentRoom]);

  const loadChatrooms = useCallback(async (spaceId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await chatAPI.getChatrooms(spaceId);
      
      if (response.success) {
        setChatrooms(response.chatrooms);
      }
    } catch (err) {
      setError('Failed to load chatrooms');
      console.error('Load chatrooms error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createChatroom = useCallback(async (
    spaceId: string, 
    name: string, 
    description?: string, 
    isPrivate?: boolean
  ) => {
    try {
      setLoading(true);
      setError(null);
      const response = await chatAPI.createChatroom(spaceId, name, description, isPrivate);
      
      if (response.success) {
        // Reload chatrooms to get the updated list
        await loadChatrooms(spaceId);
      }
    } catch (err) {
      setError('Failed to create chatroom');
      console.error('Create chatroom error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadChatrooms]);

  // Connect to chat service when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      connectToChat();
    } else {
      disconnectFromChat();
    }

    return () => {
      disconnectFromChat();
    };
  }, [isAuthenticated, token, connectToChat, disconnectFromChat]);

  // Setup event listeners
  useEffect(() => {
    // Connection status listener
    const unsubscribeConnection = chatService.onConnection((status) => {
      setConnectionStatus(status);
      setIsConnected(status === 'connected');
      
      if (status === 'connected') {
        setError(null);
      }
    });

    // Message listeners
    const unsubscribeMessage = chatService.onMessage((type, data) => {
      switch (type) {
        case 'message':
          if (data.roomId === currentRoom) {
            setMessages(prev => {
              // Prevent duplicate messages
              const exists = prev.some(msg => msg.id === data.id);
              if (exists) return prev;
              
              return [...prev, {
                id: data.id,
                message: data.message,
                userId: data.userId,
                username: data.username,
                timestamp: data.timestamp,
                messageType: data.messageType || 'text'
              }];
            });
          }
          break;
          
        case 'recent-messages':
          if (data.roomId === currentRoom) {
            setMessages(data.messages.map((msg: any) => ({
              id: msg.id,
              message: msg.message,
              userId: msg.userId,
              username: msg.username,
              timestamp: msg.timestamp,
              messageType: msg.messageType || 'text'
            })));
          }
          break;
      }
    });

    // User event listeners
    const unsubscribeUser = chatService.onUser((type, data) => {
      switch (type) {
        case 'typing':
          setTypingUsers(prev => {
            const exists = prev.some(user => user.userId === data.userId);
            if (exists) return prev;
            return [...prev, { userId: data.userId, username: data.username }];
          });
          break;

        case 'stop-typing':
          setTypingUsers(prev => prev.filter(user => user.userId !== data.userId));
          break;

        case 'joined':
          // Could show notification
          console.log(`${data.username} joined the room`);
          break;

        case 'left':
          // Could show notification
          console.log(`${data.username} left the room`);
          // Remove from typing users
          setTypingUsers(prev => prev.filter(user => user.userId !== data.userId));
          break;
      }
    });

    // Error listener
    const unsubscribeError = chatService.onError((error) => {
      setError(error.message || 'Chat service error');
      console.error('Chat error:', error);
    });

    return () => {
      unsubscribeConnection();
      unsubscribeMessage();
      unsubscribeUser();
      unsubscribeError();
    };
  }, [currentRoom]);

  const value: ChatContextType = {
    isConnected,
    connectionStatus,
    currentRoom,
    messages,
    typingUsers,
    chatrooms,
    connectToChat,
    disconnectFromChat,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    loadChatrooms,
    createChatroom,
    isChatOpen,
    setChatOpen,
    loading,
    error,
    clearError
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
