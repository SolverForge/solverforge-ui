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

test('solver lifecycle handles progress, pause, resume, completion, and snapshot-bound analysis', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  const statusBar = {
    setLifecycleState(value) {
      calls.push(['setLifecycleState', value]);
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
    createJob: async () => 'job-42',
    streamJobEvents(id, callback) {
      calls.push(['streamJobEvents', id]);
      onMessage = callback;
      return () => {
        streamClosed = true;
      };
    },
    getSnapshot: async (id, revision) => {
      calls.push(['getSnapshot', id, revision]);
      return {
        id: id,
        snapshotRevision: revision,
        lifecycleState: revision === 2 ? 'PAUSED' : 'COMPLETED',
        currentScore: revision === 2 ? '0hard/-1soft' : '0hard/0soft',
        bestScore: revision === 2 ? '0hard/-1soft' : '0hard/0soft',
        telemetry: { movesPerSecond: revision === 2 ? 0 : 1 },
        solution: { id: id, revision: revision, score: revision === 2 ? '0hard/-1soft' : '0hard/0soft' },
      };
    },
    analyzeSnapshot: async (id, revision) => {
      calls.push(['analyzeSnapshot', id, revision]);
      return {
        jobId: id,
        snapshotRevision: revision,
        analysis: {
          score: revision === 2 ? '0hard/-1soft' : '0hard/0soft',
          constraints: [{ name: 'hard-1', type: 'hard', score: revision === 2 ? '-1hard' : '0hard' }],
        },
      };
    },
    pauseJob: async (id) => {
      calls.push(['pauseJob', id]);
    },
    resumeJob: async (id) => {
      calls.push(['resumeJob', id]);
    },
    cancelJob: async (id) => {
      calls.push(['cancelJob', id]);
    },
  };

  const progressUpdates = [];
  const solutionSnapshots = [];
  const pauseRequests = [];
  const pausedSnapshots = [];
  const resumedUpdates = [];
  const completedSnapshots = [];
  const analyses = [];
  let resolveCompleted;
  const completedReady = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const solver = SF.createSolver({
    backend,
    statusBar,
    onProgress(meta) {
      progressUpdates.push(meta);
    },
    onSolution(snapshot, meta) {
      solutionSnapshots.push([snapshot, meta]);
    },
    onPauseRequested(meta) {
      pauseRequests.push(meta);
    },
    onPaused(snapshot, meta) {
      pausedSnapshots.push([snapshot, meta]);
    },
    onResumed(meta) {
      resumedUpdates.push(meta);
    },
    onComplete(snapshot, meta) {
      completedSnapshots.push([snapshot, meta]);
      resolveCompleted();
    },
    onAnalysis(analysis, meta) {
      analyses.push([analysis, meta]);
    },
  });

  solver.start({ demand: 5 });
  await flush();

  assert.equal(solver.isRunning(), true);
  assert.equal(solver.getJobId(), 'job-42');
  assert.deepEqual(calls.slice(0, 4), [
    ['setLifecycleState', 'STARTING'],
    ['updateMoves', null],
    ['setLifecycleState', 'SOLVING'],
    ['streamJobEvents', 'job-42'],
  ]);

  onMessage({
    eventType: 'progress',
    eventSequence: 1,
    lifecycleState: 'SOLVING',
    telemetry: { movesPerSecond: 12 },
    currentScore: '0hard/-2soft',
    bestScore: '0hard/-3soft',
  });
  await flush();

  assert.equal(progressUpdates.length, 1);
  assert.equal(progressUpdates[0].eventSequence, 1);
  assert.equal(progressUpdates[0].currentScore, '0hard/-2soft');
  assert.equal(progressUpdates[0].bestScore, '0hard/-3soft');

  onMessage({
    eventType: 'best_solution',
    eventSequence: 2,
    lifecycleState: 'SOLVING',
    snapshotRevision: 1,
    telemetry: { movesPerSecond: 15 },
    currentScore: '0hard/-1soft',
    bestScore: '0hard/-1soft',
    solution: { id: 'job-42', score: '0hard/-1soft' },
  });
  await flush();

  assert.equal(solutionSnapshots.length, 1);
  assert.equal(solutionSnapshots[0][0].snapshotRevision, 1);
  assert.equal(solutionSnapshots[0][0].solution.score, '0hard/-1soft');

  const pausePromise = solver.pause();
  assert.equal(typeof pausePromise.then, 'function');
  await flush();
  assert.deepEqual(calls.filter((entry) => entry[0] === 'pauseJob'), [['pauseJob', 'job-42']]);

  onMessage({
    eventType: 'pause_requested',
    eventSequence: 3,
    lifecycleState: 'PAUSE_REQUESTED',
    telemetry: { movesPerSecond: 8 },
    currentScore: '0hard/-1soft',
    bestScore: '0hard/-1soft',
  });
  await flush();

  assert.equal(pauseRequests.length, 1);
  assert.equal(pauseRequests[0].lifecycleState, 'PAUSE_REQUESTED');

  onMessage({
    eventType: 'paused',
    eventSequence: 4,
    lifecycleState: 'PAUSED',
    snapshotRevision: 2,
    telemetry: { movesPerSecond: 0 },
    currentScore: '0hard/-1soft',
    bestScore: '0hard/-1soft',
  });
  await pausePromise;

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getLifecycleState(), 'PAUSED');
  assert.equal(solver.getSnapshotRevision(), 2);
  assert.equal(pausedSnapshots.length, 1);
  assert.equal(pausedSnapshots[0][0].snapshotRevision, 2);
  assert.equal(pausedSnapshots[0][0].solution.revision, 2);
  assert.equal(analyses.length, 1);
  assert.equal(analyses[0][0].snapshotRevision, 2);

  const resumePromise = solver.resume();
  await flush();
  assert.deepEqual(calls.filter((entry) => entry[0] === 'resumeJob'), [['resumeJob', 'job-42']]);

  onMessage({
    eventType: 'resumed',
    eventSequence: 5,
    lifecycleState: 'SOLVING',
    telemetry: { movesPerSecond: 11 },
    currentScore: '0hard/-1soft',
    bestScore: '0hard/-1soft',
  });
  await resumePromise;

  assert.equal(resumedUpdates.length, 1);
  assert.equal(solver.isRunning(), true);
  assert.equal(solver.getLifecycleState(), 'SOLVING');

  onMessage({
    eventType: 'completed',
    eventSequence: 6,
    lifecycleState: 'COMPLETED',
    snapshotRevision: 3,
    telemetry: { movesPerSecond: 0 },
    currentScore: '0hard/0soft',
    bestScore: '0hard/0soft',
  });
  await completedReady;

  assert.equal(streamClosed, true);
  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getLifecycleState(), 'COMPLETED');
  assert.equal(completedSnapshots.length, 1);
  assert.equal(completedSnapshots[0][0].snapshotRevision, 3);
  assert.equal(completedSnapshots[0][0].solution.revision, 3);
  assert.equal(analyses.length, 2);
  assert.equal(analyses[1][0].snapshotRevision, 3);

  const latestAnalysis = await solver.analyzeSnapshot();
  assert.equal(latestAnalysis.snapshotRevision, 3);
  assert.equal(latestAnalysis.analysis.score, '0hard/0soft');
});

