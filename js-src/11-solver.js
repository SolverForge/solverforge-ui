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
    var phase = 'idle';
    var runToken = 0;
    var canceledToken = null;
    var suppressStreamErrors = false;

    var api = {};

    api.start = function (data) {
      if (phase !== 'idle') return;
      phase = 'starting';
      runToken += 1;
      suppressStreamErrors = false;
      jobId = null;

      if (statusBar) {
        statusBar.setSolving(true);
        statusBar.updateMoves(null);
      }

      var token = runToken;
      backend.createSchedule(data).then(function (id) {
        if (token !== runToken) {
          if (isValidJobId(id)) backend.deleteSchedule(id).catch(function () {});
          return;
        }
        if (typeof id !== 'string' || !id.trim()) {
          throw new Error('Invalid solver backend createSchedule response');
        }

        if (canceledToken === token) {
          canceledToken = null;
          backend.deleteSchedule(id).catch(function () {});
          return;
        }

        phase = 'running';
        jobId = id;
        closeStream = backend.streamEvents(jobId, function (msg) {
          if (token !== runToken || canceledToken === token) return;
          if (!isEventForCurrentJob(msg, id)) return;

          // Solver finished
          if (msg.solverStatus === 'NOT_SOLVING') {
            backend.getSchedule(id).then(function (final) {
              if (token !== runToken || canceledToken === token) return;
              if (config.onComplete) config.onComplete(final);
              if (statusBar) {
                statusBar.updateScore(final.score);
                statusBar.updateMoves(null);
              }
            }).catch(function (err) {
              handleError(token, err);
            });
            api._cleanup(token);
            return;
          }

          // Live update
          if (statusBar) {
            statusBar.updateScore(msg.score);
            statusBar.updateMoves(msg.movesPerSecond);
          }
          if (config.onUpdate) config.onUpdate(msg);
        }, function (err) {
          if (suppressStreamErrors || token !== runToken || canceledToken === token) return;
          handleError(token, err);
        });
      }).catch(function (err) {
        handleError(token, err);
      });
    };

    api.stop = function () {
      if (phase === 'idle') return;
      var token = runToken;
      canceledToken = token;

      if (phase === 'starting' && !jobId) {
        api._cleanup(token);
        return;
      }

      var stoppedId = jobId;
      if (!stoppedId) {
        api._cleanup(token);
        return;
      }

      // Fetch analysis before deleting
      backend.analyze(stoppedId).then(function (analysis) {
        if (token !== runToken) return;
        if (statusBar && analysis && analysis.constraints) {
          statusBar.colorDotsFromAnalysis(analysis.constraints);
        }
        if (config.onAnalysis) config.onAnalysis(analysis);
      }).catch(function () {}).then(function () {
        backend.deleteSchedule(stoppedId).catch(function () {});
      });

      api._cleanup(token);
    };

    api._cleanup = function (token) {
      if (token != null && token !== runToken) return;
      suppressStreamErrors = true;
      if (closeStream) { closeStream(); closeStream = null; }
      phase = 'idle';
      jobId = null;
      if (statusBar) {
        statusBar.setSolving(false);
        statusBar.updateMoves(null);
      }
    };

    api.isRunning = function () { return phase !== 'idle'; };

    api.getJobId = function () { return jobId; };

    return api;

    function handleError(token, err) {
      if (token !== runToken) return;
      api._cleanup(token);
      if (config.onError) config.onError(err.message || String(err));
    }

    function isValidJobId(id) {
      return typeof id === 'string' && !!id.trim();
    }

    function isEventForCurrentJob(msg, expectedId) {
      if (!msg || typeof msg !== 'object') return false;
      var candidate = msg.jobId || msg.job_id || msg.scheduleId || msg.schedule_id || msg.id || (msg.data && msg.data.id);
      if (candidate == null) return true;
      return String(candidate) === String(expectedId);
    }
  };

})(SF);
