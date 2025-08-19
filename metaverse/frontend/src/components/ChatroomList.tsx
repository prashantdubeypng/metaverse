import React, { useState, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { apiService } from '../services/apiService';

interface ChatroomListProps {
  spaceId: string;
  onClose: () => void;
}

const ChatroomList: React.FC<ChatroomListProps> = ({ spaceId, onClose }) => {
  const { 
    chatrooms, 
    loadChatrooms, 
    createChatroom, 
    joinRoom, 
    currentRoom,
    setChatOpen,
    loading 
  } = useChat();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    isPrivate: false
  });

  useEffect(() => {
    loadChatrooms(spaceId);
  }, [spaceId, loadChatrooms]);

  const handleCreateChatroom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createChatroom(
        spaceId,
        createForm.name,
        createForm.description,
        createForm.isPrivate
      );
      
      setCreateForm({ name: '', description: '', isPrivate: false });
      setShowCreateForm(false);
    } catch (err) {
      console.error('Failed to create chatroom:', err);
    }
  };

  const handleJoinRoom = async (chatroomId: string, isPrivate: boolean = false) => {
    try {
      if (isPrivate) {
        // For private chatrooms, show a message input for join request
        const message = prompt('Enter a message with your join request (optional):');
        if (message === null) return; // User cancelled
        
        const result = await apiService.joinChatroom(chatroomId, message);
        if (result.requiresApproval) {
          alert('Join request submitted! You will be notified when it is approved.');
          return;
        }
      }
      
      // For public chatrooms or successful private joins
      joinRoom(chatroomId);
      setChatOpen(true);
      onClose();
    } catch (err: any) {
      console.error('Failed to join room:', err);
      if (err.response?.data?.requiresApproval) {
        alert('Join request submitted! You will be notified when it is approved.');
      } else {
        alert('Failed to join chatroom: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-h-96 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Chatrooms</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            + New
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleCreateChatroom} className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Chatroom name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            
            <div>
              <textarea
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={createForm.isPrivate}
                onChange={(e) => setCreateForm({ ...createForm, isPrivate: e.target.checked })}
              />
              <label htmlFor="isPrivate" className="ml-2 text-sm text-gray-700">
                Private chatroom
              </label>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chatrooms List */}
      <div className="flex-1 overflow-y-auto">
        {loading && chatrooms.length === 0 ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : chatrooms.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">No chatrooms yet</p>
            <p className="text-xs text-gray-400">Create one to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {chatrooms.map((chatroom) => (
              <div
                key={chatroom.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  currentRoom === chatroom.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
                onClick={() => handleJoinRoom(chatroom.id, chatroom.isPrivate)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {chatroom.name}
                      </h4>
                      
                      {chatroom.isPrivate && (
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    
                    {chatroom.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {chatroom.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>{chatroom.memberCount} members</span>
                      <span className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                        {chatroom.activeCount} online
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-1">
                    {chatroom.isMember ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Joined
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Join
                      </span>
                    )}
                    
                    {chatroom.userRole && (
                      <span className="text-xs text-gray-400 capitalize">
                        {chatroom.userRole.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatroomList;