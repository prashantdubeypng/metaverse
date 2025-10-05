const axios = require('axios');
const WebSocket = require('ws');

class TestUtils {
  static async waitForService(url, timeout = 30000, interval = 1000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const response = await axios.get(url, { timeout: 5000 });
        if (response.status === 200) {
          return true;
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }
      
      await this.sleep(interval);
    }
    
    throw new Error(`Service at ${url} did not become ready within ${timeout}ms`);
  }

  static async waitForWebSocketService(port, timeout = 30000, interval = 1000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const ws = new WebSocket(`ws://localhost:${port}`);
        
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }, 5000);

          ws.on('open', () => {
            clearTimeout(timer);
            ws.close();
            resolve(true);
          });

          ws.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
        });
      } catch (error) {
        await this.sleep(interval);
      }
    }
    
    throw new Error(`WebSocket service on port ${port} did not become ready within ${timeout}ms`);
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async createTestUser(userData = {}) {
    const defaultUser = {
      userId: `test-user-${Date.now()}`,
      username: `testuser${Date.now()}`,
      ...userData
    };
    
    return defaultUser;
  }

  static async createTestSpace(spaceData = {}) {
    const defaultSpace = {
      spaceId: `test-space-${Date.now()}`,
      name: `Test Space ${Date.now()}`,
      dimensions: { width: 20, height: 20 },
      ...spaceData
    };
    
    return defaultSpace;
  }

  static async connectWebSocket(port = 3102) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  static async sendWSMessage(ws, message) {
    return new Promise((resolve, reject) => {
      ws.send(JSON.stringify(message));
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket message timeout'));
      }, 5000);

      ws.once('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  static generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static validateResponse(response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.data).toBeDefined();
    return response.data;
  }

  static validateWebSocketMessage(message, expectedType) {
    expect(message).toBeDefined();
    expect(message.type).toBe(expectedType);
    return message;
  }
}

module.exports = TestUtils;