test('solver queues pause during startup until the job exists', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  let resolveCreate;
  let onMessage;
  const backend = {
    createJob() {
      calls.push(['createJob']);
      return new Promise((resolve) => {
        resolveCreate = resolve;
      });
    },
    streamJobEvents(id, callback) {
      calls.push(['streamJobEvents', id]);
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => {
      calls.push(['getSnapshot', id, revision]);
      return {
        id: id,
        snapshotRevision: revision,
        lifecycleState: 'PAUSED',
        solution: { id: id, revision: revision },
      };
    },
    analyzeSnapshot: async (id, revision) => {
      calls.push(['analyzeSnapshot', id, revision]);
      return {
        jobId: id,
        snapshotRevision: revision,
        analysis: { score: '0hard/-1soft', constraints: [] },
      };
    },
    pauseJob: async (id) => {
      calls.push(['pauseJob', id]);
    },
    resumeJob: async () => {},
    cancelJob: async () => {},
  };

  const paused = [];
  const solver = SF.createSolver({
    backend,
    onPaused(snapshot) {
      paused.push(snapshot);
    },
    onAnalysis() {},
  });

  solver.start({});
  const pausePromise = solver.pause();
  resolveCreate('job-late');
  await flush();

  assert.deepEqual(calls.slice(0, 3), [
    ['createJob'],
    ['streamJobEvents', 'job-late'],
    ['pauseJob', 'job-late'],
  ]);

  onMessage({
    eventType: 'pause_requested',
    lifecycleState: 'PAUSE_REQUESTED',
  });
  onMessage({
    eventType: 'paused',
    lifecycleState: 'PAUSED',
    snapshotRevision: 2,
  });

  await pausePromise;

  assert.equal(solver.getJobId(), 'job-late');
  assert.equal(solver.getLifecycleState(), 'PAUSED');
  assert.equal(paused.length, 1);
  assert.equal(paused[0].snapshotRevision, 2);
});

