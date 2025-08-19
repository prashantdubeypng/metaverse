# Frontend Setup Guide

This guide explains how to set up and run the React frontend for the Metaverse application.

## Prerequisites

- Node.js 16+ and npm/yarn
- Backend services running (HTTP, Chat, Kafka services)
- PostgreSQL database with proper schema

## Installation

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Environment Configuration:**
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

Edit `.env` file:
```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_CHAT_SERVICE_URL=http://localhost:3002
NODE_ENV=development
REACT_APP_ENABLE_CHAT=true
REACT_APP_ENABLE_ADMIN_PANEL=true
```

3. **Start the development server:**
```bash
npm start
```

The application will open at `http://localhost:3000`.

## Features

### 🔐 Authentication
- User registration and login
- JWT token-based authentication
- Role-based access (User/Admin)
- Protected routes

### 🏠 Dashboard
- View all available spaces
- Create new spaces (Admin only)
- Join existing spaces
- Manage owned spaces

### 🌍 Space Viewer
- Interactive 2D canvas for space exploration
- Zoom and pan controls
- Element visualization
- Real-time user presence

### 💬 Real-time Chat
- WebSocket-based messaging
- Multiple chatrooms per space
- Create public/private chatrooms
- Typing indicators
- Message history
- User presence tracking

### ⚙️ Admin Panel
- Create and manage elements
- Create and manage avatars
- System administration tools

## Architecture

### Component Structure
```
src/
├── components/          # Reusable UI components
│   ├── ChatPanel.tsx   # Chat interface
│   ├── ChatRoom.tsx    # Individual chat room
│   ├── Navbar.tsx      # Navigation bar
│   └── ...
├── contexts/           # React contexts
│   ├── AuthContext.tsx # Authentication state
│   └── ChatContext.tsx # Chat state management
├── pages/              # Page components
│   ├── Login.tsx       # Login page
│   ├── Dashboard.tsx   # Main dashboard
│   ├── SpaceView.tsx   # Space viewer
│   └── AdminPanel.tsx  # Admin interface
├── services/           # API services
│   ├── apiService.ts   # HTTP API client
│   └── chatService.ts  # WebSocket chat client
└── App.tsx            # Main app component
```

### State Management
- **AuthContext**: User authentication, login/logout
- **ChatContext**: Chat connections, messages, rooms
- **Local State**: Component-specific state with useState/useEffect

### API Integration
- **REST API**: HTTP service for CRUD operations
- **WebSocket**: Real-time chat and presence
- **Axios**: HTTP client with interceptors
- **Socket.IO**: WebSocket client for chat

## Key Components

### AuthContext
Manages user authentication state:
```typescript
const { user, login, logout, isAuthenticated, isAdmin } = useAuth();
```

### ChatContext
Manages chat functionality:
```typescript
const { 
  isConnected, 
  messages, 
  joinRoom, 
  sendMessage,
  chatrooms 
} = useChat();
```

### ApiService
Centralized HTTP API client:
```typescript
// Login
await apiService.login(username, password);

// Get spaces
const spaces = await apiService.getSpaces();

// Create chatroom
await apiService.createChatroom(spaceId, name, description);
```

### ChatService
WebSocket chat client:
```typescript
// Connect to chat
chatService.connect(token);

// Join room
chatService.joinRoom(roomId);

// Send message
chatService.sendMessage('Hello world!');
```

## Styling

### Tailwind CSS
The application uses Tailwind CSS for styling:
- Utility-first CSS framework
- Responsive design
- Custom color palette
- Component classes in App.css

### Custom Styles
Additional styles in `App.css`:
- Chat-specific styles
- Animation utilities
- Form components
- Loading states

## Development

### Running in Development
```bash
npm start
```

### Building for Production
```bash
npm run build
```

### Testing
```bash
npm test
```

## API Endpoints Used

### Authentication
- `POST /api/v1/login` - User login
- `POST /api/v1/signup` - User registration

### Spaces
- `GET /api/v1/space/all` - Get all spaces
- `POST /api/v1/space` - Create space
- `GET /api/v1/space/:id` - Get space details
- `DELETE /api/v1/space/:id` - Delete space

### Chat
- `GET /api/v1/chatroom/rooms` - Get chatrooms
- `POST /api/v1/chatroom/create` - Create chatroom
- `POST /api/v1/chatroom/join` - Join chatroom
- `GET /api/v1/messages` - Get message history

### Admin
- `GET /api/v1/elements` - Get elements
- `POST /api/v1/admin/element` - Create element
- `GET /api/v1/avatars` - Get avatars
- `POST /api/v1/admin/avatar` - Create avatar

## WebSocket Events

### Client to Server
- `join-room` - Join a chatroom
- `leave-room` - Leave a chatroom
- `send-message` - Send a message
- `typing` - Start typing indicator
- `stop-typing` - Stop typing indicator

### Server to Client
- `receive-message` - New message received
- `recent-messages` - Message history on join
- `user-joined` - User joined room
- `user-left` - User left room
- `user-typing` - User is typing
- `user-stop-typing` - User stopped typing

## Error Handling

### API Errors
- Automatic token refresh on 401
- Error boundaries for component crashes
- User-friendly error messages
- Retry mechanisms for failed requests

### Chat Errors
- Connection failure handling
- Automatic reconnection
- Message delivery confirmation
- Offline state management

## Performance Optimizations

### Code Splitting
- Route-based code splitting with React.lazy()
- Component lazy loading for large components

### Caching
- API response caching with React Query (future enhancement)
- Local storage for user preferences
- Session storage for temporary data

### WebSocket Optimization
- Connection pooling
- Message batching
- Automatic reconnection with exponential backoff

## Security

### Authentication
- JWT tokens with expiration
- Secure token storage
- Automatic logout on token expiration

### API Security
- CORS configuration
- Request/response validation
- XSS protection with proper escaping

### Chat Security
- Message sanitization
- Rate limiting (server-side)
- User permission validation

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend CORS is configured for frontend URL
   - Check that API_URL in .env is correct

2. **WebSocket Connection Failed**
   - Verify chat service is running on correct port
   - Check CHAT_SERVICE_URL in .env
   - Ensure JWT token is valid

3. **Build Errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check TypeScript errors: `npm run build`

4. **Styling Issues**
   - Ensure Tailwind CSS is properly configured
   - Check PostCSS configuration
   - Verify CSS imports in index.css

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
REACT_APP_DEBUG=true
```

## Deployment

### Environment Variables for Production
```env
REACT_APP_API_URL=https://api.yourmetaverse.com
REACT_APP_CHAT_SERVICE_URL=https://chat.yourmetaverse.com
NODE_ENV=production
```

### Build and Deploy
```bash
npm run build
# Deploy the build/ folder to your hosting service
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

This frontend provides a complete, production-ready interface for your metaverse application with real-time chat, space management, and admin capabilities.