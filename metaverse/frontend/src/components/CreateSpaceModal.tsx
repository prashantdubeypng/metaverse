import React, { useState } from 'react';
import { apiService } from '../services/apiService';

interface CreateSpaceModalProps {
  onClose: () => void;
  onSpaceCreated: () => void;
}

const CreateSpaceModal: React.FC<CreateSpaceModalProps> = ({ onClose, onSpaceCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    dimensions: '100x100',
    mapId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      await apiService.createSpace(
        formData.name,
        formData.dimensions,
        formData.mapId || undefined
      );
      
      onSpaceCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create space');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onClick={handleBackdropClick}
    >
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Create New Space</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Space Name
              </label>
              <input
                type="text"
                id="name"
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Space"
              />
            </div>

            <div>
              <label htmlFor="dimensions" className="block text-sm font-medium text-gray-700">
                Dimensions
              </label>
              <select
                id="dimensions"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
              >
                <option value="100x100">Small (100×100)</option>
                <option value="200x200">Medium (200×200)</option>
                <option value="500x500">Large (500×500)</option>
                <option value="1000x1000">Extra Large (1000×1000)</option>
              </select>
            </div>

            <div>
              <label htmlFor="mapId" className="block text-sm font-medium text-gray-700">
                Base Map (Optional)
              </label>
              <input
                type="text"
                id="mapId"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={formData.mapId}
                onChange={(e) => setFormData({ ...formData, mapId: e.target.value })}
                placeholder="Leave empty for blank space"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Enter a map ID to use as a template
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Space'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateSpaceModal;