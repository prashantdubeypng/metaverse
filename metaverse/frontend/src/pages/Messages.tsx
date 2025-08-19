import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { apiService } from '../services/apiService';

interface UserChatroom {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  space: {
    id: string;
    name: string;
  };
  memberCount: number;
  userRole: string;
  joinedAt: string;
  createdAt: string;
}

const Messages: React.FC = () => {
  const { user } = useAuth();
  const { isChatOpen, joinRoom, setChatOpen, currentRoom } = useChat();
  const [userChatrooms, setUserChatrooms] = useState<UserChatroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUserChatrooms();
  }, []);

  const loadUserChatrooms = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getUserChatrooms();
      
      if (response.chatrooms) {
        setUserChatrooms(response.chatrooms);
      }
    } catch (err: any) {
      setError('Failed to load chatrooms');
      console.error('Load chatrooms error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (chatroomId: string) => {
    joinRoom(chatroomId);
    setChatOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`transition-all duration-300 ${isChatOpen ? 'mr-80' : ''}`}>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Messages
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Your active chatrooms and conversations.
                </p>
              </div>
              
              <Link
                to="/chatrooms"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Manage Chatrooms
              </Link>
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Chatrooms List */}
          <div className="px-4 py-6 sm:px-0">
            {userChatrooms.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No active chatrooms</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Join chatrooms from spaces to start messaging.
                </p>
                <div className="mt-6">
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Explore Spaces
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
                {userChatrooms.map((chatroom) => (
                  <div
                    key={chatroom.id}
                    className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                      currentRoom === chatroom.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                    }`}
                    onClick={() => handleJoinRoom(chatroom.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {chatroom.name}
                          </h3>
                          
                          {chatroom.isPrivate && (
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                          
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {chatroom.userRole.toLowerCase()}
                          </span>
                        </div>
                        
                        {chatroom.description && (
                          <p className="text-sm text-gray-600 mt-1 truncate">
                            {chatroom.description}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <span>{chatroom.memberCount} members</span>
                          <span>in {chatroom.space.name}</span>
                          <span>joined {formatDate(chatroom.joinedAt)}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        {currentRoom === chatroom.id ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJoinRoom(chatroom.id);
                            }}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                          >
                            Join Chat
                          </button>
                        )}
                        
                        <Link
                          to={`/chatroom/${chatroom.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          {userChatrooms.length > 0 && (
            <div className="px-4 py-6 sm:px-0">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-800">How to use Messages</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Click on any chatroom to join and start messaging</li>
                        <li>The chat panel will open on the right side</li>
                        <li>Use "View Details" to manage members and settings</li>
                        <li>Private chatrooms require invitations or approval to join</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
