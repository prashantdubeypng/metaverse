import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { apiService } from '../services/apiService';

interface JoinRequest {
  id: string;
  userId: string;
  username: string;
  message?: string;
  requestedAt: string;
}

interface Member {
  id: string;
  username: string;
  role: string;
  joinedAt: string;
  isActive: boolean;
}

interface ChatroomDetails {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  creator: {
    id: string;
    username: string;
  };
  members: Member[];
  memberCount: number;
  activeUserCount: number;
  recentMessages: any[];
}

const ChatroomView: React.FC = () => {
  const { chatroomId } = useParams<{ chatroomId: string }>();
  const { user } = useAuth();
  const { isChatOpen, joinRoom, setChatOpen } = useChat();
  const [chatroom, setChatroom] = useState<ChatroomDetails | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'requests' | 'settings'>('overview');

  const isOwner = chatroom?.creator.id === user?.id;
  const userMember = chatroom?.members.find(m => m.id === user?.id);
  const isAdmin = userMember?.role === 'ADMIN' || isOwner;

  useEffect(() => {
    if (chatroomId) {
      loadChatroomData();
    }
  }, [chatroomId]);

  const loadChatroomData = async () => {
    if (!chatroomId) return;
    
    try {
      setLoading(true);
      setError('');
      
      const chatroomResponse = await apiService.getChatroomDetails(chatroomId);
      
      if (chatroomResponse.success) {
        setChatroom(chatroomResponse.chatroom);
        
        // Load join requests if user is owner or admin
        if (isOwner || isAdmin) {
          try {
            const requestsResponse = await apiService.getPendingJoinRequests(chatroomId);
            if (requestsResponse.success) {
              setJoinRequests(requestsResponse.requests || []);
            }
          } catch (err) {
            console.log('No access to join requests');
          }
        }
      }
    } catch (err: any) {
      setError('Failed to load chatroom details');
      console.error('Load chatroom error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!chatroomId) return;
    
    try {
      await apiService.approveJoinRequest(chatroomId, requestId);
      loadChatroomData(); // Reload data
    } catch (err: any) {
      setError('Failed to approve join request');
      console.error('Approve request error:', err);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!chatroomId) return;
    
    try {
      await apiService.rejectJoinRequest(chatroomId, requestId);
      loadChatroomData(); // Reload data
    } catch (err: any) {
      setError('Failed to reject join request');
      console.error('Reject request error:', err);
    }
  };

  const handlePromoteMember = async (userId: string) => {
    if (!chatroomId) return;
    
    try {
      await apiService.promoteMember(chatroomId, userId, 'ADMIN');
      loadChatroomData(); // Reload data
    } catch (err: any) {
      setError('Failed to promote member');
      console.error('Promote member error:', err);
    }
  };

  const handleDemoteMember = async (userId: string) => {
    if (!chatroomId) return;
    
    try {
      await apiService.demoteMember(chatroomId, userId);
      loadChatroomData(); // Reload data
    } catch (err: any) {
      setError('Failed to demote member');
      console.error('Demote member error:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!chatroomId || !window.confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await apiService.removeMember(chatroomId, userId);
      loadChatroomData(); // Reload data
    } catch (err: any) {
      setError('Failed to remove member');
      console.error('Remove member error:', err);
    }
  };

  const handleJoinChat = () => {
    if (chatroomId) {
      joinRoom(chatroomId);
      setChatOpen(true);
    }
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

  if (!chatroom) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Chatroom not found</h2>
          <p className="mt-2 text-gray-600">The chatroom you're looking for doesn't exist or you don't have access.</p>
          <Link to="/chatrooms" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            Back to Chatrooms
          </Link>
        </div>
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
                <div className="flex items-center space-x-3">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {chatroom.name}
                  </h1>
                  {chatroom.isPrivate && (
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Created by {chatroom.creator.username} • {chatroom.memberCount} members • {chatroom.activeUserCount} online
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleJoinChat}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Open Chat
                </button>
                
                <Link
                  to="/chatrooms"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back
                </Link>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="px-4 sm:px-0">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'overview', name: 'Overview' },
                  { id: 'members', name: 'Members' },
                  ...(isAdmin ? [{ id: 'requests', name: `Requests (${joinRequests.length})` }] : []),
                  ...(isOwner ? [{ id: 'settings', name: 'Settings' }] : [])
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-4 py-6 sm:px-0">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {chatroom.description && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Description</h3>
                    <p className="text-gray-700">{chatroom.description}</p>
                  </div>
                )}
                
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Activity</h3>
                  {chatroom.recentMessages.length === 0 ? (
                    <p className="text-gray-500">No recent messages</p>
                  ) : (
                    <div className="space-y-3">
                      {chatroom.recentMessages.slice(0, 5).map((message: any) => (
                        <div key={message.id} className="flex items-start space-x-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 text-sm">
                              <span className="font-medium text-gray-900">{message.username}</span>
                              <span className="text-gray-500">{formatDate(message.timestamp)}</span>
                            </div>
                            <p className="text-gray-700 mt-1">{message.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Members ({chatroom.members.length})</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {chatroom.members.map((member) => (
                    <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${member.isActive ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.username}</p>
                          <p className="text-xs text-gray-500">
                            {member.role} • Joined {formatDate(member.joinedAt)}
                          </p>
                        </div>
                      </div>
                      
                      {isOwner && member.id !== user?.id && (
                        <div className="flex items-center space-x-2">
                          {member.role === 'MEMBER' ? (
                            <button
                              onClick={() => handlePromoteMember(member.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Promote to Admin
                            </button>
                          ) : member.role === 'ADMIN' ? (
                            <button
                              onClick={() => handleDemoteMember(member.id)}
                              className="text-yellow-600 hover:text-yellow-800 text-sm"
                            >
                              Demote
                            </button>
                          ) : null}
                          
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'requests' && isAdmin && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Join Requests ({joinRequests.length})</h3>
                </div>
                {joinRequests.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-gray-500">No pending join requests</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {joinRequests.map((request) => (
                      <div key={request.id} className="px-6 py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{request.username}</p>
                            <p className="text-xs text-gray-500">Requested {formatDate(request.requestedAt)}</p>
                            {request.message && (
                              <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded">
                                "{request.message}"
                              </p>
                            )}
                          </div>
                          
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.id)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && isOwner && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Chatroom Settings</h3>
                <p className="text-gray-500">Chatroom settings management will be implemented here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatroomView;
