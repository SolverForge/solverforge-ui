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
    sf.assert(!config.onProgress || typeof config.onProgress === 'function', 'createSolver(config.onProgress) must be a function');
    sf.assert(!config.onSolution || typeof config.onSolution === 'function', 'createSolver(config.onSolution) must be a function');
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
          if (!msg || typeof msg !== 'object') return;

          if (typeof msg.eventType !== 'string' || !msg.eventType) return;

          var eventType = msg.eventType;
          if (eventType !== 'progress' && eventType !== 'best_solution' && eventType !== 'finished') return;

          var meta = {
            id: id,
            eventType: eventType,
            solverStatus: msg.solverStatus || null,
            currentScore: msg.currentScore || null,
            bestScore: msg.bestScore || null,
            movesPerSecond: msg.movesPerSecond || null
          };

          if (eventType === 'progress') {
            if (!meta.currentScore) return;
            updateStatus(meta);
            if (config.onProgress) config.onProgress(meta);
            return;
          }

          if (eventType === 'best_solution') {
            if (!msg.solution || !meta.currentScore) return;
            updateStatus(meta);
            if (config.onSolution && msg.solution) config.onSolution(msg.solution, meta);
            return;
          }

          if (eventType === 'finished') {
            if (!msg.solution || !meta.currentScore) return;
            updateStatus(meta);
            if (config.onComplete && msg.solution) config.onComplete(msg.solution, meta);
            api._cleanup(token);
            return;
          }
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

    function updateStatus(meta) {
      if (!statusBar) return;
      statusBar.updateScore(meta.currentScore || null);
      statusBar.updateMoves(meta.movesPerSecond);
    }
  };

})(SF);
