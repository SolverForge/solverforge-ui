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
  await backend.stopSchedule('job-7');

  assert.equal(created, 'job-7');
  assert.deepEqual(listed, { ok: true, url: '/api/fixtures' });
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer token');
  assert.equal(requests[0].options.body, JSON.stringify({ plan: 1 }));
  assert.equal(requests[1].options.method, 'GET');
  assert.equal(requests[2].url, '/api/jobs/job-7/stop');
  assert.equal(requests[2].options.method, 'POST');

  let streamed = null;
  let streamError = null;
  const close = backend.streamEvents('job-7', (payload) => {
    streamed = payload;
  }, (error) => {
    streamError = error;
  });
  assert.equal(typeof close, 'function');
  assert.equal(streams[0].url, '/api/jobs/job-7/events');
  streams[0].onmessage({ data: JSON.stringify({ eventType: 'progress', currentScore: '0hard/-1soft', bestScore: '0hard/-2soft', movesPerSecond: 14 }) });
  assert.equal(streamed.eventType, 'progress');
  assert.equal(streamed.currentScore, '0hard/-1soft');
  assert.equal(streamed.bestScore, '0hard/-2soft');
  streams[0].onerror();
  assert.equal(streamError.message, 'Event stream failed for /api/jobs/job-7/events');
  close();
  assert.equal(streams[0].closed, true);
});

