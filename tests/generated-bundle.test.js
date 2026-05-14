const assert = require('node:assert/strict');
const test = require('node:test');

const { loadSfBundle } = require('./support/load-sf');

test('generated sf.js exposes the shipped global API surface', () => {
  const { SF } = loadSfBundle();

  assert.equal(typeof SF.version, 'string');
  assert.equal(typeof SF.createBackend, 'function');
  assert.equal(typeof SF.createSolver, 'function');
  assert.equal(typeof SF.createHeader, 'function');
  assert.equal(typeof SF.createStatusBar, 'function');
  assert.equal(typeof SF.rail.createTimeline, 'function');
});
