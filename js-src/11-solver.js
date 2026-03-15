/* ============================================================================
   SolverForge UI — Solver Lifecycle
   SSE state machine: start → streaming → stop/complete.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createSolver = function (config) {
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