test('HTTP backend request failures preserve status metadata', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js'], {
    fetch: async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get() {
          return null;
        },
      },
    }),
  });

  const backend = SF.createBackend({
    type: 'axum',
    baseUrl: '/api',
    schedulesPath: '/jobs',
  });

  await assert.rejects(backend.stopSchedule('job-404'), function (err) {
    assert.equal(err.status, 404);
    assert.equal(err.statusText, 'Not Found');
    assert.equal(err.method, 'POST');
    assert.equal(err.path, '/jobs/job-404/stop');
    assert.equal(err.url, '/api/jobs/job-404/stop');
    return true;
  });
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
    getSchedule: async (id) => {
      calls.push(['getSchedule', id]);
      return { id: id, score: '0hard/-1soft', retained: true };
    },
    analyze: async (id) => {
      calls.push(['analyze', id]);
      return { constraints: [{ name: 'hard-1', type: 'hard', score: '-1hard' }] };
    },
    stopSchedule: async (id) => {
      calls.push(['stopSchedule', id]);
    },
    deleteSchedule: async (id) => {
      calls.push(['deleteSchedule', id]);
    },
  };

  const progressUpdates = [];
  const solutionUpdates = [];
  const completions = [];
  const analyses = [];
  const solver = SF.createSolver({
    backend,
    statusBar,
    onProgress(meta) {
      progressUpdates.push(meta);
    },
    onSolution(schedule, meta) {
      solutionUpdates.push([schedule, meta]);
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

  onMessage({
    eventType: 'progress',
    currentScore: '0hard/-2soft',
    bestScore: '0hard/-3soft',
    movesPerSecond: 12
  });
  await flush();
  assert.equal(progressUpdates.length, 1);
  assert.equal(progressUpdates[0].currentScore, '0hard/-2soft');
  assert.equal(progressUpdates[0].bestScore, '0hard/-3soft');
  assert.equal(progressUpdates[0].movesPerSecond, 12);
  assert.deepEqual(calls.slice(3, 5), [
    ['updateScore', '0hard/-2soft'],
    ['updateMoves', 12],
  ]);

  onMessage({
    eventType: 'best_solution',
    currentScore: '0hard/-1soft',
    bestScore: '0hard/-1soft',
    movesPerSecond: 15,
    solution: { id: 'job-42', score: '0hard/-1soft' }
  });
  await flush();
  assert.equal(solutionUpdates.length, 1);
  assert.deepEqual(solutionUpdates[0][0], { id: 'job-42', score: '0hard/-1soft' });
  assert.equal(solutionUpdates[0][1].bestScore, '0hard/-1soft');
  assert.deepEqual(calls.slice(5, 7), [
    ['updateScore', '0hard/-1soft'],
    ['updateMoves', 15],
  ]);

  onMessage({
    eventType: 'finished',
    solverStatus: 'NOT_SOLVING',
    currentScore: '0hard/-1soft',
    bestScore: '0hard/-1soft',
    solution: { id: 'job-42', score: '0hard/-1soft' }
  });
  await flush();
  assert.equal(streamClosed, true);
  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-42');
  assert.equal(completions.length, 1);
  assert.deepEqual(completions[0], { id: 'job-42', score: '0hard/-1soft' });
  assert.deepEqual(calls.slice(7, 11), [
    ['updateScore', '0hard/-1soft'],
    ['updateMoves', null],
    ['setSolving', false],
    ['updateMoves', null],
  ]);

  solver.start({});
  await flush();
  await solver.stop();

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-42');
  assert.equal(analyses.length, 1);
  assert.equal(analyses[0].constraints.length, 1);
  assert.equal(completions.length, 2);
  assert.deepEqual(completions[1], { id: 'job-42', score: '0hard/-1soft', retained: true });
  assert.deepEqual(calls.slice(-8), [
    ['stopSchedule', 'job-42'],
    ['getSchedule', 'job-42'],
    ['analyze', 'job-42'],
    ['updateScore', '0hard/-1soft'],
    ['updateMoves', null],
    ['colorDotsFromAnalysis', [{ name: 'hard-1', type: 'hard', score: '-1hard' }]],
    ['setSolving', false],
    ['updateMoves', null],
  ]);
  assert.equal(calls.some((entry) => entry[0] === 'deleteSchedule'), false);
});

test('solver stop cancels a pending start and retains the eventual job id', async () => {
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
    getSchedule: async (id) => {
      calls.push(['getSchedule', id]);
      return { id: id, score: '0hard/0soft' };
    },
    analyze: async (id) => {
      calls.push(['analyze', id]);
      return { constraints: [] };
    },
    stopSchedule: async (id) => {
      calls.push(['stopSchedule', id]);
    },
    deleteSchedule: async (id) => {
      calls.push(['deleteSchedule', id]);
    },
  };

  const completions = [];
  let resolveCompletion;
  const completionReady = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const solver = SF.createSolver({
    backend,
    onComplete(schedule) {
      completions.push(schedule);
      resolveCompletion();
    },
  });
  solver.start({ demand: 1 });
  solver.stop();
  resolveCreate('job-late');
  await completionReady;

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-late');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].id, 'job-late');
  assert.equal(completions[0].score, '0hard/0soft');
  assert.deepEqual(calls, [
    ['createSchedule'],
    ['stopSchedule', 'job-late'],
    ['getSchedule', 'job-late'],
    ['analyze', 'job-late'],
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
  onMessage({ eventType: 'progress', currentScore: '0hard/-2soft', bestScore: '0hard/-2soft', movesPerSecond: 18 });
  onStreamError(new Error('stream broke'));
  await flush();

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-55');
  assert.deepEqual(errors, ['stream broke']);
  assert.deepEqual(calls, [
    ['streamEvents', 'job-55'],
    ['closeStream'],
  ]);
});

test('solver stop retries retained schedule fetches until the stopped snapshot is ready', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  let scheduleFetches = 0;
  const completions = [];
  const backend = {
    createSchedule: async () => 'job-race',
    streamEvents() {
      return function () {};
    },
    stopSchedule: async (id) => {
      calls.push(['stopSchedule', id]);
    },
    getSchedule: async (id) => {
      calls.push(['getSchedule', id]);
      scheduleFetches += 1;
      if (scheduleFetches < 3) throw new Error('not ready yet');
      return { id: 'job-race', score: '0hard/-3soft' };
    },
    analyze: async (id) => {
      calls.push(['analyze', id]);
      return { constraints: [] };
    },
    deleteSchedule: async () => {},
  };

  const solver = SF.createSolver({
    backend,
    onComplete(schedule) {
      completions.push(schedule);
    },
  });

  await solver.start({});
  await solver.stop();

  assert.equal(scheduleFetches, 3);
  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-race');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].id, 'job-race');
  assert.equal(completions[0].score, '0hard/-3soft');
  assert.deepEqual(calls, [
    ['stopSchedule', 'job-race'],
    ['getSchedule', 'job-race'],
    ['getSchedule', 'job-race'],
    ['getSchedule', 'job-race'],
    ['analyze', 'job-race'],
  ]);
});

test('solver stop is idempotent while retained shutdown is in progress', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  let resolveStop;
  const completions = [];
  const analyses = [];
  const backend = {
    createSchedule: async () => 'job-stop-once',
    streamEvents() {
      return function () {};
    },
    stopSchedule: (id) => {
      calls.push(['stopSchedule', id]);
      return new Promise((resolve) => {
        resolveStop = resolve;
      });
    },
    getSchedule: async (id) => {
      calls.push(['getSchedule', id]);
      return { id: id, score: '0hard/-1soft', retained: true };
    },
    analyze: async (id) => {
      calls.push(['analyze', id]);
      return { constraints: [] };
    },
    deleteSchedule: async (id) => {
      calls.push(['deleteSchedule', id]);
    },
  };

  const solver = SF.createSolver({
    backend,
    onComplete(schedule) {
      completions.push(schedule);
    },
    onAnalysis(analysis) {
      analyses.push(analysis);
    },
  });

  await solver.start({});
  const firstStop = solver.stop();
  const secondStop = solver.stop();

  assert.equal(firstStop, secondStop);

  resolveStop();
  await Promise.all([firstStop, secondStop]);

  assert.equal(solver.isRunning(), false);
  assert.equal(completions.length, 1);
  assert.equal(analyses.length, 1);
  assert.deepEqual(calls, [
    ['stopSchedule', 'job-stop-once'],
    ['getSchedule', 'job-stop-once'],
    ['analyze', 'job-stop-once'],
  ]);
});