test('solver queues cancel during startup and settles on the terminal cancelled event', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  let resolveCreate;
  let onMessage;
  const backend = {
    createJob() {
      calls.push(['createJob']);
      return new Promise((resolve) => {
        resolveCreate = resolve;
      });
    },
    streamJobEvents(id, callback) {
      calls.push(['streamJobEvents', id]);
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => {
      calls.push(['getSnapshot', id, revision]);
      return {
        id: id,
        snapshotRevision: revision,
        lifecycleState: 'CANCELLED',
        solution: { id: id, revision: revision },
      };
    },
    analyzeSnapshot: async (id, revision) => {
      calls.push(['analyzeSnapshot', id, revision]);
      return {
        jobId: id,
        snapshotRevision: revision,
        analysis: { score: '0hard/-4soft', constraints: [] },
      };
    },
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async (id) => {
      calls.push(['cancelJob', id]);
    },
  };

  const cancellations = [];
  const solver = SF.createSolver({
    backend,
    onCancelled(snapshot) {
      cancellations.push(snapshot);
    },
    onAnalysis() {},
  });

  solver.start({});
  const cancelPromise = solver.cancel();
  resolveCreate('job-cancelled');
  await flush();

  onMessage({
    eventType: 'cancelled',
    lifecycleState: 'CANCELLED',
    snapshotRevision: 4,
  });

  await cancelPromise;

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getLifecycleState(), 'CANCELLED');
  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0].snapshotRevision, 4);
  assert.deepEqual(calls.slice(0, 5), [
    ['createJob'],
    ['streamJobEvents', 'job-cancelled'],
    ['cancelJob', 'job-cancelled'],
    ['getSnapshot', 'job-cancelled', 4],
    ['analyzeSnapshot', 'job-cancelled', 4],
  ]);
});

test('solver ignores stale paused snapshot work after a newer cancelled event', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  let onMessage;
  let resolvePausedSnapshot;
  let snapshotCallCount = 0;
  const backend = {
    createJob: async () => 'job-race',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => {
      snapshotCallCount += 1;
      if (snapshotCallCount === 1) {
        return new Promise((resolve) => {
          resolvePausedSnapshot = () => resolve({
            id: id,
            snapshotRevision: revision,
            lifecycleState: 'PAUSED',
            solution: { id: id, revision: revision },
          });
        });
      }
      throw new Error('snapshot no longer available');
    },
    analyzeSnapshot: async () => {
      throw new Error('analysis should not run in this test');
    },
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
  };

  const paused = [];
  const cancelled = [];
  const solver = SF.createSolver({
    backend,
    onPaused(snapshot) {
      paused.push(snapshot);
    },
    onCancelled(snapshot, meta) {
      cancelled.push([snapshot, meta]);
    },
  });

  await solver.start({});
  const pausePromise = solver.pause();
  await flush();

  onMessage({
    eventType: 'paused',
    eventSequence: 2,
    lifecycleState: 'PAUSED',
    snapshotRevision: 2,
  });
  await flush();

  onMessage({
    eventType: 'cancelled',
    eventSequence: 3,
    lifecycleState: 'CANCELLED',
    snapshotRevision: 2,
    terminalReason: 'cancelled',
  });
  await flush();

  await assert.rejects(pausePromise, /Job terminated before pause settled/);
  assert.equal(solver.getLifecycleState(), 'CANCELLED');
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0][1].lifecycleState, 'CANCELLED');

  resolvePausedSnapshot();
  await flush();

  assert.equal(solver.getLifecycleState(), 'CANCELLED');
  assert.equal(paused.length, 0);
  assert.equal(cancelled.length, 1);
});

