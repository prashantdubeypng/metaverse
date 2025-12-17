#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const TestEnvironment = require('./test-environment');

/**
 * Test Runner Script
 * Manages test execution with proper service orchestration
 */

class TestRunner {
  constructor() {
    this.testEnv = new TestEnvironment();
    this.results = [];
    this.config = {
      startServices: process.argv.includes('--start-services'),
      stopAfter: process.argv.includes('--stop-after'),
      verbose: process.argv.includes('--verbose'),
      skipE2E: process.argv.includes('--skip-e2e'),
      only: this.getOnlyFlag(),
      timeout: this.getTimeoutFlag()
    };
  }

  getOnlyFlag() {
    const onlyIndex = process.argv.findIndex(arg => arg === '--only');
    return onlyIndex !== -1 ? process.argv[onlyIndex + 1] : null;
  }

  getTimeoutFlag() {
    const timeoutIndex = process.argv.findIndex(arg => arg === '--timeout');
    return timeoutIndex !== -1 ? parseInt(process.argv[timeoutIndex + 1]) : 30000;
  }

  async run() {
    console.log('🧪 Metaverse Backend Test Runner');
    console.log('================================');
    
    try {
      // Setup environment variables
      this.setupEnvironment();
      
      // Start services if requested
      if (this.config.startServices) {
        await this.testEnv.startServices();
      }

      // Run test suites
      await this.runTestSuites();

      // Generate report
      const report = this.testEnv.generateTestReport(this.results);
      this.printSummary(report);

    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    } finally {
      // Stop services if we started them
      if (this.config.startServices && this.config.stopAfter) {
        await this.testEnv.stopServices();
      }
    }
  }

  setupEnvironment() {
    console.log('⚙️ Setting up test environment...');
    
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.HTTP_SERVICE_PORT = '3101';
    process.env.WS_SERVICE_PORT = '3102';
    process.env.CHAT_SERVICE_PORT = '3103';
    process.env.KAFKA_SERVICE_PORT = '3104';
    
    if (this.config.verbose) {
      process.env.VERBOSE_TESTS = 'true';
    }

    console.log('✅ Environment configured');
  }

  async runTestSuites() {
    const testSuites = [
      {
        name: 'Unit Tests',
        pattern: 'unit/**/*.test.js',
        required: true
      },
      {
        name: 'Integration Tests',
        pattern: 'integration/**/*.test.js',
        required: true
      },
      {
        name: 'End-to-End Tests',
        pattern: 'e2e/**/*.test.js',
        required: false,
        skip: this.config.skipE2E
      }
    ];

    for (const suite of testSuites) {
      if (suite.skip) {
        console.log(`⏭️ Skipping ${suite.name}`);
        continue;
      }

      if (this.config.only && !suite.name.toLowerCase().includes(this.config.only.toLowerCase())) {
        console.log(`⏭️ Skipping ${suite.name} (not matching --only filter)`);
        continue;
      }

      console.log(`\n🏃 Running ${suite.name}...`);
      
      try {
        const result = await this.runJestSuite(suite);
        this.results.push({
          suite: suite.name,
          status: result.success ? 'passed' : 'failed',
          tests: result.tests,
          duration: result.duration,
          coverage: result.coverage
        });

        if (!result.success && suite.required) {
          throw new Error(`Required test suite "${suite.name}" failed`);
        }

      } catch (error) {
        console.error(`❌ ${suite.name} failed:`, error.message);
        this.results.push({
          suite: suite.name,
          status: 'failed',
          error: error.message
        });

        if (suite.required) {
          throw error;
        }
      }
    }
  }

  async runJestSuite(suite) {
    return new Promise((resolve, reject) => {
      const jestArgs = [
        '--testPathPattern', suite.pattern,
        '--testTimeout', this.config.timeout.toString(),
        '--verbose',
        '--runInBand', // Run tests serially for better WebSocket handling
        '--forceExit'
      ];

      if (this.config.verbose) {
        jestArgs.push('--verbose');
      }

      // Add coverage for unit tests
      if (suite.name === 'Unit Tests') {
        jestArgs.push('--coverage', '--coverageDirectory', 'coverage');
      }

      const jest = spawn('npx', ['jest', ...jestArgs], {
        cwd: path.resolve(__dirname),
        stdio: 'inherit',
        env: { ...process.env }
      });

      const startTime = Date.now();

      jest.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        resolve({
          success: code === 0,
          tests: 'Unknown', // Jest would need to be configured to output JSON for exact counts
          duration,
          coverage: suite.name === 'Unit Tests' ? 'Generated' : 'N/A'
        });
      });

      jest.on('error', (error) => {
        reject(new Error(`Jest execution failed: ${error.message}`));
      });
    });
  }

  printSummary(report) {
    console.log('\n📊 Test Execution Summary');
    console.log('=========================');
    
    console.log(`Total Suites: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Skipped: ${report.summary.skipped}`);
    
    console.log('\n🔧 Service Status:');
    Object.entries(report.services).forEach(([name, status]) => {
      const icon = status.running ? '✅' : '❌';
      console.log(`${icon} ${name} (Port: ${status.port})`);
    });

    console.log('\n📋 Suite Details:');
    this.results.forEach(result => {
      const icon = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' : '⏭️';
      console.log(`${icon} ${result.suite} (${result.duration || 'N/A'}ms)`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const allPassed = this.results.every(r => r.status === 'passed');
    
    if (allPassed) {
      console.log('\n🎉 All tests passed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed. Check the details above.');
      process.exit(1);
    }
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Metaverse Backend Test Runner

Usage: node run-tests.js [options]

Options:
  --start-services    Start backend services before running tests
  --stop-after        Stop services after tests complete
  --verbose           Enable verbose output
  --skip-e2e          Skip end-to-end tests
  --only <suite>      Run only tests matching suite name
  --timeout <ms>      Set test timeout (default: 30000ms)
  --help, -h          Show this help message

Examples:
  node run-tests.js --start-services --stop-after
  node run-tests.js --only unit --verbose
  node run-tests.js --skip-e2e --timeout 60000
  `);
  process.exit(0);
}

// Run the test runner
const runner = new TestRunner();
runner.run().catch(error => {
  console.error('Test runner crashed:', error);
  process.exit(1);
});
