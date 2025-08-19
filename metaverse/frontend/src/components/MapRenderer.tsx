import React, { useRef, useEffect, useState, useCallback } from 'react';
import { apiService } from '../services/apiService';

interface MapElement {
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

interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string;
  elements: MapElement[];
}

interface MapRendererProps {
  mapId?: string;
  editable?: boolean;
  onElementClick?: (element: MapElement) => void;
  className?: string;
}

const MapRenderer: React.FC<MapRendererProps> = ({ 
  mapId, 
  editable = false, 
  onElementClick,
  className = "w-full h-96"
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [selectedElement, setSelectedElement] = useState<MapElement | null>(null);

  // Define resetCamera first since it's used by loadMap
  const resetCamera = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const centerX = (canvas.width - mapData.width) / 2;
    const centerY = (canvas.height - mapData.height) / 2;

    setCamera({ x: Math.max(0, centerX), y: Math.max(0, centerY), zoom: 1 });
  }, [mapData]);

  // Define drawGrid before draw function uses it
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 50;
    const startX = Math.floor(-camera.x / camera.zoom / gridSize) * gridSize;
    const startY = Math.floor(-camera.y / camera.zoom / gridSize) * gridSize;
    const endX = startX + (width / camera.zoom) + gridSize;
    const endY = startY + (height / camera.zoom) + gridSize;

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 0.5 / camera.zoom;

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startX);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }, [camera]);

  const loadMap = useCallback(async () => {
    if (!mapId) return;

    try {
      setLoading(true);
      setError('');
      const response = await apiService.getMapById(mapId);
      setMapData(response.map);
      
      // Reset camera to center the map
      setTimeout(() => {
        resetCamera();
      }, 100);
    } catch (err: any) {
      setError('Failed to load map');
      console.error('Load map error:', err);
    } finally {
      setLoading(false);
    }
  }, [mapId, resetCamera]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Apply camera transform
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw map boundary
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, mapData.width, mapData.height);

    // Draw map background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, mapData.width, mapData.height);

    // Draw elements
    mapData.elements.forEach((mapElement) => {
      const img = loadedImages.get(mapElement.element.id);
      if (img) {
        ctx.drawImage(
          img,
          mapElement.x,
          mapElement.y,
          mapElement.element.width,
          mapElement.element.height
        );

        // Draw element border
        const isSelected = selectedElement?.id === mapElement.id;
        if (editable || isSelected) {
          ctx.strokeStyle = isSelected 
            ? '#fbbf24' 
            : mapElement.element.static 
              ? '#ef4444' 
              : '#10b981';
          ctx.lineWidth = (isSelected ? 2 : 1) / camera.zoom;
          ctx.strokeRect(
            mapElement.x,
            mapElement.y,
            mapElement.element.width,
            mapElement.element.height
          );
        }
      }
    });

    // Restore context
    ctx.restore();
  }, [mapData, camera, loadedImages, editable, selectedElement, drawGrid]);

  useEffect(() => {
    if (mapId) {
      loadMap();
    } else {
      setMapData(null);
      setLoadedImages(new Map());
    }
  }, [mapId, loadMap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [draw]);

  useEffect(() => {
    if (!mapData?.elements.length) {
      setLoadedImages(new Map());
      return;
    }

    const imageMap = new Map<string, HTMLImageElement>();
    let loadedCount = 0;
    const totalImages = mapData.elements.length;

    mapData.elements.forEach((mapElement) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        imageMap.set(mapElement.element.id, img);
        loadedCount++;
        
        if (loadedCount === totalImages) {
          setLoadedImages(imageMap);
        }
      };
      
      img.onerror = () => {
        // Create a placeholder for failed loads
        const placeholderImg = new Image();
        placeholderImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIgc3Ryb2tlPSIjY2NjIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4=';
        imageMap.set(mapElement.element.id, placeholderImg);
        loadedCount++;
        
        if (loadedCount === totalImages) {
          setLoadedImages(imageMap);
        }
      };
      
      img.src = mapElement.element.imageurl;
    });
  }, [mapData?.elements]);

  const getElementAtPosition = (x: number, y: number): MapElement | null => {
    if (!mapData) return null;

    // Convert screen coordinates to world coordinates
    const worldX = (x - camera.x) / camera.zoom;
    const worldY = (y - camera.y) / camera.zoom;

    // Find element at position (check in reverse order for top element)
    for (let i = mapData.elements.length - 1; i >= 0; i--) {
      const element = mapData.elements[i];
      if (
        worldX >= element.x &&
        worldX <= element.x + element.element.width &&
        worldY >= element.y &&
        worldY <= element.y + element.element.height
      ) {
        return element;
      }
    }

    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on an element
    const clickedElement = getElementAtPosition(x, y);
    
    if (clickedElement) {
      setSelectedElement(clickedElement);
      onElementClick?.(clickedElement);
    } else {
      setSelectedElement(null);
      setIsDragging(true);
      setDragStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    setCamera({
      ...camera,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = 0.1;
    const newZoom = camera.zoom * (1 - Math.sign(e.deltaY) * zoomFactor);
    const clampedZoom = Math.max(0.1, Math.min(3, newZoom));

    // Zoom towards mouse position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomRatio = clampedZoom / camera.zoom;
      
      setCamera({
        x: mouseX - (mouseX - camera.x) * zoomRatio,
        y: mouseY - (mouseY - camera.y) * zoomRatio,
        zoom: clampedZoom
      });
    }
  };

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 rounded-lg border border-red-200`}>
        <div className="text-center">
          <svg className="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!mapId || !mapData) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300`}>
        <div className="text-center">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-gray-500">Select a map to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-gray-100 rounded-lg overflow-hidden`}>
      <div ref={containerRef} className="w-full h-full">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={resetCamera}
          className="block cursor-grab active:cursor-grabbing"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        />
      </div>

      {/* Map Info */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3">
        <h3 className="font-semibold text-gray-900">{mapData.name}</h3>
        <p className="text-sm text-gray-600">
          {mapData.width} × {mapData.height}px
        </p>
        <p className="text-sm text-gray-600">
          {mapData.elements.length} elements
        </p>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 space-y-2">
        <button
          onClick={() => setCamera({ ...camera, zoom: Math.min(3, camera.zoom * 1.2) })}
          className="block w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-600"
        >
          +
        </button>
        <div className="text-xs text-center text-gray-500 px-1">
          {Math.round(camera.zoom * 100)}%
        </div>
        <button
          onClick={() => setCamera({ ...camera, zoom: Math.max(0.1, camera.zoom / 1.2) })}
          className="block w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-600"
        >
          −
        </button>
        <button
          onClick={resetCamera}
          className="block w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-600 text-xs"
          title="Reset view"
        >
          ⌂
        </button>
      </div>

      {/* Element Info (when selected) */}
      {selectedElement && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
          <h4 className="font-semibold text-gray-900">Selected Element</h4>
          <p className="text-sm text-gray-600">
            Position: ({selectedElement.x}, {selectedElement.y})
          </p>
          <p className="text-sm text-gray-600">
            Size: {selectedElement.element.width} × {selectedElement.element.height}px
          </p>
          <p className="text-sm text-gray-600">
            Type: {selectedElement.element.static ? 'Static' : 'Dynamic'}
          </p>
        </div>
      )}

      {/* Loading Overlay for Images */}
      {loadedImages.size === 0 && mapData.elements.length > 0 && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map elements...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapRenderer;