test('solver keeps terminal lifecycle metadata when retained snapshots are pause-bound', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  let onMessage;
  const backend = {
    createJob: async () => 'job-terminal-meta',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => ({
      id: id,
      snapshotRevision: revision,
      lifecycleState: 'PAUSED',
      terminalReason: null,
      solution: { id: id, revision: revision },
    }),
    analyzeSnapshot: async (id, revision) => ({
      jobId: id,
      snapshotRevision: revision,
      lifecycleState: 'PAUSED',
      terminalReason: null,
      analysis: { score: '0hard/-1soft', constraints: [] },
    }),
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
  };

  const cancelled = [];
  const analyses = [];
  let resolveCancelled;
  const cancelledReady = new Promise((resolve) => {
    resolveCancelled = resolve;
  });
  const solver = SF.createSolver({
    backend,
    onCancelled(snapshot, meta) {
      cancelled.push([snapshot, meta]);
      resolveCancelled();
    },
    onAnalysis(analysis, meta) {
      analyses.push([analysis, meta]);
    },
  });

  await solver.start({});
  onMessage({
    eventType: 'cancelled',
    eventSequence: 7,
    lifecycleState: 'CANCELLED',
    terminalReason: 'cancelled',
    snapshotRevision: 2,
  });
  await cancelledReady;

  assert.equal(solver.getLifecycleState(), 'CANCELLED');
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0][0].lifecycleState, 'PAUSED');
  assert.equal(cancelled[0][1].lifecycleState, 'CANCELLED');
  assert.equal(cancelled[0][1].terminalReason, 'cancelled');
  assert.equal(analyses.length, 1);
  assert.equal(analyses[0][1].lifecycleState, 'CANCELLED');
  assert.equal(analyses[0][1].terminalReason, 'cancelled');
});

test('solver delete clears the retained job after terminal completion', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  let onMessage;
  const calls = [];
  const backend = {
    createJob: async () => 'job-delete',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => ({
      id: id,
      snapshotRevision: revision,
      lifecycleState: 'COMPLETED',
      solution: { id: id, revision: revision },
    }),
    analyzeSnapshot: async (id, revision) => ({
      jobId: id,
      snapshotRevision: revision,
      analysis: { score: '0hard/0soft', constraints: [] },
    }),
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async (id) => {
      calls.push(['deleteJob', id]);
    },
  };

  let resolveCompleted;
  const completedReady = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const solver = SF.createSolver({
    backend,
    onComplete() {
      resolveCompleted();
    },
    onAnalysis() {},
  });

  await solver.start({});
  onMessage({
    eventType: 'completed',
    lifecycleState: 'COMPLETED',
    snapshotRevision: 7,
  });
  await completedReady;

  assert.equal(solver.getJobId(), 'job-delete');
  await solver.delete();

  assert.equal(solver.getJobId(), null);
  assert.equal(solver.getLifecycleState(), 'IDLE');
  assert.deepEqual(calls, [['deleteJob', 'job-delete']]);
});

