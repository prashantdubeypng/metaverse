"use client";
import React from 'react';
import Image from 'next/image';

// Types for space and elements
interface SpaceElement {
  id: string;
  elementId: string;
  x: number;
  y: number;
  static?: boolean;
  element: {
    id: string;
    width: number;
    height: number;
    imageUrl?: string;
    static?: boolean;
  };
}

interface Space {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: string | null;
}

interface User {
  id: string;
  username: string;
  x: number;
  y: number;
  isCurrentUser?: boolean;
}

interface SpaceViewerProps {
  space: Space;
  elements: SpaceElement[];
  users?: User[]; // Online users in the space
  currentUser?: User; // Current user (to highlight differently)
  onUserMove?: (x: number, y: number) => void; // Callback when user clicks to move
  scale?: number; // Scale factor for rendering (default 0.5)
  showGrid?: boolean; // Show grid lines
  interactive?: boolean; // Allow interactions
  className?: string;
}

const SpaceViewer: React.FC<SpaceViewerProps> = ({
  space,
  elements,
  users = [],
  currentUser,
  onUserMove,
  scale = 0.5,
  showGrid = true,
  interactive = false,
  className = ""
}) => {
  // Calculate scaled dimensions
  const scaledWidth = space.width * scale;
  const scaledHeight = space.height * scale;

  // Default center table dimensions (if no elements exist)
  const defaultTableWidth = 200;
  const defaultTableHeight = 200;
  const defaultTableX = (space.width - defaultTableWidth) / 2;
  const defaultTableY = (space.height - defaultTableHeight) / 2;

  const renderElement = (spaceElement: SpaceElement) => {
    const element = spaceElement.element;
    const scaledX = spaceElement.x * scale;
    const scaledY = spaceElement.y * scale;
    const scaledWidth = element.width * scale;
    const scaledHeight = element.height * scale;

    return (
      <div
        key={spaceElement.id}
        className={`absolute border-2 border-gray-400 bg-gradient-to-br from-amber-500 to-amber-700 rounded shadow-lg ${
          interactive ? 'hover:shadow-xl cursor-pointer transition-all duration-200' : ''
        }`}
        style={{
          left: `${scaledX}px`,
          top: `${scaledY}px`,
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
        title={`Element: ${element.id} (${element.width}x${element.height})`}
      >
        {/* Element image if available */}
        {element.imageUrl ? (
          <Image
            src={element.imageUrl}
            alt="Element"
            width={scaledWidth}
            height={scaledHeight}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          /* Default element appearance */
          <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
            {element.width}x{element.height}
          </div>
        )}
        
        {/* Element ID badge */}
        <div className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1 rounded">
          {spaceElement.elementId?.slice(0, 4) || spaceElement.element?.id?.slice(0, 4) || 'N/A'}
        </div>
      </div>
    );
  };

  const renderUser = (user: User) => {
    const scaledX = user.x * scale;
    const scaledY = user.y * scale;
    const avatarSize = 40 * scale; // Fixed avatar size
    const isCurrentUser = user.isCurrentUser || (currentUser && user.id === currentUser.id);

    return (
      <div
        key={user.id}
        className="absolute flex flex-col items-center pointer-events-none z-30"
        style={{
          left: `${scaledX - avatarSize / 2}px`, // Center the avatar
          top: `${scaledY - avatarSize / 2}px`,
          transform: 'translate(0, 0)', // Ensure precise positioning
        }}
      >
        {/* Username label */}
        <div className={`mb-1 px-2 py-1 rounded text-xs font-bold text-white shadow-lg ${
          isCurrentUser ? 'bg-green-600' : 'bg-blue-600'
        }`}>
          {user.username}
        </div>
        
        {/* Avatar */}
        <div
          className={`rounded-full border-4 shadow-lg transition-all duration-200 flex items-center justify-center ${
            isCurrentUser 
              ? 'bg-green-500 border-green-300 animate-pulse' 
              : 'bg-blue-500 border-blue-300'
          }`}
          style={{
            width: `${avatarSize}px`,
            height: `${avatarSize}px`,
          }}
        >
          {/* Simple avatar icon */}
          <svg 
            className="text-white" 
            width={avatarSize * 0.6} 
            height={avatarSize * 0.6} 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>

        {/* Movement indicator for current user */}
        {isCurrentUser && (
          <div className="absolute -bottom-2 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
        )}
      </div>
    );
  };

  const renderDefaultTable = () => {
    if (elements.length > 0) return null; // Don't show default table if elements exist

    const scaledX = defaultTableX * scale;
    const scaledY = defaultTableY * scale;
    const scaledWidth = defaultTableWidth * scale;
    const scaledHeight = defaultTableHeight * scale;

    return (
      <div
        className="absolute bg-gradient-to-br from-amber-600 to-amber-800 rounded-lg shadow-lg border-4 border-amber-900"
        style={{
          left: `${scaledX}px`,
          top: `${scaledY}px`,
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
      >
        {/* Table surface */}
        <div className="w-full h-full bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center">
          <div className="text-white font-bold text-sm opacity-70">
            Center Table
          </div>
        </div>
      </div>
    );
  };

  const renderGrid = () => {
    if (!showGrid) return null;

    const gridSize = 50 * scale; // Grid every 50 units
    const horizontalLines = Math.floor(scaledHeight / gridSize);
    const verticalLines = Math.floor(scaledWidth / gridSize);

    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Horizontal grid lines */}
        {Array.from({ length: horizontalLines + 1 }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute w-full border-t border-gray-300 opacity-30"
            style={{ top: `${i * gridSize}px` }}
          />
        ))}
        {/* Vertical grid lines */}
        {Array.from({ length: verticalLines + 1 }).map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute h-full border-l border-gray-300 opacity-30"
            style={{ left: `${i * gridSize}px` }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`relative bg-gray-100 ${className}`}>
      {/* Space container with walls */}
      <div
        className="relative bg-gradient-to-br from-gray-50 to-gray-200 border-8 border-gray-800 shadow-2xl cursor-crosshair"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
        onClick={(e) => {
          if (interactive && onUserMove) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            onUserMove(x, y);
          }
        }}
      >
        {/* Space name overlay */}
        <div className="absolute top-2 left-2 bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-semibold z-20">
          {space.name}
        </div>

        {/* Space dimensions overlay */}
        <div className="absolute top-2 right-2 bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-mono z-20">
          {space.width} × {space.height}
        </div>

        {/* Online users counter */}
        {users.length > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-semibold z-20 flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
            {users.length} user{users.length !== 1 ? 's' : ''} online
          </div>
        )}

        {/* Grid */}
        {renderGrid()}

        {/* Default center table (only if no elements) */}
        {renderDefaultTable()}

        {/* Space elements */}
        {elements.map(renderElement)}

        {/* Users */}
        {users.map(renderUser)}
        {currentUser && renderUser(currentUser)}

        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-4 h-4 bg-gray-900"></div>
        <div className="absolute top-0 right-0 w-4 h-4 bg-gray-900"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 bg-gray-900"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 bg-gray-900"></div>
      </div>

      {/* Space info panel */}
      <div className="mt-4 p-4 bg-white rounded-lg shadow border">
        <h3 className="font-bold text-lg mb-2">{space.name}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Dimensions:</span> {space.width} × {space.height}
          </div>
          <div>
            <span className="font-medium">Elements:</span> {elements.length}
          </div>
          <div>
            <span className="font-medium">Scale:</span> {Math.round(scale * 100)}%
          </div>
          <div>
            <span className="font-medium">Users Online:</span> {users.length + (currentUser ? 1 : 0)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpaceViewer;
