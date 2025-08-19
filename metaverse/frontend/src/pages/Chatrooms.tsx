import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { apiService } from '../services/apiService';

interface Invitation {
  id: string;
  chatroomId: string;
  chatroomName: string;
  invitedBy: string;
  inviterUsername: string;
  message?: string;
  createdAt: string;
  expiresAt: string;
}

const Chatrooms: React.FC = () => {
  const { user } = useAuth();
  const { isChatOpen } = useChat();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [userChatrooms, setUserChatrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [invitationsResponse, chatroomsResponse] = await Promise.all([
        apiService.getUserInvitations(),
        apiService.getUserChatrooms()
      ]);

      if (invitationsResponse.invitations) {
        setInvitations(invitationsResponse.invitations);
      }
      
      if (chatroomsResponse.chatrooms) {
        setUserChatrooms(chatroomsResponse.chatrooms);
      }
    } catch (err: any) {
      setError('Failed to load data');
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await apiService.acceptInvitation(invitationId);
      loadData(); // Reload data
    } catch (err: any) {
      setError('Failed to accept invitation');
      console.error('Accept invitation error:', err);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await apiService.declineInvitation(invitationId);
      loadData(); // Reload data
    } catch (err: any) {
      setError('Failed to decline invitation');
      console.error('Decline invitation error:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) <= new Date();
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
            <h1 className="text-3xl font-bold text-gray-900">
              Your Chatrooms
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your chatroom memberships and invitations.
            </p>
          </div>

          {error && (
            <div className="mx-4 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="px-4 py-6 sm:px-0">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Pending Invitations ({invitations.length})
              </h2>
              <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {invitation.chatroomName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Invited by <span className="font-medium">{invitation.inviterUsername}</span>
                        </p>
                        {invitation.message && (
                          <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded">
                            "{invitation.message}"
                          </p>
                        )}
                        <div className="mt-3 text-xs text-gray-500">
                          <p>Invited: {formatDate(invitation.createdAt)}</p>
                          <p className={isExpired(invitation.expiresAt) ? 'text-red-500' : ''}>
                            Expires: {formatDate(invitation.expiresAt)}
                            {isExpired(invitation.expiresAt) && ' (Expired)'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        {!isExpired(invitation.expiresAt) ? (
                          <>
                            <button
                              onClick={() => handleAcceptInvitation(invitation.id)}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineInvitation(invitation.id)}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md">
                            Expired
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your Chatrooms */}
          <div className="px-4 py-6 sm:px-0">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your Chatrooms ({userChatrooms.length})
            </h2>
            
            {userChatrooms.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No chatrooms</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Join chatrooms from spaces or accept invitations to get started.
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
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {userChatrooms.map((chatroom) => (
                  <div
                    key={chatroom.id}
                    className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-medium text-gray-900">{chatroom.name}</h3>
                        {chatroom.isPrivate && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </div>
                      
                      {chatroom.description && (
                        <p className="text-sm text-gray-600 mb-3">
                          {chatroom.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <span>{chatroom.memberCount} members</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {chatroom.userRole?.toLowerCase()}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/chatroom/${chatroom.id}`}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Open Chat
                        </Link>
                        
                        <div className="text-xs text-gray-400">
                          In {chatroom.space?.name || 'Unknown Space'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatrooms;
