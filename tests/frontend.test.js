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
    setTimeout,
    clearTimeout,
    Promise,
    ...overrides,
  });

  files.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });

  return { SF: context.window.SF, context, document };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

test('HTTP backend uses configured paths, headers, and event stream parsing', async () => {
  const requests = [];
  const streams = [];
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.closed = false;
      this.onmessage = null;
      this.onerror = null;
      streams.push(this);
    }

    close() {
      this.closed = true;
    }
  }

  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === '/api/jobs') {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name === 'content-type' ? 'application/json' : null;
          },
        },
        json: async () => ({ id: 'job-7' }),
        text: async () => 'ignored',
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get(name) {
          return name === 'content-type' ? 'application/json' : null;
        },
      },
      json: async () => ({ ok: true, url }),
      text: async () => 'ignored',
    };
  };

  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js'], {
    EventSource: FakeEventSource,
    fetch,
  });

  const backend = SF.createBackend({
    type: 'axum',
    baseUrl: '/api',
    schedulesPath: '/jobs',
    demoDataPath: '/fixtures',
    headers: { Authorization: 'Bearer token' },
  });

  const created = await backend.createSchedule({ plan: 1 });
  const listed = await backend.listDemoData();

  assert.equal(created, 'job-7');
  assert.deepEqual(listed, { ok: true, url: '/api/fixtures' });
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer token');
  assert.equal(requests[0].options.body, JSON.stringify({ plan: 1 }));
  assert.equal(requests[1].options.method, 'GET');

  let streamed = null;
  let streamError = null;
  const close = backend.streamEvents('job-7', (payload) => {
    streamed = payload;
  }, (error) => {
    streamError = error;
  });
  assert.equal(typeof close, 'function');
  assert.equal(streams[0].url, '/api/jobs/job-7/events');
  streams[0].onmessage({ data: JSON.stringify({ score: '0hard/-1soft' }) });
  assert.equal(streamed.score, '0hard/-1soft');
  streams[0].onerror();
  assert.equal(streamError.message, 'Event stream failed for /api/jobs/job-7/events');
  close();
  assert.equal(streams[0].closed, true);
});

test('solver lifecycle updates status callbacks during start, streaming, completion, and stop', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  const statusBar = {
    setSolving(value) {
      calls.push(['setSolving', value]);
    },
    updateMoves(value) {
      calls.push(['updateMoves', value]);
    },
    updateScore(value) {
      calls.push(['updateScore', value]);
    },
    colorDotsFromAnalysis(value) {
      calls.push(['colorDotsFromAnalysis', value]);
    },
  };

  let onMessage;
  let streamClosed = false;
  const backend = {
    createSchedule: async () => 'job-42',
    streamEvents(id, callback) {
      calls.push(['streamEvents', id]);
      onMessage = callback;
      return () => {
        streamClosed = true;
      };
    },
    getSchedule: async () => ({ id: 'job-42', score: '0hard/-1soft' }),
    analyze: async () => ({ constraints: [{ name: 'hard-1', type: 'hard', score: '-1hard' }] }),
    deleteSchedule: async (id) => {
      calls.push(['deleteSchedule', id]);
    },
  };

  const updates = [];
  const completions = [];
  const analyses = [];
  const solver = SF.createSolver({
    backend,
    statusBar,
    onUpdate(schedule) {
      updates.push(schedule);
    },
    onComplete(schedule) {
      completions.push(schedule);
    },
    onAnalysis(analysis) {
      analyses.push(analysis);
    },
  });

  solver.start({ demand: 5 });
  await flush();

  assert.equal(solver.isRunning(), true);
  assert.equal(solver.getJobId(), 'job-42');
  assert.deepEqual(calls.slice(0, 3), [
    ['setSolving', true],
    ['updateMoves', null],
    ['streamEvents', 'job-42'],
  ]);

  onMessage({ score: '0hard/-2soft', movesPerSecond: 12 });
  await flush();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].score, '0hard/-2soft');
  assert.equal(updates[0].movesPerSecond, 12);

  onMessage({ solverStatus: 'NOT_SOLVING' });
  await flush();
  assert.equal(streamClosed, true);
  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), null);
  assert.equal(completions.length, 1);
  assert.deepEqual(completions[0], { id: 'job-42', score: '0hard/-1soft' });

  solver.start({});
  await flush();
  solver.stop();
  await flush();

  assert.equal(solver.isRunning(), false);
  assert.equal(analyses.length, 1);
  assert.equal(analyses[0].constraints.length, 1);
  assert.deepEqual(calls.slice(-4), [
    ['setSolving', false],
    ['updateMoves', null],
    ['colorDotsFromAnalysis', [{ name: 'hard-1', type: 'hard', score: '-1hard' }]],
    ['deleteSchedule', 'job-42'],
  ]);
});

