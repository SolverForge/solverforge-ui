import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSfGlobal } from './support/load-sf-global.js';

test('classic bundle attaches window.SF and preserves public namespaces', (t) => {
  const { SF, window } = loadSfGlobal(t);

  assert.ok(SF);
  assert.equal(window.SF, SF);
  assert.equal(typeof SF.createBackend, 'function');
  assert.equal(typeof SF.createSolver, 'function');
  assert.equal(typeof SF.rail.createTimeline, 'function');
  assert.equal(typeof SF.gantt.create, 'function');

  assert.equal(SF.score.parseHard('0hard/-42soft'), 0);
  assert.equal(SF.score.parseSoft('0hard/-42soft'), -42);
  assert.equal(SF.score.parseMedium('0hard/7medium/-42soft'), 7);
  assert.deepEqual(SF.score.getComponents('0hard/7medium/-42soft'), {
    hard: 0,
    medium: 7,
    soft: -42,
  });
  assert.equal(SF.score.colorClass('0hard/-42soft'), 'score-yellow');

  const first = SF.colors.pick('machine-a');
  assert.equal(SF.colors.pick('machine-a'), first);
  assert.equal(typeof SF.colors.project(0).main, 'string');
  SF.colors.reset();
  assert.equal(SF.colors.pick('machine-a'), first);
});
