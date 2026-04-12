const assert = require('node:assert/strict');
const test = require('node:test');

const { loadSf, flush } = require('./support/load-sf');

const SOLVER_FILES = ['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js'];

test('solver ignores stale paused snapshot work after a newer cancelled event', async () => {
  const { SF } = loadSf(SOLVER_FILES);
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
  const { SF } = loadSf(SOLVER_FILES);
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
  const { SF } = loadSf(SOLVER_FILES);
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