test('solver stop cancels a pending start and retires the eventual job id', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  let resolveCreate;
  const backend = {
    createSchedule() {
      calls.push(['createSchedule']);
      return new Promise((resolve) => {
        resolveCreate = resolve;
      });
    },
    streamEvents() {
      calls.push(['streamEvents']);
      return function () {};
    },
    getSchedule: async () => ({ id: 'job-late', score: '0hard/0soft' }),
    analyze: async () => ({ constraints: [] }),
    deleteSchedule: async (id) => {
      calls.push(['deleteSchedule', id]);
    },
  };

  const solver = SF.createSolver({ backend });
  solver.start({ demand: 1 });
  solver.stop();
  resolveCreate('job-late');
  await flush();

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), null);
  assert.deepEqual(calls, [
    ['createSchedule'],
    ['deleteSchedule', 'job-late'],
  ]);
});

test('solver surfaces stream errors and resets the lifecycle', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  let onMessage;
  let onStreamError;
  const calls = [];
  const backend = {
    createSchedule: async () => 'job-55',
    streamEvents(id, callback, errorCallback) {
      calls.push(['streamEvents', id]);
      onMessage = callback;
      onStreamError = errorCallback;
      return () => {
        calls.push(['closeStream']);
      };
    },
    getSchedule: async () => ({ id: 'job-55', score: '0hard/-1soft' }),
    analyze: async () => ({ constraints: [] }),
    deleteSchedule: async () => {},
  };

  const errors = [];
  const solver = SF.createSolver({
    backend,
    onError(message) {
      errors.push(message);
    },
  });

  solver.start({});
  await flush();
  onMessage({ score: '0hard/-2soft', movesPerSecond: 18 });
  onStreamError(new Error('stream broke'));
  await flush();

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), null);
  assert.deepEqual(errors, ['stream broke']);
  assert.deepEqual(calls, [
    ['streamEvents', 'job-55'],
    ['closeStream'],
  ]);
});

test('button, table, and tabs render and respond to basic interactions', () => {
  const { SF, document } = loadSf([
    'js-src/00-core.js',
    'js-src/03-buttons.js',
    'js-src/07-tabs.js',
    'js-src/08-table.js',
  ]);

  let clicked = 0;
  const button = SF.createButton({
    text: 'Solve',
    variant: 'success',
    size: 'small',
    id: 'solve-btn',
    dataset: { action: 'solve' },
    onClick() {
      clicked += 1;
    },
  });
  button.click();
  assert.equal(button.classList.contains('sf-btn--success'), true);
  assert.equal(button.classList.contains('sf-btn--sm'), true);
  assert.equal(button.id, 'solve-btn');
  assert.equal(button.dataset.action, 'solve');
  assert.equal(button.textContent, 'Solve');
  assert.equal(clicked, 1);

  let selectedRow = null;
  const table = SF.createTable({
    columns: [{ label: 'Job', className: 'job-col' }, { label: 'Status', align: 'right' }],
    rows: [['A-1', 'Ready']],
    onRowClick(index, row) {
      selectedRow = { index, row };
    },
  });
  document.body.appendChild(table);
  const row = table.querySelectorAll('tr')[1];
  row.click();
  assert.deepEqual(selectedRow, { index: 0, row: ['A-1', 'Ready'] });
  assert.equal(table.querySelectorAll('th').length, 2);
  assert.equal(table.querySelectorAll('td')[0].textContent, 'A-1');
  assert.equal(table.querySelectorAll('td')[1].style.textAlign, 'right');

  const tabs = SF.createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan' },
      { id: 'gantt', content: 'Gantt' },
    ],
  });
  document.body.appendChild(tabs.el);
  SF.showTab('gantt');
  assert.equal(tabs.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabs.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
});
