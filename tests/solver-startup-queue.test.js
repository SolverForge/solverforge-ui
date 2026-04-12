const assert = require('node:assert/strict');
const test = require('node:test');

const { loadSf, flush } = require('./support/load-sf');

const SOLVER_FILES = ['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js'];

test('solver queues pause during startup until the job exists', async () => {
  const { SF } = loadSf(SOLVER_FILES);
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
  const { SF } = loadSf(SOLVER_FILES);
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
