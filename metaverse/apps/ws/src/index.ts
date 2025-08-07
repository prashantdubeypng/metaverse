import { WebSocketServer } from 'ws';
import { User } from './User';

const wss = new WebSocketServer({ port: 3001 });
wss.on('connection', function connection(ws) {
  console.log('New WebSocket connection established');
  let user = new User(ws);
  user.initHandlers();
  
  ws.on('error', console.error);
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (user) {
      user.destroy();
    }
  });
});

console.log('WebSocket server running on port 3001');