test('solver stop keeps a finished retained schedule when stopSchedule returns 404', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  const completions = [];
  const analyses = [];
  const backend = {
    createSchedule: async () => 'job-finished',
    streamEvents() {
      return function () {};
    },
    stopSchedule: async (id) => {
      calls.push(['stopSchedule', id]);
      const err = new Error('404 Not Found');
      err.status = 404;
      throw err;
    },
    getScheduleStatus: async (id) => {
      calls.push(['getScheduleStatus', id]);
      return { solverStatus: 'SOLVING' };
    },
    getSchedule: async (id) => {
      calls.push(['getSchedule', id]);
      return { id: id, score: '0hard/-2soft', solverStatus: 'NOT_SOLVING' };
    },
    analyze: async (id) => {
      calls.push(['analyze', id]);
      return { constraints: [] };
    },
    deleteSchedule: async (id) => {
      calls.push(['deleteSchedule', id]);
    },
  };

  const solver = SF.createSolver({
    backend,
    onComplete(schedule) {
      completions.push(schedule);
    },
    onAnalysis(analysis) {
      analyses.push(analysis);
    },
  });

  await solver.start({});
  await solver.stop();

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-finished');
  assert.equal(completions.length, 1);
  assert.equal(analyses.length, 1);
  assert.equal(calls.some((entry) => entry[0] === 'deleteSchedule'), false);
  assert.deepEqual(calls, [
    ['stopSchedule', 'job-finished'],
    ['getScheduleStatus', 'job-finished'],
    ['getSchedule', 'job-finished'],
    ['getSchedule', 'job-finished'],
    ['analyze', 'job-finished'],
  ]);
});

test('solver stop falls back to delete for legacy backends when a 404 stop still reports SOLVING', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  const completions = [];
  const backend = {
    createSchedule: async () => 'job-compat',
    streamEvents() {
      return function () {};
    },
    stopSchedule: async (id) => {
      calls.push(['stopSchedule', id]);
      const err = new Error('404 Not Found');
      err.status = 404;
      throw err;
    },
    getScheduleStatus: async (id) => {
      calls.push(['getScheduleStatus', id]);
      return { solverStatus: 'SOLVING' };
    },
    deleteSchedule: async (id) => {
      calls.push(['deleteSchedule', id]);
    },
    getSchedule: async (id) => {
      calls.push(['getSchedule', id]);
      return { id: id, score: '0hard/-2soft' };
    },
    analyze: async (id) => {
      calls.push(['analyze', id]);
      return { constraints: [] };
    },
  };

  const solver = SF.createSolver({
    backend,
    onComplete(schedule) {
      completions.push(schedule);
    },
  });

  await solver.start({});
  await solver.stop();

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-compat');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].id, 'job-compat');
  assert.equal(completions[0].score, '0hard/-2soft');
  assert.deepEqual(calls, [
    ['stopSchedule', 'job-compat'],
    ['getScheduleStatus', 'job-compat'],
    ['getSchedule', 'job-compat'],
    ['deleteSchedule', 'job-compat'],
    ['getSchedule', 'job-compat'],
    ['analyze', 'job-compat'],
  ]);
});

test('solver ignores malformed and mismatched typed events without corrupting state', async () => {
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
  };

  let onMessage;
  const progressUpdates = [];
  const solutionUpdates = [];
  const completions = [];
  const backend = {
    createSchedule: async () => 'job-77',
    streamEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    analyze: async () => ({ constraints: [] }),
    deleteSchedule: async () => {},
  };

  const solver = SF.createSolver({
    backend,
    statusBar,
    onProgress(meta) {
      progressUpdates.push(meta);
    },
    onSolution(solution) {
      solutionUpdates.push(solution);
    },
    onComplete(solution) {
      completions.push(solution);
    },
  });

  solver.start({});
  await flush();

  onMessage({ eventType: 'progress', currentScore: '0hard/-4soft', bestScore: '0hard/-5soft', movesPerSecond: 21 });
  onMessage({ currentScore: '0hard/-3soft', bestScore: '0hard/-3soft', movesPerSecond: 22 });
  onMessage({ eventType: 'progress', bestScore: '0hard/-2soft', movesPerSecond: 23 });
  onMessage({ jobId: 'job-other', eventType: 'progress', currentScore: '0hard/-1soft', bestScore: '0hard/-1soft', movesPerSecond: 24 });
  onMessage({ eventType: 'best_solution', currentScore: '0hard/-1soft', bestScore: '0hard/-1soft', movesPerSecond: 25 });
  onMessage({ eventType: 'unknown', currentScore: '0hard/0soft', bestScore: '0hard/0soft', movesPerSecond: 26 });
  await flush();

  assert.equal(progressUpdates.length, 1);
  assert.equal(solutionUpdates.length, 0);
  assert.equal(completions.length, 0);
  assert.equal(solver.isRunning(), true);
  assert.deepEqual(calls, [
    ['setSolving', true],
    ['updateMoves', null],
    ['updateScore', '0hard/-4soft'],
    ['updateMoves', 21],
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
