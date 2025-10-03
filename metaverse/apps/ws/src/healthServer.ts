import http from 'http';
import { Roommanager } from './Roommanager';

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3002', 10);

export function startHealthServer(): void {
  const healthServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      if (req.url === '/health') {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        }));
      } else if (req.url === '/stats') {
        const stats = Roommanager.getInstance().getStats();
        res.statusCode = 200;
        res.end(JSON.stringify({
          ...stats,
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }));
      } else if (req.url === '/spaces') {
        const spaces = Roommanager.getInstance().getAllSpaces();
        const detailedSpaces = spaces.map(spaceId => ({
          spaceId,
          userCount: Roommanager.getInstance().getUserCount(spaceId),
          users: Roommanager.getInstance().getSpaceUsers(spaceId).map(user => ({
            id: user.id,
            userId: user.getUserId(),
            position: user.getPosition()
          }))
        }));
        
        res.statusCode = 200;
        res.end(JSON.stringify({
          spaces: detailedSpaces,
          totalSpaces: spaces.length
        }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('Health server error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  healthServer.listen(HEALTH_PORT, () => {
    console.log(`Health check server running on port ${HEALTH_PORT}`);
    console.log(`Available endpoints:`);
    console.log(`   GET http://localhost:${HEALTH_PORT}/health - Health status`);
    console.log(`   GET http://localhost:${HEALTH_PORT}/stats - Usage statistics`);
    console.log(`   GET http://localhost:${HEALTH_PORT}/spaces - Active spaces`);
  });

  healthServer.on('error', (error) => {
    console.error('Health server error:', error);
  });
}
