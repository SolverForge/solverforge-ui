/* ============================================================================
   SolverForge UI — Solver Lifecycle
   SSE state machine: start → streaming → stop/complete.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createSolver = function (config) {
    sf.assert(config, 'createSolver(config) requires a configuration object');
    sf.assert(config.backend, 'createSolver(config.backend) is required');
    sf.assert(config.backend.createSchedule && typeof config.backend.createSchedule === 'function', 'createSolver(config.backend.createSchedule) must be a function');
    sf.assert(config.backend.streamEvents && typeof config.backend.streamEvents === 'function', 'createSolver(config.backend.streamEvents) must be a function');
    sf.assert(config.backend.getSchedule && typeof config.backend.getSchedule === 'function', 'createSolver(config.backend.getSchedule) must be a function');
    sf.assert(!config.onUpdate || typeof config.onUpdate === 'function', 'createSolver(config.onUpdate) must be a function');
    sf.assert(!config.onComplete || typeof config.onComplete === 'function', 'createSolver(config.onComplete) must be a function');
    sf.assert(!config.onAnalysis || typeof config.onAnalysis === 'function', 'createSolver(config.onAnalysis) must be a function');
    sf.assert(!config.onError || typeof config.onError === 'function', 'createSolver(config.onError) must be a function');

    var backend = config.backend;
    var statusBar = config.statusBar;
    var closeStream = null;
    var jobId = null;
    var running = false;

    var api = {};

    api.start = function (data) {
      if (running) return;
      running = true;

      if (statusBar) {
        statusBar.setSolving(true);
        statusBar.updateMoves(null);
      }

      backend.createSchedule(data).then(function (id) {
        jobId = typeof id === 'string' ? id.trim() : id;
        closeStream = backend.streamEvents(jobId, function (msg) {
          // Solver finished
          if (msg.solverStatus === 'NOT_SOLVING') {
            backend.getSchedule(jobId).then(function (final) {
              if (config.onComplete) config.onComplete(final);
              if (statusBar) {
                statusBar.updateScore(final.score);
                statusBar.updateMoves(null);
              }
            });
            api._cleanup(false);
            return;
          }

          // Live update
          if (statusBar) {
            statusBar.updateScore(msg.score);
            statusBar.updateMoves(msg.movesPerSecond);
          }
          if (config.onUpdate) config.onUpdate(msg);
        });
      }).catch(function (err) {
        running = false;
        if (statusBar) statusBar.setSolving(false);
        if (config.onError) config.onError(err.message || String(err));
      });
    };

    api.stop = function () {
      if (!running || !jobId) return;
      var stoppedId = jobId;

      // Fetch analysis before deleting
      backend.analyze(stoppedId).then(function (analysis) {
        if (statusBar && analysis && analysis.constraints) {
          statusBar.colorDotsFromAnalysis(analysis.constraints);
        }
        if (config.onAnalysis) config.onAnalysis(analysis);
      }).catch(function () {}).then(function () {
        backend.deleteSchedule(stoppedId).catch(function () {});
      });

      api._cleanup(true);
    };

    api._cleanup = function (stopped) {
      if (closeStream) { closeStream(); closeStream = null; }
      running = false;
      jobId = null;
      if (statusBar) {
        statusBar.setSolving(false);
        statusBar.updateMoves(null);
      }
    };

    api.isRunning = function () { return running; };

    api.getJobId = function () { return jobId; };

    return api;
  };

})(SF);
