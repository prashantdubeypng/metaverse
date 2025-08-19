import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

interface Avatar {
  id: string;
  name: string;
  imageurl: string;
}

const Avatars: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(user?.avatarId || '');

  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getAvatars();
      setAvatars(response.avatars || []);
    } catch (err: any) {
      setError('Failed to load avatars');
      console.error('Load avatars error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSelect = async (avatarId: string) => {
    try {
      setUpdating(true);
      setError('');
      
      // Update user metadata with selected avatar
      await apiService.updateMetadata(avatarId);
      
      // Update selected avatar in local state
      setSelectedAvatarId(avatarId);
      
      // Update user context
      if (updateUser) {
        updateUser({ ...user, avatarId });
      }
      
      // Show success message
      alert('Avatar updated successfully!');
      
    } catch (err: any) {
      setError('Failed to update avatar');
      console.error('Update avatar error:', err);
    } finally {
      setUpdating(false);
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Choose Your Avatar</h1>
          <p className="text-lg text-gray-600">
            Select an avatar to represent yourself in the metaverse
          </p>
          
          {user?.avatarId && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg inline-block">
              <p className="text-blue-800">
                <span className="font-medium">Current Avatar:</span>{' '}
                {avatars.find(a => a.id === user.avatarId)?.name || 'Unknown'}
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {avatars.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No avatars available</h3>
            <p className="text-gray-600">Please contact an administrator to add avatars.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className={`
                  relative bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1
                  ${selectedAvatarId === avatar.id ? 'ring-4 ring-blue-500 shadow-blue-200' : ''}
                  ${updating ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => !updating && handleAvatarSelect(avatar.id)}
              >
                {/* Selection Badge */}
                {selectedAvatarId === avatar.id && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Avatar Image */}
                <div className="aspect-square p-6">
                  <img
                    src={avatar.imageurl}
                    alt={avatar.name}
                    className="w-full h-full object-contain rounded-lg"
                    onError={(e) => {
                      // Fallback to a placeholder if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBDMTEwLjQ5MyA3MCAxMTkgNzguNTA3MyAxMTkgODlDMTE5IDk5LjQ5MjcgMTEwLjQ5MyAxMDggMTAwIDEwOEM4OS41MDczIDEwOCA4MSA5OS40OTI3IDgxIDg5QzgxIDc4LjUwNzMgODkuNTA3MyA3MCAxMDAgNzBaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0xNjAgMTQwQzE2MCAzMjIuMDkxIDEyOC4wMzIgMTQwIDEwMCAxNDBDNzEuOTY3NSAxNDAgNDAgMzIyLjA5MSA0MCAxNDBIMTYwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                    }}
                  />
                </div>

                {/* Avatar Name */}
                <div className="px-6 pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                    {avatar.name}
                  </h3>
                  
                  {/* Select Button */}
                  <button
                    className={`
                      w-full py-2 px-4 rounded-lg font-medium transition-colors duration-200
                      ${selectedAvatarId === avatar.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                      ${updating ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    disabled={updating}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!updating) handleAvatarSelect(avatar.id);
                    }}
                  >
                    {updating ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </span>
                    ) : selectedAvatarId === avatar.id ? (
                      'Selected'
                    ) : (
                      'Select Avatar'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-12 text-center">
          <div className="bg-gray-50 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">How to use avatars</h3>
            <p className="text-gray-600">
              Your selected avatar will represent you in virtual spaces, chatrooms, and when interacting with other users. 
              You can change your avatar at any time by returning to this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Avatars;
