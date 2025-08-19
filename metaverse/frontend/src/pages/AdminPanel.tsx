import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

interface Element {
  id: string;
  width: number;
  height: number;
  imageurl: string;
  static: boolean;
}

interface Avatar {
  id: string;
  name: string;
  imageurl: string;
}

const AdminPanel: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'elements' | 'avatars' | 'maps'>('elements');
  const [elements, setElements] = useState<Element[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Element form state
  const [elementForm, setElementForm] = useState({
    imageurl: '',
    width: '',
    height: '',
    static: false
  });

  // Avatar form state
  const [avatarForm, setAvatarForm] = useState({
    name: '',
    imageurl: ''
  });

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      if (activeTab === 'elements') {
        const response = await apiService.getElements();
        if (response.elements) {
          setElements(response.elements);
        }
      } else if (activeTab === 'avatars') {
        const response = await apiService.getAvatars();
        if (response.avatars) {
          setAvatars(response.avatars);
        }
      }
    } catch (err: any) {
      setError('Failed to load data');
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateElement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await apiService.createElement(
        elementForm.imageurl,
        elementForm.width,
        elementForm.height,
        elementForm.static
      );
      
      setElementForm({ imageurl: '', width: '', height: '', static: false });
      loadData(); // Reload elements
    } catch (err: any) {
      setError('Failed to create element');
      console.error('Create element error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await apiService.createAvatar(avatarForm.name, avatarForm.imageurl);
      
      setAvatarForm({ name: '', imageurl: '' });
      loadData(); // Reload avatars
    } catch (err: any) {
      setError('Failed to create avatar');
      console.error('Create avatar error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage elements, avatars, and maps for the metaverse.
          </p>
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
                { id: 'elements', name: 'Elements', icon: '🧩' },
                { id: 'avatars', name: 'Avatars', icon: '👤' },
                { id: 'maps', name: 'Maps', icon: '🗺️' }
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
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 sm:px-0">
          {activeTab === 'elements' && (
            <div className="space-y-6">
              {/* Create Element Form */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Element</h2>
                <form onSubmit={handleCreateElement} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Image URL</label>
                      <input
                        type="url"
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={elementForm.imageurl}
                        onChange={(e) => setElementForm({ ...elementForm, imageurl: e.target.value })}
                        placeholder="https://example.com/image.png"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Width</label>
                        <input
                          type="number"
                          required
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          value={elementForm.width}
                          onChange={(e) => setElementForm({ ...elementForm, width: e.target.value })}
                          placeholder="100"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Height</label>
                        <input
                          type="number"
                          required
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          value={elementForm.height}
                          onChange={(e) => setElementForm({ ...elementForm, height: e.target.value })}
                          placeholder="100"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={elementForm.static}
                      onChange={(e) => setElementForm({ ...elementForm, static: e.target.checked })}
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Static element (cannot be moved by users)
                    </label>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Element'}
                  </button>
                </form>
              </div>

              {/* Elements List */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Elements ({elements.length})</h2>
                </div>
                
                {loading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                    {elements.map((element) => (
                      <div key={element.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="aspect-w-16 aspect-h-9 mb-3">
                          <img
                            src={element.imageurl}
                            alt="Element"
                            className="w-full h-24 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiM5OTkiPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                            }}
                          />
                        </div>
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {element.width} × {element.height}
                          </p>
                          <p className="text-gray-500">
                            {element.static ? 'Static' : 'Movable'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'avatars' && (
            <div className="space-y-6">
              {/* Create Avatar Form */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Avatar</h2>
                <form onSubmit={handleCreateAvatar} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Avatar Name</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={avatarForm.name}
                        onChange={(e) => setAvatarForm({ ...avatarForm, name: e.target.value })}
                        placeholder="Cool Avatar"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Image URL</label>
                      <input
                        type="url"
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={avatarForm.imageurl}
                        onChange={(e) => setAvatarForm({ ...avatarForm, imageurl: e.target.value })}
                        placeholder="https://example.com/avatar.png"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Avatar'}
                  </button>
                </form>
              </div>

              {/* Avatars List */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Avatars ({avatars.length})</h2>
                </div>
                
                {loading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
                    {avatars.map((avatar) => (
                      <div key={avatar.id} className="border border-gray-200 rounded-lg p-4 text-center">
                        <div className="w-16 h-16 mx-auto mb-3">
                          <img
                            src={avatar.imageurl}
                            alt={avatar.name}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjMyIiB5PSIzNiIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSI+QXZhdGFyPC90ZXh0Pjwvc3ZnPg==';
                            }}
                          />
                        </div>
                        <p className="font-medium text-gray-900">{avatar.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'maps' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Maps Management</h2>
              <p className="text-gray-600">Map creation and management features coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;