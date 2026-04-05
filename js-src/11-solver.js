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
    var activeJobId = null;
    var retainedJobId = null;
    var phase = 'idle';
    var runToken = 0;
    var canceledToken = null;
    var suppressStreamErrors = false;
    var stopPromise = null;
    var COMPAT_STOP_ATTEMPTS = 3;
    var RETAINED_STOP_ATTEMPTS = 10;
    var STOP_SYNC_DELAY_MS = 50;

    var api = {};

    api.start = function (data) {
      if (phase !== 'idle') return Promise.resolve();
      phase = 'starting';
      runToken += 1;
      canceledToken = null;
      suppressStreamErrors = false;
      activeJobId = null;

      if (statusBar) {
        statusBar.setSolving(true);
        statusBar.updateMoves(null);
      }

      var token = runToken;
      return backend.createSchedule(data).then(function (id) {
        if (token !== runToken) {
          if (isValidJobId(id)) discardSchedule(id);
          return;
        }
        if (typeof id !== 'string' || !id.trim()) {
          throw new Error('Invalid solver backend createSchedule response');
        }

        retainedJobId = id;
        activeJobId = id;

        if (canceledToken === token) {
          canceledToken = null;
          return stopAndSync(token, id, { keepIdle: true });
        }

        phase = 'running';
        closeStream = backend.streamEvents(id, function (msg) {
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
            retainedJobId = id;
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
      if (phase === 'idle') return Promise.resolve();
      if (phase === 'stopping' && stopPromise) return stopPromise;
      var token = runToken;
      canceledToken = token;

      if (phase === 'starting' && !activeJobId) {
        api._cleanup(token);
        return Promise.resolve();
      }

      var stoppedId = activeJobId;
      if (!stoppedId) {
        api._cleanup(token);
        return Promise.resolve();
      }

      stopPromise = stopAndSync(token, stoppedId, { closeStream: true });
      return stopPromise;
    };

    api._cleanup = function (token, options) {
      if (token != null && token !== runToken) return;
      suppressStreamErrors = true;
      if (closeStream) { closeStream(); closeStream = null; }
      phase = 'idle';
      activeJobId = null;
      stopPromise = null;
      if (options && options.clearRetainedJob) retainedJobId = null;
      if (statusBar) {
        statusBar.setSolving(false);
        statusBar.updateMoves(null);
      }
    };

    api.isRunning = function () { return phase !== 'idle'; };

    api.getJobId = function () { return activeJobId || retainedJobId; };

    return api;

    function handleError(token, err) {
      if (token !== runToken) return;
      if (activeJobId) retainedJobId = activeJobId;
      api._cleanup(token);
      if (config.onError) config.onError(err.message || String(err));
    }

    function stopAndSync(token, id, options) {
      options = options || {};
      if (token !== runToken) return Promise.resolve();

      if (!options.keepIdle) phase = 'stopping';
      if (options.closeStream) {
        suppressStreamErrors = true;
        if (closeStream) { closeStream(); closeStream = null; }
      }

      return requestStop(id).then(function (stopResult) {
        if (token !== runToken) return null;
        return syncStoppedState(id, stopResult && stopResult.mustRetain);
      }).then(function (result) {
        if (token !== runToken || !result) return;

        if (result.schedule) {
          retainedJobId = id;
          var meta = buildTerminalMeta(id, result.schedule);
          updateStatus(meta);
          if (config.onComplete) config.onComplete(result.schedule, meta);
        }

        if (result.analysis) {
          if (statusBar && result.analysis.constraints) {
            statusBar.colorDotsFromAnalysis(result.analysis.constraints);
          }
          if (config.onAnalysis) config.onAnalysis(result.analysis);
        }

        api._cleanup(token, result.clearRetainedJob ? { clearRetainedJob: true } : null);
      }).catch(function (err) {
        handleError(token, err);
      });
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
      statusBar.updateScore(meta.currentScore || meta.bestScore || null);
      statusBar.updateMoves(meta.movesPerSecond);
    }

    function discardSchedule(id) {
      if (!backend.deleteSchedule || typeof backend.deleteSchedule !== 'function') return;
      backend.deleteSchedule(id).catch(function () {});
    }

    function requestStop(id) {
      if (backend.stopSchedule && typeof backend.stopSchedule === 'function') {
        return backend.stopSchedule(id).then(function () {
          return { mustRetain: true };
        }).catch(function (err) {
          if (isAmbiguousStopNotFound(err)) {
            return resolveAmbiguousStopError(id, err);
          }
          if (!isUnsupportedStopError(err) || !canDeleteSchedule()) {
            throw err;
          }
          return deleteStoppedSchedule(id);
        });
      }
      if (canDeleteSchedule()) {
        return deleteStoppedSchedule(id);
      }
      return Promise.reject(new Error('Solver backend stopSchedule() or deleteSchedule() is required'));
    }

    function syncStoppedState(id, requireRetainedSchedule) {
      requireRetainedSchedule = !!requireRetainedSchedule;
      var attempts = requireRetainedSchedule ? RETAINED_STOP_ATTEMPTS : COMPAT_STOP_ATTEMPTS;
      return waitForRetainedSchedule(id, requireRetainedSchedule, attempts).then(function (schedule) {
        if (!schedule) {
          return {
            schedule: null,
            analysis: null,
            clearRetainedJob: !requireRetainedSchedule,
          };
        }
        return waitForAnalysis(id, attempts).then(function (analysis) {
          return {
            schedule: schedule,
            analysis: analysis,
            clearRetainedJob: false,
          };
        });
      });
    }

    function canDeleteSchedule() {
      return !!(backend.deleteSchedule && typeof backend.deleteSchedule === 'function');
    }

    function deleteStoppedSchedule(id) {
      return backend.deleteSchedule(id).then(function () {
        return {
          mustRetain: false,
        };
      });
    }

    function resolveAmbiguousStopError(id, err) {
      return detectTerminalStopState(id).then(function (alreadyStopped) {
        if (alreadyStopped) return { mustRetain: true };
        if (!canDeleteSchedule()) throw err;
        return deleteStoppedSchedule(id);
      });
    }

    function detectTerminalStopState(id) {
      return probeScheduleStatus(id).then(function (status) {
        if (status && isTerminalSolverStatus(status)) return true;
        return probeRetainedSchedule(id);
      });
    }

    function probeScheduleStatus(id) {
      if (!backend.getScheduleStatus || typeof backend.getScheduleStatus !== 'function') {
        return Promise.resolve(null);
      }
      return backend.getScheduleStatus(id).then(function (status) {
        return readSolverStatus(status);
      }).catch(function () {
        return null;
      });
    }

    function probeRetainedSchedule(id) {
      if (!backend.getSchedule || typeof backend.getSchedule !== 'function') {
        return Promise.resolve(false);
      }
      return backend.getSchedule(id).then(function (schedule) {
        if (!schedule) return false;
        var status = readSolverStatus(schedule);
        if (status) return isTerminalSolverStatus(status);
        return schedule.retained === true;
      }).catch(function () {
        return false;
      });
    }

    function readSolverStatus(payload) {
      if (!payload || typeof payload !== 'object') return null;
      var status = payload.solverStatus || payload.solver_status || (payload.data && (payload.data.solverStatus || payload.data.solver_status));
      return typeof status === 'string' && status ? status : null;
    }

    function isTerminalSolverStatus(status) {
      return String(status).toUpperCase() === 'NOT_SOLVING';
    }

    function waitForRetainedSchedule(id, required, attemptsLeft) {
      if (!backend.getSchedule || typeof backend.getSchedule !== 'function') {
        return required
          ? Promise.reject(new Error('Solver backend getSchedule() is required for retained stop'))
          : Promise.resolve(null);
      }

      return backend.getSchedule(id).then(function (schedule) {
        if (schedule) return schedule;
        if (attemptsLeft <= 1) {
          if (required) throw new Error('Retained stopped schedule was not available for ' + id);
          return null;
        }
        return delay(STOP_SYNC_DELAY_MS).then(function () {
          return waitForRetainedSchedule(id, required, attemptsLeft - 1);
        });
      }).catch(function (err) {
        if (attemptsLeft <= 1) {
          if (required) throw err;
          return null;
        }
        return delay(STOP_SYNC_DELAY_MS).then(function () {
          return waitForRetainedSchedule(id, required, attemptsLeft - 1);
        });
      });
    }

    function waitForAnalysis(id, attemptsLeft) {
      if (!backend.analyze || typeof backend.analyze !== 'function') return Promise.resolve(null);
      return backend.analyze(id).then(function (analysis) {
        return analysis || null;
      }).catch(function () {
        if (attemptsLeft <= 1) return null;
        return delay(STOP_SYNC_DELAY_MS).then(function () {
          return waitForAnalysis(id, attemptsLeft - 1);
        });
      });
    }

    function buildTerminalMeta(id, schedule) {
      var score = schedule && schedule.score ? schedule.score : null;
      return {
        id: id,
        eventType: 'finished',
        solverStatus: 'NOT_SOLVING',
        currentScore: score,
        bestScore: score,
        movesPerSecond: null,
      };
    }

    function isUnsupportedStopError(err) {
      var message = String(err && err.message ? err.message : err).toLowerCase();
      return (err && (err.status === 405 || err.status === 501))
        || message.indexOf('405') !== -1
        || message.indexOf('501') !== -1
        || message.indexOf('method not allowed') !== -1
        || message.indexOf('unknown command') !== -1
        || message.indexOf('not implemented') !== -1;
    }

    function isAmbiguousStopNotFound(err) {
      var message = String(err && err.message ? err.message : err).toLowerCase();
      return (err && err.status === 404)
        || message.indexOf('404') !== -1
        || message.indexOf('not found') !== -1;
    }

    function delay(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }
  };

})(SF);
