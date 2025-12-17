const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    const testOrder = ['unit', 'integration', 'e2e'];

    return tests.sort((testA, testB) => {
      const orderA = testOrder.findIndex((order) => testA.path.includes(order));
      const orderB = testOrder.findIndex((order) => testB.path.includes(order));

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;


