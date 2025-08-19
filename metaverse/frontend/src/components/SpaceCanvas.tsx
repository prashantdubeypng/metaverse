import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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

interface Space {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: SpaceElement[];
}

interface SpaceCanvasProps {
  space: Space;
}

const SpaceCanvas: React.FC<SpaceCanvasProps> = ({ space }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useAuth();
  
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Initialize canvas
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
  }, []);

  // Load images
  useEffect(() => {
    const imageMap = new Map<string, HTMLImageElement>();
    let loadedCount = 0;
    const totalImages = space.elements.length;

    if (totalImages === 0) {
      draw();
      return;
    }

    space.elements.forEach((element) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        imageMap.set(element.element.id, img);
        loadedCount++;
        
        if (loadedCount === totalImages) {
          setLoadedImages(imageMap);
        }
      };
      
      img.onerror = () => {
        // Create a placeholder image for failed loads
        const placeholderImg = new Image();
        placeholderImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIgc3Ryb2tlPSIjY2NjIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4=';
        imageMap.set(element.element.id, placeholderImg);
        loadedCount++;
        
        if (loadedCount === totalImages) {
          setLoadedImages(imageMap);
        }
      };
      
      img.src = element.element.imageurl;
    });
  }, [space.elements]);

  // Draw function
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    // Draw space boundary
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, space.width, space.height);

    // Draw elements
    space.elements.forEach((element) => {
      const img = loadedImages.get(element.element.id);
      if (img) {
        ctx.drawImage(
          img,
          element.x,
          element.y,
          element.element.width,
          element.element.height
        );

        // Draw element border (for admin)
        if (isAdmin) {
          ctx.strokeStyle = element.element.static ? '#ef4444' : '#10b981';
          ctx.lineWidth = 1 / camera.zoom;
          ctx.strokeRect(
            element.x,
            element.y,
            element.element.width,
            element.element.height
          );
        }
      }
    });

    // Restore context
    ctx.restore();
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 50;
    const startX = Math.floor(-camera.x / camera.zoom / gridSize) * gridSize;
    const startY = Math.floor(-camera.y / camera.zoom / gridSize) * gridSize;
    const endX = startX + (width / camera.zoom) + gridSize;
    const endY = startY + (height / camera.zoom) + gridSize;

    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 0.5 / camera.zoom;

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
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
  };

  // Redraw when camera or images change
  useEffect(() => {
    draw();
  }, [camera, loadedImages, space]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
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

  const handleDoubleClick = () => {
    // Reset camera to center the space
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = (canvas.width - space.width) / 2;
    const centerY = (canvas.height - space.height) / 2;

    setCamera({ x: centerX, y: centerY, zoom: 1 });
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen bg-gray-100 overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className="block"
      />
      
      {/* Loading overlay */}
      {loadedImages.size === 0 && space.elements.length > 0 && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading space elements...</p>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-20 left-4 bg-white rounded-lg shadow-lg p-2 space-y-2">
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
          onClick={handleDoubleClick}
          className="block w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-600 text-xs"
          title="Reset view"
        >
          ⌂
        </button>
      </div>
    </div>
  );
};

export default SpaceCanvas;