test('solver surfaces stream errors and resets the lifecycle', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  let onStreamError;
  const calls = [];
  const backend = {
    createJob: async () => 'job-55',
    streamJobEvents(id, _callback, errorCallback) {
      calls.push(['streamJobEvents', id]);
      onStreamError = errorCallback;
      return () => {
        calls.push(['closeStream']);
      };
    },
    getSnapshot: async () => null,
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
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
  onStreamError(new Error('stream broke'));
  await flush();

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), 'job-55');
  assert.deepEqual(errors, ['stream broke']);
  assert.deepEqual(calls, [
    ['streamJobEvents', 'job-55'],
    ['closeStream'],
  ]);
});

test('solver accepts an initial best_solution event before any progress event', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  const statusBar = {
    setLifecycleState(value) {
      calls.push(['setLifecycleState', value]);
    },
    updateMoves(value) {
      calls.push(['updateMoves', value]);
    },
    updateScore(value) {
      calls.push(['updateScore', value]);
    },
  };

  let onMessage;
  const solutionUpdates = [];
  const backend = {
    createJob: async () => 'job-bootstrap',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async () => null,
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
  };

  const solver = SF.createSolver({
    backend,
    statusBar,
    onSolution(snapshot, meta) {
      solutionUpdates.push([snapshot, meta]);
    },
  });

  solver.start({});
  await flush();

  onMessage({
    eventType: 'best_solution',
    eventSequence: 1,
    lifecycleState: 'SOLVING',
    snapshotRevision: 1,
    currentScore: '0hard/-1soft',
    bestScore: '0hard/-1soft',
    telemetry: { movesPerSecond: 9 },
    solution: { id: 'job-bootstrap', score: '0hard/-1soft' },
  });
  await flush();

  assert.equal(solutionUpdates.length, 1);
  assert.equal(solutionUpdates[0][0].snapshotRevision, 1);
  assert.equal(solutionUpdates[0][0].solution.score, '0hard/-1soft');
  assert.equal(solutionUpdates[0][1].eventType, 'best_solution');
  assert.equal(solutionUpdates[0][1].currentScore, '0hard/-1soft');
  assert.deepEqual(calls, [
    ['setLifecycleState', 'STARTING'],
    ['updateMoves', null],
    ['setLifecycleState', 'SOLVING'],
    ['setLifecycleState', 'SOLVING'],
    ['updateScore', '0hard/-1soft'],
    ['updateMoves', 9],
  ]);
});

test('solver ignores malformed and mismatched lifecycle events without corrupting state', async () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js']);
  const calls = [];
  const statusBar = {
    setLifecycleState(value) {
      calls.push(['setLifecycleState', value]);
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
    createJob: async () => 'job-77',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async () => null,
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
  };

  const solver = SF.createSolver({
    backend,
    statusBar,
    onProgress(meta) {
      progressUpdates.push(meta);
    },
    onSolution(snapshot) {
      solutionUpdates.push(snapshot);
    },
    onComplete(snapshot) {
      completions.push(snapshot);
    },
  });

  solver.start({});
  await flush();

  onMessage({ eventType: 'progress', currentScore: '0hard/-4soft', bestScore: '0hard/-5soft', telemetry: { movesPerSecond: 21 } });
  onMessage({ currentScore: '0hard/-3soft', bestScore: '0hard/-3soft' });
  onMessage({ eventType: 'progress', bestScore: '0hard/-2soft' });
  onMessage({ jobId: 'job-other', eventType: 'progress', currentScore: '0hard/-1soft', bestScore: '0hard/-1soft' });
  onMessage({ eventType: 'best_solution', currentScore: '0hard/-1soft', bestScore: '0hard/-1soft' });
  onMessage({ eventType: 'unknown', currentScore: '0hard/0soft', bestScore: '0hard/0soft' });
  await flush();

  assert.equal(progressUpdates.length, 1);
  assert.equal(solutionUpdates.length, 0);
  assert.equal(completions.length, 0);
  assert.equal(solver.isRunning(), true);
  assert.deepEqual(calls.slice(0, 5), [
    ['setLifecycleState', 'STARTING'],
    ['updateMoves', null],
    ['setLifecycleState', 'SOLVING'],
    ['setLifecycleState', 'SOLVING'],
    ['updateScore', '0hard/-4soft'],
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
