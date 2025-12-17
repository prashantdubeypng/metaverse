const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Test Environment Manager
 * Handles starting/stopping services for testing
 */
class TestEnvironment {
  constructor() {
    this.services = [];
    this.isSetup = false;
  }

  /**
   * Start all backend services for testing
   */
  async startServices() {
    console.log('🚀 Starting backend services for testing...');
    
    const serviceConfigs = [
      {
        name: 'HTTP Service',
        command: 'pnpm run dev:http',
        port: 3101,
        healthPath: '/health'
      },
      {
        name: 'WebSocket Service', 
        command: 'pnpm run dev:ws',
        port: 3102,
        healthPath: '/health'
      },
      {
        name: 'Chat Service',
        command: 'pnpm run dev:chat',
        port: 3103,
        healthPath: '/health'
      }
    ];

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.HTTP_SERVICE_PORT = '3101';
    process.env.WS_SERVICE_PORT = '3102';
    process.env.CHAT_SERVICE_PORT = '3103';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

    for (const config of serviceConfigs) {
      try {
        console.log(`Starting ${config.name} on port ${config.port}...`);
        
        const process = exec(config.command, {
          cwd: path.resolve(__dirname, '..'),
          env: { ...process.env }
        });

        process.stdout.on('data', (data) => {
          if (process.env.VERBOSE_TESTS) {
            console.log(`[${config.name}] ${data.toString().trim()}`);
          }
        });

        process.stderr.on('data', (data) => {
          if (process.env.VERBOSE_TESTS) {
            console.error(`[${config.name}] ${data.toString().trim()}`);
          }
        });

        this.services.push({
          ...config,
          process
        });

        // Wait a bit for service to start
        await this.sleep(2000);
        
      } catch (error) {
        console.error(`Failed to start ${config.name}:`, error.message);
      }
    }

    console.log('⏳ Waiting for services to be ready...');
    await this.waitForServices();
    
    this.isSetup = true;
    console.log('✅ All services started and ready for testing');
  }

  /**
   * Wait for all services to be healthy
   */
  async waitForServices() {
    const maxAttempts = 30;
    const delayBetweenAttempts = 1000;

    for (const service of this.services) {
      console.log(`Waiting for ${service.name} to be ready...`);
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(`http://localhost:${service.port}${service.healthPath}`);
          
          if (response.ok) {
            console.log(`✅ ${service.name} is ready (attempt ${attempt})`);
            break;
          }
        } catch (error) {
          if (attempt === maxAttempts) {
            console.error(`❌ ${service.name} failed to start after ${maxAttempts} attempts`);
            throw new Error(`Service ${service.name} failed to start`);
          }
          
          if (attempt % 5 === 0) {
            console.log(`⏳ ${service.name} not ready yet (attempt ${attempt}/${maxAttempts})`);
          }
          
          await this.sleep(delayBetweenAttempts);
        }
      }
    }
  }

  /**
   * Stop all running services
   */
  async stopServices() {
    console.log('🛑 Stopping backend services...');
    
    for (const service of this.services) {
      try {
        console.log(`Stopping ${service.name}...`);
        
        // Kill the process
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${service.process.pid} /T /F`);
        } else {
          process.kill(service.process.pid, 'SIGTERM');
        }
        
        console.log(`✅ Stopped ${service.name}`);
      } catch (error) {
        console.error(`Error stopping ${service.name}:`, error.message);
      }
    }

    this.services = [];
    this.isSetup = false;
    console.log('✅ All services stopped');
  }

  /**
   * Restart all services
   */
  async restartServices() {
    await this.stopServices();
    await this.sleep(2000);
    await this.startServices();
  }

  /**
   * Check if services are running
   */
  async checkServices() {
    const status = {};
    
    for (const service of this.services) {
      try {
        const response = await fetch(`http://localhost:${service.port}${service.healthPath}`, {
          timeout: 5000
        });
        
        status[service.name] = {
          running: response.ok,
          port: service.port,
          status: response.status
        };
      } catch (error) {
        status[service.name] = {
          running: false,
          port: service.port,
          error: error.message
        };
      }
    }

    return status;
  }

  /**
   * Clean test database
   */
  async cleanDatabase() {
    console.log('🧹 Cleaning test database...');
    
    try {
      // This would run database cleanup commands
      // Adjust based on your database setup
      const cleanupCommands = [
        'pnpm run db:reset', // Reset database
        'pnpm run db:migrate', // Run migrations
        'pnpm run db:seed:test' // Seed test data if needed
      ];

      for (const command of cleanupCommands) {
        try {
          await this.execCommand(command);
          console.log(`✅ Executed: ${command}`);
        } catch (error) {
          console.log(`⚠️ Command failed (may be expected): ${command}`);
        }
      }
      
      console.log('✅ Database cleanup completed');
    } catch (error) {
      console.error('Database cleanup failed:', error.message);
    }
  }

  /**
   * Execute a command and return promise
   */
  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: path.resolve(__dirname, '..') }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service logs
   */
  getServiceLogs(serviceName) {
    const service = this.services.find(s => s.name === serviceName);
    if (!service) {
      return 'Service not found';
    }
    
    // Return recent logs if available
    return `Logs for ${serviceName} - Process ID: ${service.process.pid}`;
  }

  /**
   * Generate test report
   */
  generateTestReport(testResults) {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      services: {},
      tests: testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter(t => t.status === 'passed').length,
        failed: testResults.filter(t => t.status === 'failed').length,
        skipped: testResults.filter(t => t.status === 'skipped').length
      }
    };

    // Add service status
    this.services.forEach(service => {
      report.services[service.name] = {
        port: service.port,
        running: true,
        pid: service.process.pid
      };
    });

    const reportPath = path.join(__dirname, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Test report generated: ${reportPath}`);
    return report;
  }
}

module.exports = TestEnvironment;
