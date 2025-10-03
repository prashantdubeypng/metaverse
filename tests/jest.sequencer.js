const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Run tests in specific order for better isolation
    const testOrder = [
      'unit',      // Unit tests first
      'integration', // Integration tests
      'e2e'        // End-to-end tests last
    ];

    return tests.sort((testA, testB) => {
      const orderA = testOrder.findIndex(order => testA.path.includes(order));
      const orderB = testOrder.findIndex(order => testB.path.includes(order));
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same type, sort alphabetically
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;
