const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createDom } = require('./support/fake-dom');

const ROOT = path.resolve(__dirname, '..');

function loadSf(files, overrides = {}) {
  const { document, window, Node } = createDom();
  const context = vm.createContext({
    console,
    document,
    window,
    Node,
    Promise,
    setTimeout,
    clearTimeout,
    ...overrides,
  });

  files.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });

  return { SF: context.window.SF, document };
}

test('tauri createSchedule normalizes object and numeric ids to strings', async () => {
  const calls = [];
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js'], {
    fetch() {
      throw new Error('unexpected fetch');
    },
  });

  const backendWithObject = SF.createBackend({
    type: 'tauri',
    invoke(command, payload) {
      calls.push({ command, payload });
      return Promise.resolve({ jobId: 42 });
    },
    listen() {
      return Promise.resolve(function () {});
    },
  });

  assert.equal(await backendWithObject.createSchedule({ foo: 'bar' }), '42');
  assert.equal(calls[0].command, 'create_schedule');

  const backendWithNumber = SF.createBackend({
    type: 'tauri',
    invoke() {
      return Promise.resolve(7);
    },
    listen() {
      return Promise.resolve(function () {});
    },
  });

  assert.equal(await backendWithNumber.createSchedule({}), '7');
});

test('tauri streamEvents keeps id-less updates and filters mismatched job ids', async () => {
  let handler = null;
  const received = [];
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js']);

  const backend = SF.createBackend({
    type: 'tauri',
    invoke() {
      return Promise.resolve('job-1');
    },
    listen(_eventName, onEvent) {
      handler = onEvent;
      return Promise.resolve(function () {});
    },
  });

  backend.streamEvents('job-1', function (payload) {
    received.push(payload);
  });

  await Promise.resolve();

  handler({ payload: { score: '0hard/0soft' } });
  handler({ payload: { data: { id: 'job-1' }, solverStatus: 'SOLVING_ACTIVE' } });
  handler({ payload: { jobId: 'job-2', solverStatus: 'NOT_SOLVING' } });

  assert.equal(received.length, 2);
  assert.equal(received[0].score, '0hard/0soft');
  assert.equal(received[1].data.id, 'job-1');
});
