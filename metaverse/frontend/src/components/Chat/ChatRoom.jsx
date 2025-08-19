import React, { useState, useEffect, useRef } from 'react';
import { chatService, chatAPI } from '../../services/chatService';
import './ChatRoom.css';

const ChatRoom = ({ chatroomId, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [chatroomInfo, setChatroomInfo] = useState(null);
    
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load chatroom data
    useEffect(() => {
        const loadChatroomData = async () => {
            try {
                setIsLoading(true);
                const details = await chatAPI.getChatroomDetails(chatroomId);
                
                if (details.success) {
                    setChatroomInfo(details.chatroom);
                    setMembers(details.chatroom.members || []);
                    setMessages(details.chatroom.recentMessages || []);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (chatroomId) {
            loadChatroomData();
        }
    }, [chatroomId]);

    // Setup socket listeners
    useEffect(() => {
        if (!chatroomId) return;

        // Message handlers
        const unsubscribeMessage = chatService.onMessage((type, data) => {
            switch (type) {
                case 'message':
                    if (data.roomId === chatroomId) {
                        setMessages(prev => [...prev, data]);
                        scrollToBottom();
                    }
                    break;
                    
                case 'recent-messages':
                    if (data.roomId === chatroomId) {
                        setMessages(data.messages);
                        scrollToBottom();
                    }
                    break;
            }
        });

        // User handlers
        const unsubscribeUser = chatService.onUser((type, data) => {
            switch (type) {
                case 'joined':
                    console.log(`${data.username} joined the room`);
                    break;
                    
                case 'left':
                    console.log(`${data.username} left the room`);
                    break;
                    
                case 'typing':
                    setTypingUsers(prev => new Set([...prev, data.userId]));
                    break;
                    
                case 'stop-typing':
                    setTypingUsers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.userId);
                        return newSet;
                    });
                    break;
            }
        });

        // Error handlers
        const unsubscribeError = chatService.onError((error) => {
            setError(error.message);
        });

        // Join the room
        try {
            chatService.joinRoom(chatroomId);
            chatAPI.markActive(chatroomId);
        } catch (err) {
            setError(err.message);
        }

        // Cleanup
        return () => {
            unsubscribeMessage();
            unsubscribeUser();
            unsubscribeError();
            
            if (chatroomId) {
                chatService.leaveRoom();
                chatAPI.markInactive(chatroomId).catch(console.error);
            }
        };
    }, [chatroomId]);

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle sending message
    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (!newMessage.trim()) return;

        try {
            chatService.sendMessage(newMessage);
            setNewMessage('');
            chatService.stopTyping();
        } catch (err) {
            setError(err.message);
        }
    };

    // Handle typing
    const handleTyping = (e) => {
        setNewMessage(e.target.value);

        // Send typing indicator
        if (e.target.value.length > 0) {
            chatService.startTyping();
            
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            
            // Stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                chatService.stopTyping();
            }, 2000);
        } else {
            chatService.stopTyping();
        }
    };

    // Format timestamp
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    if (isLoading) {
        return (
            <div className="chat-room loading">
                <div className="loading-spinner">Loading chat...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="chat-room error">
                <div className="error-message">
                    <h3>Error</h3>
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-room">
            {/* Header */}
            <div className="chat-header">
                <div className="chat-info">
                    <h3>{chatroomInfo?.name}</h3>
                    <span className="member-count">
                        {members.length} members • {members.filter(m => m.isActive).length} online
                    </span>
                </div>
                <button className="close-button" onClick={onClose}>×</button>
            </div>

            {/* Messages */}
            <div className="messages-container">
                {messages.map((message) => (
                    <div key={message.id} className="message">
                        <div className="message-header">
                            <span className="username">{message.username}</span>
                            <span className="timestamp">{formatTime(message.timestamp)}</span>
                        </div>
                        <div className="message-content">{message.message}</div>
                    </div>
                ))}
                
                {/* Typing indicators */}
                {typingUsers.size > 0 && (
                    <div className="typing-indicator">
                        <span>
                            {Array.from(typingUsers).map(userId => {
                                const member = members.find(m => m.id === userId);
                                return member?.username;
                            }).filter(Boolean).join(', ')} 
                            {typingUsers.size === 1 ? ' is' : ' are'} typing...
                        </span>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form className="message-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={handleTyping}
                    placeholder="Type a message..."
                    maxLength={2000}
                    className="message-input"
                />
                <button type="submit" disabled={!newMessage.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
};

export default ChatRoom;