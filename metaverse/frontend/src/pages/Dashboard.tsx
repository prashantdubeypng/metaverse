import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { apiService } from '../services/apiService';
import CreateSpaceModal from '../components/CreateSpaceModal';
import ChatPanel from '../components/ChatPanel';

interface Space {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: string;
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { isChatOpen } = useChat();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [allSpacesResponse, userSpacesResponse] = await Promise.all([
        apiService.getSpaces(),
        apiService.getUserSpaces()
      ]);

      if (allSpacesResponse.spaces) {
        setSpaces(allSpacesResponse.spaces);
      }
      
      if (userSpacesResponse.spaces) {
        setUserSpaces(userSpacesResponse.spaces);
      }
    } catch (err: any) {
      setError('Failed to load spaces');
      console.error('Load spaces error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSpaceCreated = () => {
    setShowCreateModal(false);
    loadSpaces(); // Reload spaces after creation
  };

  const handleDeleteSpace = async (spaceId: string) => {
    if (!window.confirm('Are you sure you want to delete this space?')) {
      return;
    }

    try {
      await apiService.deleteSpace(spaceId);
      loadSpaces(); // Reload spaces after deletion
    } catch (err: any) {
      setError('Failed to delete space');
      console.error('Delete space error:', err);
    }
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
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome back, {user?.username}!
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Explore virtual spaces and connect with others in the metaverse.
                </p>
              </div>
              
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Space
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* My Spaces Section */}
          {userSpaces.length > 0 && (
            <div className="px-4 py-6 sm:px-0">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">My Spaces</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {userSpaces.map((space) => (
                  <div
                    key={space.id}
                    className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 relative">
                      {space.thumbnail ? (
                        <img
                          src={space.thumbnail}
                          alt={space.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-white text-6xl opacity-50">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-16 h-16">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                        </div>
                      )}
                      
                      {/* Owner badge */}
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Owner
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{space.name}</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {space.width} × {space.height} units
                      </p>
                      
                      <div className="flex justify-between items-center">
                        <Link
                          to={`/space/${space.id}`}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Enter Space
                        </Link>
                        
                        <button
                          onClick={() => handleDeleteSpace(space.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Spaces Section */}
          <div className="px-4 py-6 sm:px-0">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Explore Spaces</h2>
            
            {spaces.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No spaces available</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {isAdmin ? 'Get started by creating a new space.' : 'Check back later for new spaces to explore.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {spaces.map((space) => (
                  <div
                    key={space.id}
                    className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="h-48 bg-gradient-to-br from-purple-400 to-pink-500 relative">
                      {space.thumbnail ? (
                        <img
                          src={space.thumbnail}
                          alt={space.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-white text-6xl opacity-50">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-16 h-16">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{space.name}</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {space.width} × {space.height} units
                      </p>
                      
                      <Link
                        to={`/space/${space.id}`}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Enter Space
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {isChatOpen && <ChatPanel />}

      {/* Create Space Modal */}
      {showCreateModal && (
        <CreateSpaceModal
          onClose={() => setShowCreateModal(false)}
          onSpaceCreated={handleSpaceCreated}
        />
      )}
    </div>
  );
};

export default Dashboard;