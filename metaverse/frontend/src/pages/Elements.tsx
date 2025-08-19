import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface Element {
  id: string;
  width: number;
  height: number;
  imageurl: string;
  static: boolean;
}

const Elements: React.FC = () => {
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadElements();
  }, []);

  const loadElements = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getElements();
      
      if (response.elements) {
        setElements(response.elements);
      }
    } catch (err: any) {
      setError('Failed to load elements');
      console.error('Load elements error:', err);
    } finally {
      setLoading(false);
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
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900">
            Available Elements
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse available elements that can be added to spaces.
          </p>
        </div>

        {error && (
          <div className="mx-4 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Elements Grid */}
        <div className="px-4 py-6 sm:px-0">
          {elements.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No elements available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Elements will be available when added by administrators.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {elements.map((element) => (
                <div
                  key={element.id}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
                >
                  <div className="aspect-square bg-gray-100 p-4 flex items-center justify-center">
                    <img
                      src={element.imageurl}
                      alt={`Element ${element.id}`}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-element.png';
                      }}
                    />
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        Element #{element.id.slice(-6)}
                      </h3>
                      {element.static && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Static
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Dimensions: {element.width} × {element.height}</p>
                      <p>Type: {element.static ? 'Static (non-interactive)' : 'Interactive'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Information */}
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800">About Elements</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Elements are objects that can be placed in virtual spaces</li>
                    <li>Static elements are decorative and non-interactive</li>
                    <li>Interactive elements can be clicked or interacted with</li>
                    <li>Only space owners can add elements to their spaces</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Elements;
