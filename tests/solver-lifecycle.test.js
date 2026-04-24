const assert = require('node:assert/strict');
const test = require('node:test');

const { loadSf, flush } = require('./support/load-sf');

const SOLVER_FILES = ['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js'];

test('createSolver requires deleteJob for retained job cleanup', () => {
  const { SF } = loadSf(SOLVER_FILES);
  assert.throws(() => SF.createSolver({
    backend: {
      createJob: async () => 'job-missing-delete',
      streamJobEvents() {
        return function () {};
      },
      getSnapshot: async () => null,
      analyzeSnapshot: async () => null,
      pauseJob: async () => {},
      resumeJob: async () => {},
      cancelJob: async () => {},
    },
  }), /createSolver\(config\.backend\.deleteJob\) must be a function/);
});

test('solver lifecycle handles progress, pause, resume, completion, and snapshot-bound analysis', async () => {
  const { SF } = loadSf(SOLVER_FILES);
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
    deleteJob: async (id) => {
      calls.push(['deleteJob', id]);
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

test('solver preserves retained runtime lifecycle after stream transport interruption', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onStreamError;
  let onMessage;
  const calls = [];
  let createCount = 0;
  const backend = {
    createJob: async () => {
      createCount += 1;
      calls.push(['createJob']);
      return 'job-55';
    },
    streamJobEvents(id, callback, errorCallback) {
      calls.push(['streamJobEvents', id]);
      onMessage = callback;
      onStreamError = errorCallback;
      return () => {
        calls.push(['closeStream']);
      };
    },
    getSnapshot: async (id, revision) => {
      calls.push(['getSnapshot', id, revision]);
      return {
        id: id,
        snapshotRevision: revision,
        lifecycleState: 'SOLVING',
        solution: { id: id, revision: revision },
      };
    },
    analyzeSnapshot: async () => null,
    pauseJob: async (id) => {
      calls.push(['pauseJob', id]);
    },
    resumeJob: async (id) => {
      calls.push(['resumeJob', id]);
    },
    cancelJob: async (id) => {
      calls.push(['cancelJob', id]);
    },
    deleteJob: async (id) => {
      calls.push(['deleteJob', id]);
    },
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
  onMessage({
    eventType: 'progress',
    eventSequence: 1,
    lifecycleState: 'SOLVING',
    currentScore: '0hard/-2soft',
    bestScore: '0hard/-2soft',
    snapshotRevision: 3,
  });
  await flush();

  const transportError = new Error('stream broke');
  transportError.code = 'SSE_CLOSED';
  transportError.transport = 'sse';
  onStreamError(transportError);
  await flush();

  assert.equal(solver.isRunning(), true);
  assert.equal(solver.getJobId(), 'job-55');
  assert.equal(solver.getLifecycleState(), 'SOLVING');
  assert.equal(solver.getSnapshotRevision(), 3);
  assert.deepEqual(errors, ['stream broke']);

  const snapshot = await solver.getSnapshot();
  assert.equal(snapshot.jobId, 'job-55');
  assert.equal(snapshot.snapshotRevision, 3);

  await assert.rejects(solver.start({}), /Cannot start a new solve while a retained job exists/);
  await assert.rejects(solver.delete(), /Cannot delete a retained job before it reaches a terminal lifecycle state/);

  solver.cancel();
  await flush();

  assert.equal(createCount, 1);
  assert.deepEqual(calls, [
    ['createJob'],
    ['streamJobEvents', 'job-55'],
    ['closeStream'],
    ['getSnapshot', 'job-55', 3],
    ['streamJobEvents', 'job-55'],
    ['cancelJob', 'job-55'],
  ]);
});

test('solver rejects pending lifecycle operations when the stream dies before authoritative state arrives', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onStreamError;
  const backend = {
    createJob: async () => 'job-pending',
    streamJobEvents(_id, _callback, errorCallback) {
      onStreamError = errorCallback;
      return function () {};
    },
    getSnapshot: async () => null,
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async () => {},
  };

  const solver = SF.createSolver({ backend });

  await solver.start({});
  const pausePromise = solver.pause();
  await flush();

  const transportError = new Error('closed');
  transportError.code = 'SSE_CLOSED';
  transportError.transport = 'sse';
  onStreamError(transportError);

  await assert.rejects(pausePromise, function (err) {
    assert.equal(err.code, 'SSE_CLOSED');
    assert.equal(err.transport, 'sse');
    return true;
  });
  assert.equal(solver.getLifecycleState(), 'SOLVING');
  assert.equal(solver.getJobId(), 'job-pending');
});

test('solver does not duplicate pause after authoritative pause-requested state loses transport', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  let onStreamError;
  const calls = [];
  const backend = {
    createJob: async () => 'job-pause-loss',
    streamJobEvents(id, callback, errorCallback) {
      calls.push(['streamJobEvents', id]);
      onMessage = callback;
      onStreamError = errorCallback;
      return function () {
        calls.push(['closeStream']);
      };
    },
    getSnapshot: async () => null,
    analyzeSnapshot: async () => null,
    pauseJob: async (id) => {
      calls.push(['pauseJob', id]);
    },
    resumeJob: async (id) => {
      calls.push(['resumeJob', id]);
    },
    cancelJob: async (id) => {
      calls.push(['cancelJob', id]);
    },
    deleteJob: async () => {},
  };
  const solver = SF.createSolver({ backend });

  await solver.start({});
  const pausePromise = solver.pause();
  const pauseRejected = assert.rejects(pausePromise, /closed/);
  await flush();

  onMessage({
    eventType: 'pause_requested',
    eventSequence: 2,
    lifecycleState: 'PAUSE_REQUESTED',
    currentScore: '0hard/-3soft',
    bestScore: '0hard/-3soft',
  });
  await flush();
  onStreamError(new Error('closed'));
  await pauseRejected;

  await solver.pause();
  await flush();

  assert.equal(solver.getLifecycleState(), 'PAUSE_REQUESTED');
  assert.deepEqual(calls.filter((entry) => entry[0] === 'pauseJob'), [['pauseJob', 'job-pause-loss']]);
});

test('solver does not duplicate resume or send pause after authoritative resuming state loses transport', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  let onStreamError;
  const calls = [];
  const backend = {
    createJob: async () => 'job-resume-loss',
    streamJobEvents(id, callback, errorCallback) {
      calls.push(['streamJobEvents', id]);
      onMessage = callback;
      onStreamError = errorCallback;
      return function () {
        calls.push(['closeStream']);
      };
    },
    getSnapshot: async (id, revision) => ({
      id: id,
      snapshotRevision: revision,
      lifecycleState: 'PAUSED',
      solution: { id: id, revision: revision },
    }),
    analyzeSnapshot: async () => null,
    pauseJob: async (id) => {
      calls.push(['pauseJob', id]);
    },
    resumeJob: async (id) => {
      calls.push(['resumeJob', id]);
    },
    cancelJob: async (id) => {
      calls.push(['cancelJob', id]);
    },
    deleteJob: async () => {},
  };
  const solver = SF.createSolver({ backend });

  await solver.start({});
  onMessage({
    eventType: 'paused',
    eventSequence: 2,
    lifecycleState: 'PAUSED',
    snapshotRevision: 4,
  });
  await flush();

  const resumePromise = solver.resume();
  const resumeRejected = assert.rejects(resumePromise, /closed/);
  await flush();
  onMessage({
    eventType: 'progress',
    eventSequence: 3,
    lifecycleState: 'RESUMING',
    currentScore: '0hard/-2soft',
    bestScore: '0hard/-2soft',
  });
  await flush();
  onStreamError(new Error('closed'));
  await resumeRejected;

  await solver.resume();
  await solver.pause();
  await flush();

  assert.equal(solver.getLifecycleState(), 'RESUMING');
  assert.deepEqual(calls.filter((entry) => entry[0] === 'resumeJob'), [['resumeJob', 'job-resume-loss']]);
  assert.deepEqual(calls.filter((entry) => entry[0] === 'pauseJob'), []);
});

