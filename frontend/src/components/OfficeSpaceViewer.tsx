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

interface OfficeSpaceViewerProps {
  space: Space;
  elements: SpaceElement[];
  users?: User[];
  currentUser?: User;
  onUserMove?: (x: number, y: number) => void;
  scale?: number;
  showGrid?: boolean;
  interactive?: boolean;
  className?: string;
}

interface Desk {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  color: string;
  wallColor: string;
  isOpen?: boolean;
}

const OfficeSpaceViewer: React.FC<OfficeSpaceViewerProps> = ({
  space,
  elements,
  users = [],
  currentUser,
  onUserMove,
  scale = 0.4,
  showGrid = true,
  interactive = false,
  className = ""
}) => {
  // Debug logging
  console.log('🏢 OfficeSpaceViewer props:', { 
    users: users.length, 
    userDetails: users.map(u => ({ id: u.id, username: u.username, x: u.x, y: u.y, isCurrentUser: u.isCurrentUser })),
    currentUser: currentUser?.username,
    interactive,
    spaceSize: { width: space.width, height: space.height }
  });

  // Auto-focus the office space for keyboard input
  React.useEffect(() => {
    if (interactive) {
      // Focus the office space so it can receive keyboard events
      const officeElement = document.getElementById('office-space-container');
      if (officeElement) {
        officeElement.focus();
        console.log('🎯 Office space focused for keyboard input');
      }
    }
  }, [interactive]);

  // Use full screen dimensions for realistic office layout
  const fullWidth = Math.max(space.width, 2000);
  const fullHeight = Math.max(space.height, 1400);
  
  // Calculate scaled dimensions
  const scaledWidth = fullWidth * scale;
  const scaledHeight = fullHeight * scale;

  // Office Layout Configuration
  const TILE_SIZE = 20;
  const WALL_THICKNESS = 12;
  const DOOR_WIDTH = 48;

  // Realistic room layout with corridors and natural spacing
  const rooms: Record<string, Room> = {
    // Open working area in center
    workingHall: {
      x: 200, y: 150, width: 700, height: 500,
      name: "Open Working Area",
      color: "bg-gray-50",
      wallColor: "border-gray-400",
      isOpen: true
    },
    
    // Private offices around perimeter
    managerRoom: {
      x: 50, y: 50, width: 140, height: 120,
      name: "Manager Office",
      color: "bg-blue-50",
      wallColor: "border-blue-400"
    },
    
    // Meeting rooms with glass effect
    meetingRoom1: {
      x: 950, y: 50, width: 160, height: 140,
      name: "Meeting Room 1",
      color: "bg-green-50",
      wallColor: "border-green-400"
    },
    meetingRoom2: {
      x: 950, y: 220, width: 160, height: 140,
      name: "Meeting Room 2", 
      color: "bg-green-50",
      wallColor: "border-green-400"
    },
    meetingRoom3: {
      x: 950, y: 390, width: 160, height: 140,
      name: "Conference Room",
      color: "bg-green-50", 
      wallColor: "border-green-400"
    },
    
    // Entertainment and relaxation areas
    gamingRoom: {
      x: 50, y: 200, width: 140, height: 160,
      name: "Gaming Lounge",
      color: "bg-purple-50",
      wallColor: "border-purple-400"
    },
    musicRoom: {
      x: 50, y: 390, width: 140, height: 120,
      name: "Music Studio",
      color: "bg-yellow-50",
      wallColor: "border-yellow-400"
    },
    
    // Social areas
    diningRoom: {
      x: 200, y: 700, width: 400, height: 200,
      name: "Cafeteria",
      color: "bg-orange-50",
      wallColor: "border-orange-400"
    },
    meditationRoom: {
      x: 650, y: 700, width: 180, height: 180,
      name: "Wellness Room",
      color: "bg-teal-50", 
      wallColor: "border-teal-400"
    },
    
    // Additional utility areas
    libraryRoom: {
      x: 950, y: 560, width: 160, height: 140,
      name: "Library",
      color: "bg-indigo-50",
      wallColor: "border-indigo-400"
    }
  };

  // Generate realistic desk layout for open working area
  const generateWorkingHallDesks = (): Desk[] => {
    const desks: Desk[] = [];
    const room = rooms.workingHall;
    
    // Create clusters of desks with natural spacing
    const clusters = [
      // Left cluster
      { startX: room.x + 50, startY: room.y + 50, rows: 3, cols: 4 },
      // Center cluster  
      { startX: room.x + 300, startY: room.y + 50, rows: 3, cols: 4 },
      // Right cluster
      { startX: room.x + 550, startY: room.y + 50, rows: 3, cols: 4 },
      // Back area
      { startX: room.x + 150, startY: room.y + 300, rows: 2, cols: 6 }
    ];

    let deskId = 1;
    clusters.forEach(cluster => {
      for (let row = 0; row < cluster.rows; row++) {
        for (let col = 0; col < cluster.cols; col++) {
          if (deskId <= 20) { // Limit to 20 desks
            desks.push({
              id: deskId++,
              x: cluster.startX + col * 120,
              y: cluster.startY + row * 140,
              width: 80,
              height: 50
            });
          }
        }
      }
    });
    
    return desks;
  };

  const workingHallDesks = generateWorkingHallDesks();

  // Handle click events for movement
  const handleSpaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onUserMove) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / scale / TILE_SIZE) * TILE_SIZE;
    const y = Math.floor((event.clientY - rect.top) / scale / TILE_SIZE) * TILE_SIZE;
    
    // Ensure movement within bounds
    if (x >= 0 && x < fullWidth && y >= 0 && y < fullHeight) {
      console.log('🖱️ Click to move:', { x, y });
      onUserMove(x, y);
    }
  };

  // Render room walls and structure
  const renderRoom = (roomKey: string, room: Room) => (
    <div key={roomKey}>
      {/* Room background */}
      <div
        className={`absolute ${room.color} ${room.wallColor} border-2 rounded-lg shadow-lg`}
        style={{
          left: `${room.x * scale}px`,
          top: `${room.y * scale}px`,
          width: `${room.width * scale}px`,
          height: `${room.height * scale}px`,
        }}
      />
      
      {/* Room label */}
      <div
        className="absolute text-xs font-semibold text-gray-700 pointer-events-none"
        style={{
          left: `${(room.x + room.width / 2) * scale - 30}px`,
          top: `${(room.y + 10) * scale}px`,
          zIndex: 10
        }}
      >
        {room.name}
      </div>

      {/* Door indicator */}
      <div
        className="absolute bg-white border-2 border-gray-400"
        style={{
          left: `${(room.x + room.width / 2 - DOOR_WIDTH / 2) * scale}px`,
          top: `${(room.y + room.height) * scale}px`,
          width: `${DOOR_WIDTH * scale}px`,
          height: `${WALL_THICKNESS * scale}px`,
        }}
      />
    </div>
  );

  // Render furniture for different room types
  const renderRoomFurniture = (roomKey: string) => {
    const room = rooms[roomKey];
    if (!room) return null;

    const furnitureItems = [];

    switch (roomKey) {
      case 'managerRoom':
        // Executive desk and chair
        furnitureItems.push(
          <div key="manager-desk" className="absolute bg-amber-800 rounded shadow" 
               style={{ left: `${(room.x + 40) * scale}px`, top: `${(room.y + 50) * scale}px`, 
                       width: `${80 * scale}px`, height: `${50 * scale}px` }} />,
          <div key="manager-chair" className="absolute bg-red-600 rounded-full shadow" 
               style={{ left: `${(room.x + 60) * scale}px`, top: `${(room.y + 110) * scale}px`, 
                       width: `${30 * scale}px`, height: `${30 * scale}px` }} />
        );
        break;

      case 'meetingRoom1':
      case 'meetingRoom2':
      case 'meetingRoom3':
        // Conference table and chairs
        furnitureItems.push(
          <div key="meeting-table" className="absolute bg-amber-700 rounded-lg shadow" 
               style={{ left: `${(room.x + 30) * scale}px`, top: `${(room.y + 40) * scale}px`, 
                       width: `${100 * scale}px`, height: `${60 * scale}px` }} />
        );
        // Add chairs around table
        const chairPositions = [
          { x: room.x + 20, y: room.y + 55 }, { x: room.x + 140, y: room.y + 55 },
          { x: room.x + 45, y: room.y + 25 }, { x: room.x + 115, y: room.y + 25 },
          { x: room.x + 45, y: room.y + 115 }, { x: room.x + 115, y: room.y + 115 }
        ];
        chairPositions.forEach((pos, idx) => {
          furnitureItems.push(
            <div key={`chair-${idx}`} className="absolute bg-blue-600 rounded-full shadow" 
                 style={{ left: `${pos.x * scale}px`, top: `${pos.y * scale}px`, 
                         width: `${25 * scale}px`, height: `${25 * scale}px` }} />
          );
        });
        break;

      case 'gamingRoom':
        // Gaming stations
        furnitureItems.push(
          <div key="gaming-setup1" className="absolute bg-gray-800 rounded shadow" 
               style={{ left: `${(room.x + 20) * scale}px`, top: `${(room.y + 40) * scale}px`, 
                       width: `${50 * scale}px`, height: `${40 * scale}px` }} />,
          <div key="gaming-setup2" className="absolute bg-gray-800 rounded shadow" 
               style={{ left: `${(room.x + 80) * scale}px`, top: `${(room.y + 40) * scale}px`, 
                       width: `${50 * scale}px`, height: `${40 * scale}px` }} />,
          <div key="gaming-couch" className="absolute bg-red-700 rounded shadow" 
               style={{ left: `${(room.x + 30) * scale}px`, top: `${(room.y + 100) * scale}px`, 
                       width: `${80 * scale}px`, height: `${40 * scale}px` }} />
        );
        break;

      case 'musicRoom':
        // Piano and equipment
        furnitureItems.push(
          <div key="piano" className="absolute bg-gray-900 rounded shadow" 
               style={{ left: `${(room.x + 40) * scale}px`, top: `${(room.y + 40) * scale}px`, 
                       width: `${60 * scale}px`, height: `${40 * scale}px` }} />,
          <div key="mic-stand" className="absolute bg-gray-600 rounded-full shadow" 
               style={{ left: `${(room.x + 80) * scale}px`, top: `${(room.y + 90) * scale}px`, 
                       width: `${15 * scale}px`, height: `${15 * scale}px` }} />
        );
        break;

      case 'diningRoom':
        // Large dining table
        furnitureItems.push(
          <div key="dining-table" className="absolute bg-amber-700 rounded-lg shadow" 
               style={{ left: `${(room.x + 80) * scale}px`, top: `${(room.y + 60) * scale}px`, 
                       width: `${240 * scale}px`, height: `${80 * scale}px` }} />
        );
        // Dining chairs
        const diningChairs = [
          { x: room.x + 60, y: room.y + 80 }, { x: room.x + 340, y: room.y + 80 },
          { x: room.x + 100, y: room.y + 40 }, { x: room.x + 150, y: room.y + 40 },
          { x: room.x + 200, y: room.y + 40 }, { x: room.x + 250, y: room.y + 40 },
          { x: room.x + 300, y: room.y + 40 }, { x: room.x + 100, y: room.y + 160 },
          { x: room.x + 150, y: room.y + 160 }, { x: room.x + 200, y: room.y + 160 },
          { x: room.x + 250, y: room.y + 160 }, { x: room.x + 300, y: room.y + 160 }
        ];
        diningChairs.forEach((pos, idx) => {
          furnitureItems.push(
            <div key={`dining-chair-${idx}`} className="absolute bg-amber-600 rounded shadow" 
                 style={{ left: `${pos.x * scale}px`, top: `${pos.y * scale}px`, 
                         width: `${25 * scale}px`, height: `${25 * scale}px` }} />
          );
        });
        break;

      case 'meditationRoom':
        // Meditation mats and plants
        const mats = [
          { x: room.x + 40, y: room.y + 50 }, { x: room.x + 100, y: room.y + 50 },
          { x: room.x + 40, y: room.y + 100 }, { x: room.x + 100, y: room.y + 100 }
        ];
        mats.forEach((pos, idx) => {
          furnitureItems.push(
            <div key={`mat-${idx}`} className="absolute bg-purple-600 rounded shadow" 
                 style={{ left: `${pos.x * scale}px`, top: `${pos.y * scale}px`, 
                         width: `${35 * scale}px`, height: `${35 * scale}px` }} />
          );
        });
        
        // Add plants
        const plants = [
          { x: room.x + 20, y: room.y + 30 }, { x: room.x + 140, y: room.y + 30 },
          { x: room.x + 20, y: room.y + 130 }, { x: room.x + 140, y: room.y + 130 }
        ];
        plants.forEach((pos, idx) => {
          furnitureItems.push(
            <div key={`plant-${idx}`} className="absolute bg-green-500 rounded-full shadow" 
                 style={{ left: `${pos.x * scale}px`, top: `${pos.y * scale}px`, 
                         width: `${20 * scale}px`, height: `${20 * scale}px` }} />
          );
        });
        break;

      case 'libraryRoom':
        // Bookshelves and reading table
        furnitureItems.push(
          <div key="bookshelf1" className="absolute bg-amber-900 shadow" 
               style={{ left: `${(room.x + 20) * scale}px`, top: `${(room.y + 30) * scale}px`, 
                       width: `${15 * scale}px`, height: `${80 * scale}px` }} />,
          <div key="bookshelf2" className="absolute bg-amber-900 shadow" 
               style={{ left: `${(room.x + 125) * scale}px`, top: `${(room.y + 30) * scale}px`, 
                       width: `${15 * scale}px`, height: `${80 * scale}px` }} />,
          <div key="reading-table" className="absolute bg-amber-700 rounded shadow" 
               style={{ left: `${(room.x + 60) * scale}px`, top: `${(room.y + 70) * scale}px`, 
                       width: `${40 * scale}px`, height: `${30 * scale}px` }} />
        );
        break;
    }

    return <div key={`furniture-${roomKey}`}>{furnitureItems}</div>;
  };

  // Render working hall desks with laptops
  const renderWorkingHallDesks = () => {
    return workingHallDesks.map((desk) => (
      <div key={`desk-${desk.id}`}>
        {/* Desk */}
        <div
          className="absolute bg-amber-800 border border-amber-700 rounded shadow-md"
          style={{
            left: `${desk.x * scale}px`,
            top: `${desk.y * scale}px`,
            width: `${desk.width * scale}px`,
            height: `${desk.height * scale}px`,
          }}
        />
        
        {/* Laptop on desk */}
        <div
          className="absolute bg-gray-800 border border-gray-600 rounded shadow"
          style={{
            left: `${(desk.x + 25) * scale}px`,
            top: `${(desk.y + 15) * scale}px`,
            width: `${30 * scale}px`,
            height: `${20 * scale}px`,
          }}
        />
        
        {/* Chair */}
        <div
          className="absolute bg-blue-600 border border-blue-500 rounded-full shadow"
          style={{
            left: `${(desk.x + 25) * scale}px`,
            top: `${(desk.y + 70) * scale}px`,
            width: `${30 * scale}px`,
            height: `${30 * scale}px`,
          }}
        />
      </div>
    ));
  };

  // Render corridors for natural movement
  const renderCorridors = () => (
    <div>
      {/* Main horizontal corridor */}
      <div
        className="absolute bg-gray-100 border-t border-b border-gray-300"
        style={{
          left: `${0}px`,
          top: `${680 * scale}px`,
          width: `${fullWidth * scale}px`,
          height: `${40 * scale}px`,
        }}
      />
      
      {/* Vertical corridor on right */}
      <div
        className="absolute bg-gray-100 border-l border-r border-gray-300"
        style={{
          left: `${920 * scale}px`,
          top: `${0}px`,
          width: `${40 * scale}px`,
          height: `${680 * scale}px`,
        }}
      />
      
      {/* Entrance area */}
      <div
        className="absolute bg-gray-200 border border-gray-400 rounded-lg"
        style={{
          left: `${50 * scale}px`,
          top: `${650 * scale}px`,
          width: `${100 * scale}px`,
          height: `${60 * scale}px`,
        }}
      />
    </div>
  );

  // Render all users with human-like avatars
  const renderUsers = () => {
    console.log('👥 Rendering users:', users.map(u => ({ id: u.id, username: u.username, x: u.x, y: u.y })));
    
    return users.map((user) => (
      <div
        key={user.id}
        className={`absolute z-20 transition-all duration-200 ${
          user.isCurrentUser ? 'ring-2 ring-yellow-400' : ''
        }`}
        style={{
          left: `${user.x * scale}px`,
          top: `${user.y * scale}px`,
          width: `${24 * scale}px`,
          height: `${32 * scale}px`, // Taller for human proportions
        }}
      >
        {/* Username label above avatar */}
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap font-semibold shadow-lg">
          {user.username}
          {user.isCurrentUser && ' (You)'}
        </div>
        
        {/* Human-like avatar */}
        <div className="relative w-full h-full">
          {/* Head */}
          <div
            className={`absolute rounded-full border-2 shadow-md ${
              user.isCurrentUser 
                ? 'bg-blue-300 border-blue-500' 
                : 'bg-amber-300 border-amber-500'
            }`}
            style={{
              top: '0px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${12 * scale}px`,
              height: `${12 * scale}px`,
            }}
          >
            {/* Face features */}
            <div className="relative w-full h-full">
              {/* Eyes */}
              <div className="absolute flex space-x-1" 
                   style={{ 
                     top: '30%', 
                     left: '50%', 
                     transform: 'translateX(-50%)',
                     fontSize: `${6 * scale}px`
                   }}>
                <div className="w-1 h-1 bg-black rounded-full"></div>
                <div className="w-1 h-1 bg-black rounded-full"></div>
              </div>
              {/* Smile */}
              <div className="absolute text-black" 
                   style={{ 
                     bottom: '25%', 
                     left: '50%', 
                     transform: 'translateX(-50%)',
                     fontSize: `${4 * scale}px`,
                     lineHeight: 1
                   }}>
                😊
              </div>
            </div>
          </div>
          
          {/* Body */}
          <div
            className={`absolute rounded-lg border shadow-sm ${
              user.isCurrentUser 
                ? 'bg-blue-500 border-blue-600' 
                : 'bg-green-500 border-green-600'
            }`}
            style={{
              top: `${10 * scale}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${16 * scale}px`,
              height: `${16 * scale}px`,
            }}
          >
            {/* Shirt details */}
            <div className="absolute inset-x-0 top-1 flex justify-center">
              <div className="w-1 h-3 bg-white bg-opacity-30 rounded-full"></div>
            </div>
          </div>
          
          {/* Arms */}
          <div
            className={`absolute rounded-full ${
              user.isCurrentUser 
                ? 'bg-blue-400' 
                : 'bg-green-400'
            }`}
            style={{
              top: `${12 * scale}px`,
              left: `${2 * scale}px`,
              width: `${4 * scale}px`,
              height: `${10 * scale}px`,
            }}
          />
          <div
            className={`absolute rounded-full ${
              user.isCurrentUser 
                ? 'bg-blue-400' 
                : 'bg-green-400'
            }`}
            style={{
              top: `${12 * scale}px`,
              right: `${2 * scale}px`,
              width: `${4 * scale}px`,
              height: `${10 * scale}px`,
            }}
          />
          
          {/* Legs */}
          <div
            className={`absolute rounded-full ${
              user.isCurrentUser 
                ? 'bg-blue-700' 
                : 'bg-green-700'
            }`}
            style={{
              bottom: '0px',
              left: `${6 * scale}px`,
              width: `${4 * scale}px`,
              height: `${8 * scale}px`,
            }}
          />
          <div
            className={`absolute rounded-full ${
              user.isCurrentUser 
                ? 'bg-blue-700' 
                : 'bg-green-700'
            }`}
            style={{
              bottom: '0px',
              right: `${6 * scale}px`,
              width: `${4 * scale}px`,
              height: `${8 * scale}px`,
            }}
          />
          
          {/* Online status indicator */}
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 border border-white rounded-full shadow"></div>
        </div>
      </div>
    ));
  };

  return (
    <div className={`relative bg-green-100 overflow-hidden ${className}`}>
      {/* Outdoor/Garden area background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-green-200 to-green-300"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
      />
      
      {/* Trees and outdoor elements */}
      <div className="absolute">
        {[...Array(15)].map((_, i) => (
          <div
            key={`tree-${i}`}
            className="absolute bg-green-700 rounded-full shadow-lg"
            style={{
              left: `${(Math.random() * 1800 + 100) * scale}px`,
              top: `${(Math.random() * 100 + 50) * scale}px`,
              width: `${(30 + Math.random() * 20) * scale}px`,
              height: `${(30 + Math.random() * 20) * scale}px`,
            }}
          />
        ))}
      </div>
      
      {/* Main office building */}
      <div
        id="office-space-container"
        className="absolute bg-white border-4 border-gray-400 rounded-lg shadow-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        onClick={handleSpaceClick}
        tabIndex={interactive ? 0 : -1}
        onFocus={() => console.log('🎯 Office space focused for keyboard input')}
        style={{
          left: `${40 * scale}px`,
          top: `${40 * scale}px`,
          width: `${1080 * scale}px`,
          height: `${900 * scale}px`,
          cursor: interactive ? 'crosshair' : 'default',
          outline: 'none'
        }}
      >
        {/* Grid overlay */}
        {showGrid && (
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #666 1px, transparent 1px),
                linear-gradient(to bottom, #666 1px, transparent 1px)
              `,
              backgroundSize: `${TILE_SIZE * scale}px ${TILE_SIZE * scale}px`
            }}
          />
        )}
        
        {/* Render all rooms */}
        {Object.entries(rooms).map(([key, room]) => renderRoom(key, room))}
        
        {/* Render corridors */}
        {renderCorridors()}
        
        {/* Render furniture for each room */}
        {Object.keys(rooms).map(roomKey => renderRoomFurniture(roomKey))}
        
        {/* Render working hall desks */}
        {renderWorkingHallDesks()}
        
        {/* Render users */}
        {renderUsers()}
        
        {/* Space elements (if any) */}
        {elements.map((element) => (
          <div
            key={element.id}
            className="absolute border border-gray-400 bg-gray-200 rounded shadow"
            style={{
              left: `${element.x * scale}px`,
              top: `${element.y * scale}px`,
              width: `${element.element.width * scale}px`,
              height: `${element.element.height * scale}px`,
              zIndex: element.element.static ? 1 : 5
            }}
          >
            {element.element.imageUrl && (
              <Image
                src={element.element.imageUrl}
                alt="Element"
                fill
                className="object-cover rounded"
              />
            )}
          </div>
        ))}
      </div>
      
      {/* Debug info */}
      {users.length === 0 && (
        <div className="absolute top-4 left-4 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded">
          No users found. Check WebSocket connection.
        </div>
      )}
    </div>
  );
};

export default OfficeSpaceViewer;