import { WebSocketServer } from 'ws';
import { User } from './User';
import { Roommanager } from './Roommanager';
import { WS_PORT } from './config';
import { startHealthServer } from './healthServer';

const wss = new WebSocketServer({ 
  port: WS_PORT,
  perMessageDeflate: false // Disable compression for better performance
});

console.log(`WebSocket server starting on port ${WS_PORT}...`);

// Start health monitoring server
startHealthServer();

// Server event handlers
wss.on('listening', () => {
  console.log(`✅ WebSocket server running on port ${WS_PORT}`);
  console.log(`🌐 Ready to handle metaverse connections`);
});

wss.on('error', (error) => {
  console.error('❌ WebSocket server error:', error);
});

// Connection handler
wss.on('connection', function connection(ws, request) {
  const clientIP = request.socket.remoteAddress;
  console.log(`🔗 New WebSocket connection from ${clientIP}`);
  
  let user: User | null = null;
  
  try {
    user = new User(ws);
    user.initHandlers();
    
    console.log(`👤 User ${user.id} connected`);
  } catch (error) {
    console.error('❌ Error initializing user:', error);
    ws.close(1011, 'Server error during initialization');
    return;
  }
  
  // Handle connection errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for user ${user?.id}:`, error);
  });
  
  // Handle connection close
  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket connection closed for user ${user?.id}. Code: ${code}, Reason: ${reason.toString()}`);
    if (user) {
      user.destroy();
      user = null;
    }
  });
});

// Periodic cleanup and health monitoring
const CLEANUP_INTERVAL = 30000; // 30 seconds
const STATS_INTERVAL = 60000; // 1 minute

setInterval(() => {
  try {
    // Cleanup disconnected users
    Roommanager.getInstance().cleanupDisconnectedUsers();
    
    // Ping all connected users for heartbeat
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    });
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}, CLEANUP_INTERVAL);

// Periodic stats logging
setInterval(() => {
  try {
    const stats = Roommanager.getInstance().getStats();
    console.log(`📊 Server Stats: ${stats.totalUsers} users across ${stats.totalSpaces} spaces`);
    
    if (stats.spacesWithUsers.length > 0) {
      console.log(`🏢 Active Spaces:`, stats.spacesWithUsers);
    }
  } catch (error) {
    console.error('❌ Error getting stats:', error);
  }
}, STATS_INTERVAL);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  gracefulShutdown();
});

function gracefulShutdown(): void {
  console.log('🛑 Closing WebSocket server...');
  
  // Close all client connections
  wss.clients.forEach((ws) => {
    ws.close(1001, 'Server shutting down');
  });
  
  // Close the server
  wss.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.log('⏰ Force closing server after timeout');
    process.exit(1);
  }, 5000);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});