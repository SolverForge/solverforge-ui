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
    deleteJob: async () => {},
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
    deleteJob: async () => {},
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

[
  { eventType: 'completed', lifecycleState: 'COMPLETED' },
  { eventType: 'cancelled', lifecycleState: 'CANCELLED' },
  { eventType: 'failed', lifecycleState: 'FAILED', error: 'failed' },
  { eventType: 'completed', lifecycleState: 'TERMINATED_BY_CONFIG' },
].forEach((scenario) => {
  test(`solver delete clears the retained job after terminal ${scenario.lifecycleState}`, async () => {
    const { SF } = loadSf(SOLVER_FILES);
    let onMessage;
    const calls = [];
    let createCount = 0;
    const backend = {
      createJob: async () => {
        createCount += 1;
        return 'job-delete-' + scenario.lifecycleState.toLowerCase();
      },
      streamJobEvents(_id, callback) {
        onMessage = callback;
        return function () {};
      },
      getSnapshot: async (id, revision) => ({
        id: id,
        snapshotRevision: revision,
        lifecycleState: scenario.lifecycleState,
        solution: { id: id, revision: revision },
      }),
      analyzeSnapshot: async (id, revision) => ({
        jobId: id,
        snapshotRevision: revision,
        lifecycleState: scenario.lifecycleState,
        analysis: { score: '0hard/0soft', constraints: [] },
      }),
      pauseJob: async () => {},
      resumeJob: async () => {},
      cancelJob: async () => {},
      deleteJob: async (id) => {
        calls.push(['deleteJob', id]);
      },
    };

    let resolveTerminal;
    const terminalReady = new Promise((resolve) => {
      resolveTerminal = resolve;
    });
    const solver = SF.createSolver({
      backend,
      onComplete() {
        resolveTerminal();
      },
      onCancelled() {
        resolveTerminal();
      },
      onFailure() {
        resolveTerminal();
      },
      onAnalysis() {},
    });

    await solver.start({});
    onMessage({
      eventType: scenario.eventType,
      lifecycleState: scenario.lifecycleState,
      snapshotRevision: 7,
      error: scenario.error,
    });
    await terminalReady;

    assert.equal(solver.getLifecycleState(), scenario.lifecycleState);
    assert.notEqual(solver.getJobId(), null);
    await assert.rejects(solver.start({}), /Cannot start a new solve while a retained job exists/);
    assert.equal(createCount, 1);

    await solver.delete();

    assert.equal(solver.getJobId(), null);
    assert.equal(solver.getLifecycleState(), 'IDLE');
    assert.deepEqual(calls, [['deleteJob', 'job-delete-' + scenario.lifecycleState.toLowerCase()]]);
  });
});

test('solver preserves terminal retained state when backend deletion fails', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  const errors = [];
  const backend = {
    createJob: async () => 'job-delete-fails',
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
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async () => {
      throw new Error('delete failed');
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
    onError(message) {
      errors.push(message);
    },
  });

  await solver.start({});
  onMessage({
    eventType: 'completed',
    lifecycleState: 'COMPLETED',
    snapshotRevision: 9,
  });
  await completedReady;

  await assert.rejects(solver.delete(), /delete failed/);

  assert.equal(solver.getJobId(), 'job-delete-fails');
  assert.equal(solver.getLifecycleState(), 'COMPLETED');
  assert.deepEqual(errors, ['delete failed']);
  await assert.rejects(solver.start({}), /Cannot start a new solve while a retained job exists/);
});