test('solver does not duplicate cancel after authoritative cancelling state loses transport', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  let onMessage;
  let onStreamError;
  const calls = [];
  const backend = {
    createJob: async () => 'job-cancel-loss',
    streamJobEvents(id, callback, errorCallback) {
      calls.push(['streamJobEvents', id]);
      onMessage = callback;
      onStreamError = errorCallback;
      return function () {
        calls.push(['closeStream']);
      };
    },
    getSnapshot: async () => null,
    analyzeSnapshot: async () => null,
    pauseJob: async (id) => {
      calls.push(['pauseJob', id]);
    },
    resumeJob: async (id) => {
      calls.push(['resumeJob', id]);
    },
    cancelJob: async (id) => {
      calls.push(['cancelJob', id]);
    },
    deleteJob: async () => {},
  };
  const solver = SF.createSolver({ backend });

  await solver.start({});
  const cancelPromise = solver.cancel();
  const cancelRejected = assert.rejects(cancelPromise, /closed/);
  await flush();
  onMessage({
    eventType: 'progress',
    eventSequence: 2,
    lifecycleState: 'CANCELLING',
    currentScore: '0hard/-2soft',
    bestScore: '0hard/-2soft',
  });
  await flush();
  onStreamError(new Error('closed'));
  await cancelRejected;

  const reattachedCancel = solver.cancel();
  await flush();

  assert.equal(solver.getLifecycleState(), 'CANCELLING');
  assert.deepEqual(calls.filter((entry) => entry[0] === 'streamJobEvents'), [
    ['streamJobEvents', 'job-cancel-loss'],
    ['streamJobEvents', 'job-cancel-loss'],
  ]);
  assert.deepEqual(calls.filter((entry) => entry[0] === 'cancelJob'), [['cancelJob', 'job-cancel-loss']]);

  onMessage({
    eventType: 'cancelled',
    eventSequence: 3,
    lifecycleState: 'CANCELLED',
    snapshotRevision: 5,
    terminalReason: 'cancelled',
  });
  await reattachedCancel;
  assert.equal(solver.getLifecycleState(), 'CANCELLED');
});

test('solver resets lifecycle state when job creation fails', async () => {
  const { SF } = loadSf(SOLVER_FILES);
  const states = [];
  const errors = [];
  const backend = {
    createJob: async () => {
      throw new Error('create failed');
    },
    streamJobEvents() {
      throw new Error('stream should not open');
    },
    getSnapshot: async () => null,
    analyzeSnapshot: async () => null,
    pauseJob: async () => {},
    resumeJob: async () => {},
    cancelJob: async () => {},
    deleteJob: async () => {},
  };

  const solver = SF.createSolver({
    backend,
    statusBar: {
      setLifecycleState(value) {
        states.push(value);
      },
      updateMoves() {},
    },
    onError(message) {
      errors.push(message);
    },
  });

  await assert.rejects(solver.start({}), /create failed/);

  assert.equal(solver.isRunning(), false);
  assert.equal(solver.getJobId(), null);
  assert.equal(solver.getLifecycleState(), 'IDLE');
  assert.deepEqual(states, ['STARTING', 'IDLE']);
  assert.deepEqual(errors, ['create failed']);
});

test('solver accepts an initial best_solution event before any progress event', async () => {
  const { SF } = loadSf(SOLVER_FILES);
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
    deleteJob: async () => {},
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
  const { SF } = loadSf(SOLVER_FILES);
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
    deleteJob: async () => {},
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
