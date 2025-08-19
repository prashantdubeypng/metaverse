import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { apiService } from '../services/apiService';
import SpaceCanvas from '../components/SpaceCanvas';
import MapRenderer from '../components/MapRenderer';
import ChatPanel from '../components/ChatPanel';
import ChatroomList from '../components/ChatroomList';

interface Space {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: string;
  mapId?: string;
  elements: SpaceElement[];
}

interface SpaceElement {
  id: string;
  x: number;
  y: number;
  element: {
    id: string;
    width: number;
    height: number;
    imageurl: string;
    static: boolean;
  };
}

const SpaceView: React.FC = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { isChatOpen, loadChatrooms, chatrooms } = useChat();
  
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChatroomList, setShowChatroomList] = useState(false);
  const [viewMode, setViewMode] = useState<'space' | 'map'>('space');

  const loadSpace = useCallback(async () => {
    if (!spaceId) return;

    try {
      setLoading(true);
      setError('');
      const response = await apiService.getSpaceById(spaceId);
      
      if (response.space) {
        setSpace(response.space);
      }
    } catch (err: any) {
      setError('Failed to load space');
      console.error('Load space error:', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (spaceId) {
      loadSpace();
      loadChatrooms(spaceId);
    }
  }, [spaceId, loadSpace, loadChatrooms]);

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Space Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested space could not be loaded.'}</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 text-white">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="flex items-center text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            
            <div>
              <h1 className="text-xl font-bold">{space.name}</h1>
              <p className="text-sm text-gray-300">
                {space.width} × {space.height} • {space.elements?.length || 0} elements
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-800 rounded-md p-1">
              <button
                onClick={() => setViewMode('space')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'space' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Space View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'map' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Map View
              </button>
            </div>

            {/* Chatroom toggle */}
            <button
              onClick={() => setShowChatroomList(!showChatroomList)}
              className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
              </svg>
              Chatrooms ({chatrooms.length})
            </button>

            {/* User info */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm">{user?.username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className={`transition-all duration-300 ${isChatOpen ? 'mr-80' : ''}`}>
        {/* Conditional Rendering: Space Canvas or Map Renderer */}
        {viewMode === 'space' ? (
          <SpaceCanvas space={space} />
        ) : (
          <div className="h-screen pt-16">
            <MapRenderer 
              mapId={space.mapId} 
              className="w-full h-full"
              onElementClick={(element) => {
                console.log('Map element clicked:', element);
              }}
            />
          </div>
        )}
      </div>

      {/* Chatroom List Sidebar */}
      {showChatroomList && (
        <div className="absolute top-16 right-4 w-80 bg-white rounded-lg shadow-lg z-20 max-h-96 overflow-hidden">
          <ChatroomList 
            spaceId={spaceId!} 
            onClose={() => setShowChatroomList(false)}
          />
        </div>
      )}

      {/* Chat Panel */}
      {isChatOpen && <ChatPanel />}

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
        <h3 className="font-medium mb-2">Controls</h3>
        <div className="text-sm space-y-1">
          <div>• Click and drag to move around</div>
          <div>• Scroll to zoom in/out</div>
          <div>• Click on elements to interact</div>
          {isAdmin && <div>• Right-click to add elements</div>}
        </div>
      </div>

      {/* Mini-map (placeholder) */}
      <div className="absolute bottom-4 right-4 w-32 h-24 bg-black bg-opacity-50 border border-gray-600 rounded">
        <div className="w-full h-full bg-gray-800 rounded flex items-center justify-center">
          <span className="text-xs text-gray-400">Mini Map</span>
        </div>
      </div>
    </div>
  );
};

export default SpaceView;