test('solver blocks completed retained cleanup when terminal sync fails', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  const calls = [];
  const errors = [];
  const completed = [];
  let resolveFirstError;
  const firstErrorReady = new Promise((resolve) => {
    resolveFirstError = resolve;
  });
  const backend = {
    createJob: async () => 'job-sync-fails',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => {
      calls.push(['getSnapshot', id, revision]);
      throw new Error('terminal snapshot unavailable');
    },
    analyzeSnapshot: async (id, revision) => {
      calls.push(['analyzeSnapshot', id, revision]);
      return { jobId: id, snapshotRevision: revision, analysis: { constraints: [] } };
    },
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async (id) => {
      calls.push(['deleteJob', id]);
    },
  };
  const solver = SF.createSolver({
    backend,
    onComplete(snapshot, meta) {
      completed.push([snapshot, meta]);
    },
    onError(message) {
      errors.push(message);
      if (errors.length === 1) resolveFirstError();
    },
  });

  await solver.start({});
  onMessage({
    eventType: 'completed',
    lifecycleState: 'COMPLETED',
    snapshotRevision: 15,
  });
  await firstErrorReady;

  assert.equal(solver.getLifecycleState(), 'COMPLETED');
  assert.equal(solver.getJobId(), 'job-sync-fails');
  assert.equal(solver.getSnapshotRevision(), 15);
  assert.equal(completed.length, 0);
  assert.deepEqual(errors, ['terminal snapshot unavailable']);

  await assert.rejects(solver.delete(), /terminal snapshot unavailable/);

  assert.equal(solver.getLifecycleState(), 'COMPLETED');
  assert.equal(solver.getJobId(), 'job-sync-fails');
  assert.equal(completed.length, 0);
  assert.deepEqual(calls.filter((entry) => entry[0] === 'deleteJob'), []);
  await assert.rejects(solver.start({}), /Cannot start a new solve while a retained job exists/);
  await assert.rejects(solver.getSnapshot(), /terminal snapshot unavailable/);
  const analysis = await solver.analyzeSnapshot();
  assert.equal(analysis.snapshotRevision, 15);
});

test('solver retries completed terminal sync during delete and delivers completion once', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  const calls = [];
  const errors = [];
  const completed = [];
  let resolveFirstError;
  const firstErrorReady = new Promise((resolve) => {
    resolveFirstError = resolve;
  });
  let snapshotCalls = 0;
  const backend = {
    createJob: async () => 'job-sync-retry',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => {
      snapshotCalls += 1;
      calls.push(['getSnapshot', id, revision]);
      if (snapshotCalls === 1) throw new Error('first terminal sync failed');
      return {
        id: id,
        snapshotRevision: revision,
        lifecycleState: 'COMPLETED',
        solution: { id: id, revision: revision },
      };
    },
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async (id) => {
      calls.push(['deleteJob', id]);
    },
  };
  const solver = SF.createSolver({
    backend,
    onComplete(snapshot, meta) {
      completed.push([snapshot, meta]);
    },
    onError(message) {
      errors.push(message);
      if (errors.length === 1) resolveFirstError();
    },
  });

  await solver.start({});
  onMessage({
    eventType: 'completed',
    lifecycleState: 'COMPLETED',
    snapshotRevision: 18,
  });
  await firstErrorReady;

  assert.equal(solver.getLifecycleState(), 'COMPLETED');
  assert.equal(solver.getJobId(), 'job-sync-retry');
  assert.equal(completed.length, 0);
  assert.deepEqual(errors, ['first terminal sync failed']);

  await solver.delete();

  assert.equal(solver.getJobId(), null);
  assert.equal(solver.getLifecycleState(), 'IDLE');
  assert.equal(completed.length, 1);
  assert.equal(completed[0][0].snapshotRevision, 18);
  assert.equal(completed[0][1].snapshotRevision, 18);
  assert.deepEqual(calls, [
    ['getSnapshot', 'job-sync-retry', 18],
    ['getSnapshot', 'job-sync-retry', 18],
    ['deleteJob', 'job-sync-retry'],
  ]);
});

