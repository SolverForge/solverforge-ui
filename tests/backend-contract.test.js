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

test('tauri createJob normalizes object and numeric ids to strings', async () => {
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

  assert.equal(await backendWithObject.createJob({ foo: 'bar' }), '42');
  assert.equal(calls[0].command, 'create_job');

  const backendWithNumber = SF.createBackend({
    type: 'tauri',
    invoke() {
      return Promise.resolve(7);
    },
    listen() {
      return Promise.resolve(function () {});
    },
  });

  assert.equal(await backendWithNumber.createJob({}), '7');
});

test('tauri backend uses neutral job lifecycle command names', async () => {
  const calls = [];
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js']);

  const backend = SF.createBackend({
    type: 'tauri',
    invoke(command, payload) {
      calls.push({ command, payload });
      return Promise.resolve(null);
    },
    listen() {
      return Promise.resolve(function () {});
    },
  });

  await backend.pauseJob('job-3');
  await backend.resumeJob('job-3');
  await backend.cancelJob('job-3');
  await backend.deleteJob('job-3');
  await backend.getSnapshot('job-3', 5);
  await backend.analyzeSnapshot('job-3', 5);

  assert.deepEqual(calls.map((entry) => entry.command), [
    'pause_job',
    'resume_job',
    'cancel_job',
    'delete_job',
    'get_snapshot',
    'analyze_snapshot',
  ]);
  assert.equal(calls[4].payload.snapshotRevision, 5);
  assert.equal(calls[5].payload.snapshotRevision, 5);
});

test('HTTP backend uses configured job paths and snapshot revision query parameters', async () => {
  const requests = [];
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js'], {
    fetch(url, opts) {
      requests.push({ url, opts });
      return Promise.resolve({
        ok: true,
        headers: { get() { return 'application/json'; } },
        json() { return Promise.resolve({ id: 'job-9', ok: true, url: url }); },
      });
    },
  });

  const backend = SF.createBackend({
    type: 'rails',
    baseUrl: '/api',
    jobsPath: '/jobs',
  });

  assert.equal(await backend.createJob({ foo: 'bar' }), 'job-9');
  await backend.getSnapshot('job-9', 12);
  await backend.analyzeSnapshot('job-9', 12);
  await backend.pauseJob('job-9');
  await backend.resumeJob('job-9');
  await backend.cancelJob('job-9');
  await backend.deleteJob('job-9');

  assert.equal(requests[0].url, '/api/jobs');
  assert.equal(requests[0].opts.method, 'POST');
  assert.equal(requests[1].url, '/api/jobs/job-9/snapshot?snapshot_revision=12');
  assert.equal(requests[2].url, '/api/jobs/job-9/analysis?snapshot_revision=12');
  assert.equal(requests[3].url, '/api/jobs/job-9/pause');
  assert.equal(requests[4].url, '/api/jobs/job-9/resume');
  assert.equal(requests[5].url, '/api/jobs/job-9/cancel');
  assert.equal(requests[6].url, '/api/jobs/job-9');
  assert.equal(requests[6].opts.method, 'DELETE');
});

test('HTTP backend lets EventSource reconnect without surfacing transient errors', async () => {
  let instance;
  const errors = [];
  function FakeEventSource(url) {
    this.url = url;
    this.readyState = FakeEventSource.OPEN;
    instance = this;
  }
  FakeEventSource.CONNECTING = 0;
  FakeEventSource.OPEN = 1;
  FakeEventSource.CLOSED = 2;
  FakeEventSource.prototype.close = function () {
    this.readyState = FakeEventSource.CLOSED;
  };

  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js'], {
    EventSource: FakeEventSource,
  });

  const backend = SF.createBackend({
    type: 'rails',
    baseUrl: '/api',
    jobsPath: '/jobs',
  });

  const close = backend.streamJobEvents('job-9', function () {}, function (error) {
    errors.push(error);
  });

  instance.readyState = FakeEventSource.CONNECTING;
  instance.onerror();
  assert.deepEqual(errors, []);

  instance.readyState = FakeEventSource.CLOSED;
  instance.onerror();
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Event stream closed for /api/jobs/job-9/events');
  assert.equal(errors[0].code, 'SSE_CLOSED');
  assert.equal(errors[0].transport, 'sse');
  assert.equal(errors[0].url, '/api/jobs/job-9/events');

  close();
});

test('tauri streamJobEvents keeps id-less updates and filters mismatched job ids', async () => {
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

  backend.streamJobEvents('job-1', function (payload) {
    received.push(payload);
  });

  await Promise.resolve();

  handler({ payload: { eventType: 'progress', currentScore: '0hard/0soft', bestScore: '0hard/0soft' } });
  handler({ payload: { data: { id: 'job-1' }, eventType: 'paused', snapshotRevision: 2 } });
  handler({ payload: { jobId: 'job-2', eventType: 'completed', snapshotRevision: 3 } });

  assert.equal(received.length, 2);
  assert.equal(received[0].eventType, 'progress');
  assert.equal(received[1].data.id, 'job-1');
});
