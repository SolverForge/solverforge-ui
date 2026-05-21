import assert from 'node:assert/strict';
import test from 'node:test';

import { colors, pick, score, parseHard } from '../static/sf/sf.mjs';

test('ES module exposes flat utility exports and compatibility namespaces', () => {
  assert.equal(parseHard('0hard/-42soft'), 0);
  assert.equal(score.parseSoft('0hard/-42soft'), -42);

  const first = pick('line-a');
  assert.equal(colors.pick('line-a'), first);
  assert.equal(typeof colors.project(0).dark, 'string');
});
