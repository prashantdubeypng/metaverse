// ...existing code...
// Removed stray useState from top level

"use client";
interface BackendElement {
  id: string;
  imageurl: string;
  width: number;
  height: number;
  static: boolean;
  name?: string;
  type?: string;
}

import { useState, useEffect, Suspense, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import ProtectedRoute from '@/components/ProtectedRoute';
import { clearTokenData, getTokenData } from '@/utils/auth';

interface Map {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

interface Element {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  width: number;
  height: number;
}

interface PlacedElement {
  id: string;
  elementId: string;
  x: number;
  y: number;
  element: Element;
}

function MapEditorContent() {
  const [, setMap] = useState<Map | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [placedElements, setPlacedElements] = useState<PlacedElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingElements, setIsLoadingElements] = useState(false);
  const [error, setError] = useState('');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [draggedElement, setDraggedElement] = useState<Element | null>(null);
  const [mapName, setMapName] = useState('');
  const [mapWidth, setMapWidth] = useState(800);
  const [mapHeight, setMapHeight] = useState(600);
  const [isSaving, setIsSaving] = useState(false);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapId = searchParams.get('id');
  const isEditing = !!mapId;

  const fetchMap = useCallback(async () => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      const response = await fetch(`process.env.NEXT_PUBLIC_API_URL/maps/${mapId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        clearTokenData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const mapData = data.data || data;
      setMap(mapData);
      setMapName(mapData.name);
      setMapWidth(mapData.width);
      setMapHeight(mapData.height);
      // Fetch placed elements for this map
      await fetchPlacedElements(mapData.id);
    } catch (err) {
      console.error('Error fetching map:', err);
      setError('Failed to load map');
    } finally {
      setIsLoading(false);
    }
  }, [mapId, router]);

  const fetchElements = useCallback(async () => {
    setIsLoadingElements(true);
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:8000/api/v1/elements', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        clearTokenData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      // Use data.elements and map imageurl to imageUrl
      const elements = (data.elements || []).map((x: BackendElement) => ({
        id: x.id,
        name: x.name || '',
        type: x.type || '',
        imageUrl: x.imageurl,
        width: x.width,
        height: x.height,
        static: x.static,
      }));
      setElements(elements);
    } catch (err) {
      console.error('Error fetching elements:', err);
      setError('Failed to load elements');
    } finally {
      setIsLoadingElements(false);
    }
  }, [router]);

  useEffect(() => {
    if (isEditing) {
      fetchMap();
    } else {
      setIsLoading(false);
    }
    fetchElements();
  }, [mapId, isEditing, fetchMap, fetchElements]);



  const fetchPlacedElements = async (mapId: string) => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) return;

      const response = await fetch(`http://localhost:8000/api/v1/maps/${mapId}/elements`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPlacedElements(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching placed elements:', err);
    }
  };

  const handleSaveMap = async () => {
    if (!mapName.trim()) {
      setError('Map name is required');
      return;
    }

    setIsSaving(true);
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }
      const mapData = {
        name: mapName.trim(),
        thumbnail: 'https://opengameart.org/sites/default/files/styles/medium/public/Screenshot%20from%202019-12-17%2014-51-10.png', // You can add thumbnail generation later
        dimensions: `${mapWidth}x${mapHeight}`,
        defaultelement: placedElements.map(pe => ({
          elementId: pe.elementId,
          x: pe.x.toString(),
          y: pe.y.toString()
        }))
      };

      const url = isEditing 
        ? `http://localhost:8000/api/v1/admin/map/${mapId}`
        : 'http://localhost:8000/api/v1/admin/map';
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mapData),
      });

      if (response.status === 401) {
        clearTokenData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Redirect back to admin panel
      router.push('/admin');
    } catch (err) {
      console.error('Error saving map:', err);
      setError('Failed to save map');
    } finally {
      setIsSaving(false);
    }
  };

  const handleElementDragStart = (element: Element) => {
    setDraggedElement(element);
  };

  const handleMapDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPlacedElement: PlacedElement = {
      id: `placed_${Date.now()}`,
      elementId: draggedElement.id,
      x: Math.max(0, Math.min(x - 25, mapWidth - 50)), // Center element and keep in bounds
      y: Math.max(0, Math.min(y - 25, mapHeight - 50)),
      element: draggedElement
    };

    setPlacedElements(prev => [...prev, newPlacedElement]);
    setDraggedElement(null);
  };

  const handleMapDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoverCoords({ x: Math.floor(x), y: Math.floor(y) });
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoverCoords({ x: Math.floor(x), y: Math.floor(y) });
  };

  const handleMapMouseLeave = () => {
    setHoverCoords(null);
  };

  const handlePlacedElementClick = (placedElement: PlacedElement) => {
    // Remove element when clicked
    setPlacedElements(prev => prev.filter(pe => pe.id !== placedElement.id));
  };

  if (isLoading) {
    return <LoadingScreen message={isEditing ? "Loading Map Editor" : "Preparing Map Editor"} />;
  }

  return (
    <ProtectedRoute requiredRole="Admin">
      <div className="h-screen bg-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/admin')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
              title="Back to Admin"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Map' : 'Create New Map'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
              className="bg-gray-100 hover:bg-gray-200 rounded-md p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title={isLeftSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={handleSaveMap}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-md transition-colors disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : (isEditing ? 'Update Map' : 'Create Map')}
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-100 border-b border-red-400 text-red-700 px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Map Properties */}
          {isLeftSidebarOpen && (
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Map Properties</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Map Name</label>
                    <input
                      type="text"
                      value={mapName}
                      onChange={(e) => setMapName(e.target.value)}
                      placeholder="Enter map name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                      <input
                        type="number"
                        value={mapWidth}
                        onChange={(e) => setMapWidth(Number(e.target.value))}
                        min="400"
                        max="2000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                      <input
                        type="number"
                        value={mapHeight}
                        onChange={(e) => setMapHeight(Number(e.target.value))}
                        min="300"
                        max="1500"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Instructions</h3>
                <div className="text-xs text-gray-600 space-y-2">
                  <p>• Drag elements from the right panel onto the map</p>
                  <p>• Click placed elements to remove them</p>
                  <p>• Adjust map dimensions above</p>
                  <p>• Save your changes when done</p>
                </div>
              </div>
            </div>
          )}

          {/* Center - Map Canvas */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div
                className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
                style={{ width: mapWidth, height: mapHeight }}
                onDrop={handleMapDrop}
                onDragOver={handleMapDragOver}
                onMouseMove={handleMapMouseMove}
                onMouseLeave={handleMapMouseLeave}
              >
                {/* Coordinate Tooltip */}
                {hoverCoords && (
                  <div
                    style={{
                      position: 'absolute',
                      left: Math.min(hoverCoords.x + 10, mapWidth - 60),
                      top: Math.min(hoverCoords.y + 10, mapHeight - 30),
                      pointerEvents: 'none',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      zIndex: 20,
                    }}
                  >
                    x: {hoverCoords.x}, y: {hoverCoords.y}
                  </div>
                )}
                {/* Grid Pattern */}
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                      linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                  }}
                />
                
                {/* Placed Elements */}
                {placedElements.map((placedElement) => (
                  <div
                    key={placedElement.id}
                    className="absolute cursor-pointer hover:ring-2 hover:ring-indigo-500 rounded"
                    style={{
                      left: placedElement.x,
                      top: placedElement.y,
                      width: 50,
                      height: 50
                    }}
                    onClick={() => handlePlacedElementClick(placedElement)}
                    title={`${placedElement.element.name} (click to remove)`}
                  >
                    <Image
                      src={placedElement.element.imageUrl}
                      alt={placedElement.element.name}
                      width={50}
                      height={50}
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                ))}
                
                {/* Drop Zone Indicator */}
                {draggedElement && (
                  <div className="absolute inset-0 bg-indigo-100 bg-opacity-50 flex items-center justify-center">
                    <p className="text-indigo-600 font-medium">Drop element here</p>
                  </div>
                )}
              </div>
              
              <div className="mt-2 text-center text-sm text-gray-500">
                {mapWidth} × {mapHeight} pixels
              </div>
            </div>
          </div>

          {/* Right Sidebar - Elements */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Elements</h2>
              <p className="text-sm text-gray-600">Drag elements onto the map</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingElements ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : elements.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No elements found</h3>
                  <p className="text-gray-500 text-xs">No elements are available in the database to add to your map.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {elements.map((element) => (
                    <div
                      key={element.id}
                      draggable
                      onDragStart={() => handleElementDragStart(element)}
                      className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 cursor-move transition-colors"
                      title={`Drag ${element.name} to map`}
                    >
                      <Image
                        src={element.imageUrl}
                        alt={element.name}
                        width={64}
                        height={64}
                        className="w-full h-16 object-cover rounded mb-2"
                      />
                      <h3 className="text-xs font-medium text-gray-900 truncate">{element.name}</h3>
                      <p className="text-xs text-gray-500">{element.type}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function MapEditorPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading Map Editor" />}>
      <MapEditorContent />
    </Suspense>
  );
}
