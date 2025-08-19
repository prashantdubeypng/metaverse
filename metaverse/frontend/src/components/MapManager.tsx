import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface Map {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string;
  elementCount: number;
}

interface MapManagerProps {
  onMapSelect?: (mapId: string) => void;
  selectedMapId?: string;
}

const MapManager: React.FC<MapManagerProps> = ({ onMapSelect, selectedMapId }) => {
  const [maps, setMaps] = useState<Map[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    width: 1000,
    height: 1000,
    thumbnail: ''
  });

  useEffect(() => {
    loadMaps();
  }, []);

  const loadMaps = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getMaps();
      setMaps(response.maps || []);
    } catch (err: any) {
      setError('Failed to load maps');
      console.error('Load maps error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMap = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await apiService.createMap(
        createForm.name,
        createForm.width,
        createForm.height,
        createForm.thumbnail
      );

      setCreateForm({ name: '', width: 1000, height: 1000, thumbnail: '' });
      setShowCreateForm(false);
      loadMaps();
    } catch (err: any) {
      setError('Failed to create map');
      console.error('Create map error:', err);
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    if (!window.confirm('Are you sure you want to delete this map?')) return;

    try {
      await apiService.deleteMap(mapId);
      loadMaps();
    } catch (err: any) {
      setError('Failed to delete map');
      console.error('Delete map error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Map Manager</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Create New Map
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Create Map Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border">
          <h3 className="text-xl font-semibold mb-4">Create New Map</h3>
          <form onSubmit={handleCreateMap}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Map Name
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thumbnail URL (optional)
                </label>
                <input
                  type="url"
                  value={createForm.thumbnail}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, thumbnail: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width (px)
                </label>
                <input
                  type="number"
                  value={createForm.width}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, width: parseInt(e.target.value) || 1000 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="100"
                  max="10000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height (px)
                </label>
                <input
                  type="number"
                  value={createForm.height}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, height: parseInt(e.target.value) || 1000 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="100"
                  max="10000"
                  required
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create Map
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Maps Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {maps.map((map) => (
          <div
            key={map.id}
            className={`bg-white rounded-lg shadow-lg overflow-hidden border-2 transition-all cursor-pointer ${
              selectedMapId === map.id 
                ? 'border-blue-500 ring-2 ring-blue-200' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onMapSelect?.(map.id)}
          >
            {/* Map Thumbnail */}
            <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              {map.thumbnail ? (
                <img
                  src={map.thumbnail}
                  alt={map.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-sm text-gray-500 mt-2">No Preview</p>
                </div>
              )}
            </div>

            {/* Map Info */}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{map.name}</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Size: {map.width} × {map.height}px</p>
                <p>Elements: {map.elementCount}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMapSelect?.(map.id);
                  }}
                  className="flex-1 bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  Select
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMap(map.id);
                  }}
                  className="bg-red-500 text-white py-2 px-3 rounded text-sm hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {maps.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="mt-4">No maps created yet. Create your first map to get started!</p>
        </div>
      )}
    </div>
  );
};

export default MapManager;
