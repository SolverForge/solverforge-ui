const assert = require('node:assert/strict');
const test = require('node:test');

const { loadSf, flush } = require('./support/load-sf');

const SOLVER_FILES = ['js-src/00-core.js', 'js-src/10-backend.js', 'js-src/11-solver.js'];

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

test('solver surfaces stream errors and resets the lifecycle', async () => {
  const { SF } = loadSf(SOLVER_FILES);
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