test('solver delete waits for terminal snapshot settlement before clearing pending commands', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  let resolveSnapshot;
  let cancelSettled = false;
  const calls = [];
  const backend = {
    createJob: async () => 'job-slow-terminal',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {
        calls.push(['closeStream']);
      };
    },
    getSnapshot: async (id, revision) => new Promise((resolve) => {
      calls.push(['getSnapshot', id, revision]);
      resolveSnapshot = () => resolve({
        id: id,
        snapshotRevision: revision,
        lifecycleState: 'CANCELLED',
        terminalReason: 'cancelled',
        solution: { id: id, revision: revision },
      });
    }),
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async (id) => {
      calls.push(['cancelJob', id]);
    },
    deleteJob: async (id) => {
      calls.push(['deleteJob', id]);
    },
  };
  const solver = SF.createSolver({ backend });

  await solver.start({});
  const cancelPromise = solver.cancel();
  cancelPromise.then(function () {
    cancelSettled = true;
  }, function () {
    cancelSettled = true;
  });
  await flush();

  onMessage({
    eventType: 'cancelled',
    lifecycleState: 'CANCELLED',
    snapshotRevision: 12,
    terminalReason: 'cancelled',
  });
  await flush();

  assert.equal(solver.getLifecycleState(), 'CANCELLED');
  const deletePromise = solver.delete();
  await flush();

  assert.equal(cancelSettled, false);
  assert.equal(solver.getJobId(), 'job-slow-terminal');
  assert.equal(solver.getLifecycleState(), 'CANCELLED');
  assert.deepEqual(calls, [
    ['cancelJob', 'job-slow-terminal'],
    ['getSnapshot', 'job-slow-terminal', 12],
  ]);

  resolveSnapshot();
  await cancelPromise;
  await deletePromise;

  assert.equal(cancelSettled, true);
  assert.equal(solver.getJobId(), null);
  assert.equal(solver.getLifecycleState(), 'IDLE');
  assert.deepEqual(calls, [
    ['cancelJob', 'job-slow-terminal'],
    ['getSnapshot', 'job-slow-terminal', 12],
    ['closeStream'],
    ['deleteJob', 'job-slow-terminal'],
  ]);
});

test('solver derives terminal status score from retained snapshot solution score', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  const scoreUpdates = [];
  const backend = {
    createJob: async () => 'job-snapshot-score',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => ({
      id: id,
      snapshotRevision: revision,
      lifecycleState: 'COMPLETED',
      solution: { id: id, score: '0hard/0soft' },
    }),
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async () => {},
  };
  let resolveCompleted;
  const completedReady = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const solver = SF.createSolver({
    backend,
    statusBar: {
      setLifecycleState() {},
      updateScore(score) {
        scoreUpdates.push(score);
      },
      updateMoves() {},
    },
    onComplete() {
      resolveCompleted();
    },
  });

  await solver.start({});
  onMessage({
    eventType: 'completed',
    lifecycleState: 'COMPLETED',
    snapshotRevision: 21,
  });
  await completedReady;

  assert.equal(scoreUpdates.at(-1), '0hard/0soft');
  assert.equal(solver.getLifecycleState(), 'COMPLETED');
});

test('solver derives terminal status score from snapshot-bound analysis score', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  const scoreUpdates = [];
  const backend = {
    createJob: async () => 'job-analysis-score',
    streamJobEvents(_id, callback) {
      onMessage = callback;
      return function () {};
    },
    getSnapshot: async (id, revision) => ({
      id: id,
      snapshotRevision: revision,
      lifecycleState: 'COMPLETED',
      solution: { id: id },
    }),
    analyzeSnapshot: async (id, revision) => ({
      jobId: id,
      snapshotRevision: revision,
      lifecycleState: 'COMPLETED',
      analysis: { score: '0hard/0soft', constraints: [] },
    }),
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async () => {},
  };
  let resolveCompleted;
  const completedReady = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const solver = SF.createSolver({
    backend,
    statusBar: {
      setLifecycleState() {},
      updateScore(score) {
        scoreUpdates.push(score);
      },
      updateMoves() {},
    },
    onComplete() {
      resolveCompleted();
    },
    onAnalysis() {},
  });

  await solver.start({});
  onMessage({
    eventType: 'completed',
    lifecycleState: 'COMPLETED',
    snapshotRevision: 22,
  });
  await completedReady;

  assert.equal(scoreUpdates.at(-1), '0hard/0soft');
  assert.equal(solver.getLifecycleState(), 'COMPLETED');
});
