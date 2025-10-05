module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.(js|ts)', '**/*.(test|spec).(js|ts)'],
  collectCoverageFrom: [
    '../metaverse/apps/**/*.{js,ts}',
    '../metaverse/packages/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/build/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  roots: ['<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../metaverse/$1'
  },
  testSequencer: '<rootDir>/jest.sequencer.cjs'
};


