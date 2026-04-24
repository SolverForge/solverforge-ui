/* ============================================================================
   SolverForge UI — Solver Lifecycle
   Shared job orchestration for start, pause, resume, cancel, and snapshots.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createSolver = function (config) {
    sf.assert(config, 'createSolver(config) requires a configuration object');
    sf.assert(config.backend, 'createSolver(config.backend) is required');
    sf.assert(hasFunction(config.backend, 'createJob'), 'createSolver(config.backend.createJob) must be a function');
    sf.assert(hasFunction(config.backend, 'getSnapshot'), 'createSolver(config.backend.getSnapshot) must be a function');
    sf.assert(hasFunction(config.backend, 'analyzeSnapshot'), 'createSolver(config.backend.analyzeSnapshot) must be a function');
    sf.assert(hasFunction(config.backend, 'pauseJob'), 'createSolver(config.backend.pauseJob) must be a function');
    sf.assert(hasFunction(config.backend, 'resumeJob'), 'createSolver(config.backend.resumeJob) must be a function');
    sf.assert(hasFunction(config.backend, 'cancelJob'), 'createSolver(config.backend.cancelJob) must be a function');
    sf.assert(hasFunction(config.backend, 'deleteJob'), 'createSolver(config.backend.deleteJob) must be a function');
    sf.assert(hasFunction(config.backend, 'streamJobEvents'), 'createSolver(config.backend.streamJobEvents) must be a function');
    sf.assert(!config.onProgress || typeof config.onProgress === 'function', 'createSolver(config.onProgress) must be a function');
    sf.assert(!config.onSolution || typeof config.onSolution === 'function', 'createSolver(config.onSolution) must be a function');
    sf.assert(!config.onPauseRequested || typeof config.onPauseRequested === 'function', 'createSolver(config.onPauseRequested) must be a function');
    sf.assert(!config.onPaused || typeof config.onPaused === 'function', 'createSolver(config.onPaused) must be a function');
    sf.assert(!config.onResumed || typeof config.onResumed === 'function', 'createSolver(config.onResumed) must be a function');
    sf.assert(!config.onCancelled || typeof config.onCancelled === 'function', 'createSolver(config.onCancelled) must be a function');
    sf.assert(!config.onComplete || typeof config.onComplete === 'function', 'createSolver(config.onComplete) must be a function');
    sf.assert(!config.onFailure || typeof config.onFailure === 'function', 'createSolver(config.onFailure) must be a function');
    sf.assert(!config.onAnalysis || typeof config.onAnalysis === 'function', 'createSolver(config.onAnalysis) must be a function');
    sf.assert(!config.onError || typeof config.onError === 'function', 'createSolver(config.onError) must be a function');

    var backend = config.backend;
    var statusBar = config.statusBar;
    var closeStream = null;
    var activeJobId = null;
    var retainedJobId = null;
    var lifecycleState = 'IDLE';
    var phase = 'idle';
    var runToken = 0;
    var lastSnapshotRevision = null;
    var lastMeta = null;
    var lastNotifiedError = null;
    var queuedAction = null;
    var pendingPause = null;
    var pendingResume = null;
    var pendingCancel = null;
    var terminalSync = null;

    var api = {};

    api.start = function (data) {
      if (retainedJobId) {
        return Promise.reject(new Error('Cannot start a new solve while a retained job exists; wait for a terminal lifecycle state and call delete() first'));
      }
      if (phase !== 'idle') return Promise.resolve();

      resetForStart();
      phase = 'starting';
      runToken += 1;
      applyLifecycleState('STARTING');
      updateMoves(null);

      var token = runToken;
      return backend.createJob(data).then(function (id) {
        if (token !== runToken) return;
        ensureJobId(id);

        activeJobId = id;
        retainedJobId = id;
        phase = 'solving';
        applyLifecycleState('SOLVING');

        attachStream(token, id);

        if (queuedAction === 'pause') {
          queuedAction = null;
          requestPause(token, id);
        } else if (queuedAction === 'cancel') {
          queuedAction = null;
          requestCancel(token, id);
        }
      }).catch(function (err) {
        if (token !== runToken) return;
        if (retainedJobId) {
          failTransport(err);
        } else {
          failStartup(err);
        }
        throw err;
      });
    };

    api.pause = function () {
      if (pendingPause) return pendingPause.promise;
      if (phase === 'starting' && !activeJobId) {
        queuedAction = 'pause';
        pendingPause = createDeferred();
        return pendingPause.promise;
      }
      var jobId = currentJobId();
      if (phase !== 'solving' || !jobId) return Promise.resolve();

      pendingPause = createDeferred();
      if (!ensureStreamAttached(runToken, jobId, 'pause')) return pendingPause.promise;
      requestPause(runToken, jobId);
      return pendingPause.promise;
    };

    api.resume = function () {
      if (pendingResume) return pendingResume.promise;
      var jobId = currentJobId();
      if (phase !== 'paused' || !jobId) return Promise.resolve();

      pendingResume = createDeferred();
      if (!ensureStreamAttached(runToken, jobId, 'resume')) return pendingResume.promise;
      requestResume(runToken, jobId);
      return pendingResume.promise;
    };

    api.cancel = function () {
      if (pendingCancel) return pendingCancel.promise;
      if (phase === 'starting' && !activeJobId) {
        queuedAction = 'cancel';
        pendingCancel = createDeferred();
        return pendingCancel.promise;
      }
      var jobId = currentJobId();
      if (phase === 'cancelling' && jobId) {
        pendingCancel = createDeferred();
        if (!ensureStreamAttached(runToken, jobId, 'cancel')) return pendingCancel.promise;
        return pendingCancel.promise;
      }
      if (!jobId || !isCancelablePhase()) return Promise.resolve();

      pendingCancel = createDeferred();
      if (!ensureStreamAttached(runToken, jobId, 'cancel')) return pendingCancel.promise;
      requestCancel(runToken, jobId);
      return pendingCancel.promise;
    };

    api.delete = function () {
      if (!retainedJobId) return Promise.resolve();
      if (!isTerminalLifecycle(lifecycleState)) {
        return Promise.reject(new Error('Cannot delete a retained job before it reaches a terminal lifecycle state'));
      }

      var jobId = retainedJobId;
      return ensureTerminalSyncBeforeDelete(jobId).then(function () {
        if (retainedJobId !== jobId) return;
        return backend.deleteJob(jobId);
      }).then(function () {
        if (retainedJobId !== jobId) return;
        resetAfterDelete();
      }).catch(function (err) {
        notifyError(err);
        throw err;
      });
    };

    api.getSnapshot = function (snapshotRevision) {
      var jobId = currentJobId();
      if (!jobId) return Promise.reject(new Error('No retained job is available'));
      var revision = resolveRequestedSnapshotRevision(snapshotRevision);
      return backend.getSnapshot(jobId, revision).then(function (payload) {
        return normalizeSnapshot(payload, lastMeta);
      });
    };

    api.analyzeSnapshot = function (snapshotRevision) {
      var jobId = currentJobId();
      if (!jobId) return Promise.reject(new Error('No retained job is available'));
      var revision = resolveRequestedSnapshotRevision(snapshotRevision);
      return backend.analyzeSnapshot(jobId, revision).then(function (payload) {
        return normalizeAnalysis(payload, lastMeta);
      });
    };

    api.isRunning = function () {
      return phase !== 'idle' && phase !== 'paused';
    };

    api.getJobId = function () {
      return activeJobId || retainedJobId;
    };

    api.getLifecycleState = function () {
      return lifecycleState;
    };

    api.getSnapshotRevision = function () {
      return lastSnapshotRevision;
    };

    return api;

    function requestPause(token, id) {
      phase = 'pause-requested';
      backend.pauseJob(id).catch(function (err) {
        if (token !== runToken) return;
        phase = 'solving';
        rejectDeferred('pause', err);
        notifyError(err);
      });
    }

    function attachStream(token, id) {
      closeStream = backend.streamJobEvents(id, function (payload) {
        if (token !== runToken) return;
        handleEvent(token, id, payload);
      }, function (err) {
        if (token !== runToken) return;
        failTransport(err);
      });
    }

    function ensureStreamAttached(token, id, pendingName) {
      if (closeStream) return true;
      try {
        attachStream(token, id);
        return true;
      } catch (err) {
        failTransport(err);
        rejectDeferred(pendingName, err);
        return false;
      }
    }

    function requestResume(token, id) {
      phase = 'resuming';
      backend.resumeJob(id).catch(function (err) {
        if (token !== runToken) return;
        phase = 'paused';
        rejectDeferred('resume', err);
        notifyError(err);
      });
    }

    function requestCancel(token, id) {
      phase = 'cancelling';
      backend.cancelJob(id).catch(function (err) {
        if (token !== runToken) return;
        phase = lifecycleState === 'PAUSED' ? 'paused' : 'solving';
        rejectDeferred('cancel', err);
        notifyError(err);
      });
    }

    function handleEvent(token, expectedId, payload) {
      var event = normalizeJobEvent(payload, expectedId);
      if (!event) return;

      lastMeta = event.meta;
      if (event.meta.snapshotRevision != null) {
        lastSnapshotRevision = event.meta.snapshotRevision;
      }
      retainedJobId = event.meta.jobId;
      activeJobId = event.meta.jobId;

      if (event.eventType === 'progress') {
        if (!event.meta.currentScore) return;
        phase = phaseForLifecycleState(event.meta.lifecycleState);
        applyEventMeta(event.meta);
        if (config.onProgress) config.onProgress(event.meta);
        return;
      }

      if (event.eventType === 'best_solution') {
        if (!event.solution || !event.meta.currentScore) return;
        phase = phaseForLifecycleState(event.meta.lifecycleState);
        applyEventMeta(event.meta);
        if (config.onSolution) {
          config.onSolution(buildLiveSnapshot(event), event.meta);
        }
        return;
      }

      if (event.eventType === 'pause_requested') {
        phase = 'pause-requested';
        applyEventMeta(event.meta);
        if (config.onPauseRequested) config.onPauseRequested(event.meta);
        return;
      }

      if (event.eventType === 'paused') {
        phase = 'paused';
        applyEventMeta(event.meta);
        syncSnapshotBundle(event.meta, true).then(function (bundle) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          applyBundle(bundle);
          if (config.onPaused && bundle.snapshot) config.onPaused(bundle.snapshot, bundle.meta);
          resolveDeferred('pause', bundle);
        }).catch(function (err) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          rejectDeferred('pause', err);
          notifyError(err);
        });
        return;
      }

      if (event.eventType === 'resumed') {
        phase = 'solving';
        applyEventMeta(event.meta);
        if (config.onResumed) config.onResumed(event.meta);
        resolveDeferred('resume', event.meta);
        return;
      }

      if (event.eventType === 'completed') {
        phase = 'idle';
        applyEventMeta(event.meta);
        runTerminalSync(createTerminalSync(event), token, event, true);
        return;
      }

      if (event.eventType === 'cancelled') {
        phase = 'idle';
        applyEventMeta(event.meta);
        runTerminalSync(createTerminalSync(event), token, event, false);
        return;
      }

      if (event.eventType === 'failed') {
        phase = 'idle';
        applyEventMeta(event.meta);
        runTerminalSync(createTerminalSync(event), token, event, false);
      }
    }

    function syncSnapshotBundle(meta, requireSnapshot) {
      var analysisRequired = !!config.onAnalysis;
      var snapshotRevision = meta && meta.snapshotRevision != null ? meta.snapshotRevision : null;

      return backend.getSnapshot(meta.jobId, snapshotRevision).then(function (snapshotPayload) {
        var snapshot = normalizeSnapshot(snapshotPayload, meta);
        if (!snapshot) throw new Error('Solver backend returned an invalid snapshot payload');

        var mergedMeta = mergeMeta(meta, snapshot, meta.eventType);
        var result = {
          meta: mergedMeta,
          snapshot: snapshot,
          analysis: null,
        };

        if (!analysisRequired) return result;

        return backend.analyzeSnapshot(meta.jobId, mergedMeta.snapshotRevision).then(function (analysisPayload) {
          result.analysis = normalizeAnalysis(analysisPayload, mergedMeta);
          return result;
        });
      }).catch(function (err) {
        if (requireSnapshot) throw err;

        var fallback = { meta: meta, snapshot: null, analysis: null };
        if (!analysisRequired || snapshotRevision == null) return fallback;

        return backend.analyzeSnapshot(meta.jobId, snapshotRevision).then(function (analysisPayload) {
          fallback.analysis = normalizeAnalysis(analysisPayload, meta);
          return fallback;
        }).catch(function () {
          return fallback;
        });
      });
    }

    function applyBundle(bundle) {
      if (!bundle) return;
      lastMeta = bundle.meta;
      if (bundle.meta && bundle.meta.snapshotRevision != null) {
        lastSnapshotRevision = bundle.meta.snapshotRevision;
      }
      applyEventMeta(bundle.meta, bundle.analysis);
      if (bundle.analysis && config.onAnalysis) config.onAnalysis(bundle.analysis, bundle.meta);
    }

    function finalizeTerminal(meta) {
      closeCurrentStream();
      activeJobId = null;
      queuedAction = null;
      phase = 'idle';
      applyLifecycleState(meta && meta.lifecycleState ? meta.lifecycleState : 'IDLE');
      updateMoves(null);
    }

    function failTransport(err) {
      var jobId = activeJobId || retainedJobId;
      retainedJobId = jobId;
      closeCurrentStream();
      activeJobId = null;
      phase = phaseForLifecycleState(lifecycleState);
      queuedAction = null;
      rejectDeferred('pause', err);
      rejectDeferred('resume', err);
      rejectDeferred('cancel', err);
      notifyError(err);
    }

    function failStartup(err) {
      closeCurrentStream();
      activeJobId = null;
      retainedJobId = null;
      lastSnapshotRevision = null;
      lastMeta = null;
      lastNotifiedError = null;
      phase = 'idle';
      queuedAction = null;
      rejectDeferred('pause', err);
      rejectDeferred('resume', err);
      rejectDeferred('cancel', err);
      applyLifecycleState('IDLE');
      updateMoves(null);
      notifyError(err);
    }

    function applyEventMeta(meta, analysis) {
      applyLifecycleState(meta && meta.lifecycleState ? meta.lifecycleState : lifecycleState);
      updateScore(meta && (meta.currentScore || meta.bestScore) ? (meta.currentScore || meta.bestScore) : null);
      updateMoves(meta ? readMovesPerSecond(meta.telemetry) : null);
      if (analysis) {
        var constraints = readAnalysisConstraints(analysis);
        if (constraints && constraints.length && statusBar && statusBar.colorDotsFromAnalysis) {
          statusBar.colorDotsFromAnalysis(constraints);
        }
      }
    }

    function applyLifecycleState(state) {
      lifecycleState = state || 'IDLE';
      if (!statusBar) return;
      if (typeof statusBar.setLifecycleState === 'function') {
        statusBar.setLifecycleState(lifecycleState);
        return;
      }
      if (typeof statusBar.setSolving === 'function') {
        statusBar.setSolving(isActiveLifecycle(lifecycleState));
      }
    }

    function updateScore(score) {
      if (statusBar && typeof statusBar.updateScore === 'function') {
        statusBar.updateScore(score);
      }
    }

    function updateMoves(value) {
      if (statusBar && typeof statusBar.updateMoves === 'function') {
        statusBar.updateMoves(value);
      }
    }

    function resetForStart() {
      closeCurrentStream();
      activeJobId = null;
      lastSnapshotRevision = null;
      lastMeta = null;
      lastNotifiedError = null;
      queuedAction = null;
      pendingPause = null;
      pendingResume = null;
      pendingCancel = null;
      terminalSync = null;
    }

    function resetAfterDelete() {
      closeCurrentStream();
      rejectDeferred('pause', new Error('Solver job was deleted before pause settled'));
      rejectDeferred('resume', new Error('Solver job was deleted before resume settled'));
      rejectDeferred('cancel', new Error('Solver job was deleted before cancel settled'));
      runToken += 1;
      activeJobId = null;
      retainedJobId = null;
      lastSnapshotRevision = null;
      lastMeta = null;
      queuedAction = null;
      pendingPause = null;
      pendingResume = null;
      pendingCancel = null;
      terminalSync = null;
      phase = 'idle';
      applyLifecycleState('IDLE');
      updateScore(null);
      updateMoves(null);
    }

    function closeCurrentStream() {
      if (!closeStream) return;
      closeStream();
      closeStream = null;
    }

    function currentJobId() {
      return activeJobId || retainedJobId;
    }

    function hasNewerEvent(meta) {
      var currentSequence = lastMeta && typeof lastMeta.eventSequence === 'number' ? lastMeta.eventSequence : null;
      var candidateSequence = meta && typeof meta.eventSequence === 'number' ? meta.eventSequence : null;
      if (currentSequence == null || candidateSequence == null) return false;
      return currentSequence > candidateSequence;
    }

    function resolveRequestedSnapshotRevision(snapshotRevision) {
      if (snapshotRevision != null && snapshotRevision !== '') return snapshotRevision;
      return lastSnapshotRevision;
    }

    function createTerminalSync(event) {
      var existing = terminalSync && terminalSync.jobId === event.meta.jobId ? terminalSync : null;
      terminalSync = {
        jobId: event.meta.jobId,
        eventType: event.eventType,
        meta: event.meta,
        status: 'pending',
        promise: null,
        error: null,
        callbackDelivered: existing ? existing.callbackDelivered : false,
      };
      return terminalSync;
    }

    function runTerminalSync(record, token, event, requireSnapshot) {
      record.status = 'pending';
      record.error = null;
      record.meta = event.meta;
      record.promise = syncSnapshotBundle(event.meta, requireSnapshot).then(function (bundle) {
        if (terminalSync !== record || token !== runToken || hasNewerEvent(event.meta)) return record;
        record.status = 'synced';
        record.error = null;
        record.meta = bundle.meta;
        finalizeTerminal(bundle.meta);
        applyBundle(bundle);
        deliverTerminalCallback(record, event, bundle);
        settlePendingFromTerminal(event.eventType, bundle, terminalEventError(event));
        return record;
      }).catch(function (err) {
        if (terminalSync !== record || token !== runToken || hasNewerEvent(event.meta)) return record;
        record.status = 'failed';
        record.error = err;
        finalizeTerminal(event.meta);
        deliverTerminalFailureCallback(record, event);
        settlePendingFromTerminal(event.eventType, null, err);
        notifyError(err);
        return record;
      });
      return record.promise;
    }

    function ensureTerminalSyncBeforeDelete(jobId) {
      var record = terminalSync && terminalSync.jobId === jobId ? terminalSync : null;
      if (!record) return Promise.resolve();

      return Promise.resolve(record.promise).then(function () {
        if (!requiresSuccessfulTerminalSync(record)) return;
        if (record.status === 'synced') return;
        return retryTerminalSync(record);
      });
    }

    function retryTerminalSync(record) {
      var retryEvent = {
        eventType: record.eventType,
        meta: record.meta,
        error: null,
      };
      return runTerminalSync(record, runToken, retryEvent, true).then(function () {
        if (record.status !== 'synced') {
          throw record.error || new Error('Terminal snapshot synchronization failed');
        }
      });
    }

    function requiresSuccessfulTerminalSync(record) {
      return record.eventType === 'completed'
        && (record.meta.lifecycleState === 'COMPLETED' || record.meta.lifecycleState === 'TERMINATED_BY_CONFIG');
    }

    function deliverTerminalCallback(record, event, bundle) {
      if (record.callbackDelivered) return;
      if (event.eventType === 'completed') {
        if (config.onComplete && bundle.snapshot) config.onComplete(bundle.snapshot, bundle.meta);
      } else if (event.eventType === 'cancelled') {
        if (config.onCancelled) config.onCancelled(bundle.snapshot, bundle.meta);
      } else if (event.eventType === 'failed') {
        if (config.onFailure) config.onFailure(event.error || 'Solver job failed', bundle.meta, bundle.snapshot, bundle.analysis);
      }
      record.callbackDelivered = true;
    }

    function deliverTerminalFailureCallback(record, event) {
      if (record.callbackDelivered || event.eventType !== 'failed') return;
      if (config.onFailure) config.onFailure(event.error || 'Solver job failed', event.meta, null, null);
      record.callbackDelivered = true;
    }

    function terminalEventError(event) {
      if (event.eventType !== 'failed') return null;
      return new Error(event.error || 'Solver job failed');
    }

    function isCancelablePhase() {
      return phase === 'solving' || phase === 'pause-requested' || phase === 'paused' || phase === 'resuming';
    }

    function phaseForLifecycleState(state) {
      if (state === 'STARTING') return 'starting';
      if (state === 'SOLVING') return 'solving';
      if (state === 'PAUSE_REQUESTED') return 'pause-requested';
      if (state === 'PAUSED') return 'paused';
      if (state === 'RESUMING') return 'resuming';
      if (state === 'CANCELLING') return 'cancelling';
      return 'idle';
    }

    function isTerminalLifecycle(state) {
      return state === 'COMPLETED'
        || state === 'CANCELLED'
        || state === 'FAILED'
        || state === 'TERMINATED_BY_CONFIG';
    }

    function settlePendingFromTerminal(eventType, bundle, err) {
      if (eventType === 'cancelled') {
        resolveDeferred('cancel', bundle);
      } else if (pendingCancel) {
        if (bundle) pendingCancel.resolve(bundle);
        else pendingCancel.reject(err || new Error('Cancel did not settle before the job terminated'));
        pendingCancel = null;
      }

      rejectDeferred('pause', err || new Error('Job terminated before pause settled'));
      rejectDeferred('resume', err || new Error('Job terminated before resume settled'));
    }

    function resolveDeferred(name, value) {
      var deferred = getDeferred(name);
      if (!deferred) return;
      deferred.resolve(value);
      setDeferred(name, null);
    }

    function rejectDeferred(name, err) {
      var deferred = getDeferred(name);
      if (!deferred) return;
      deferred.reject(err);
      setDeferred(name, null);
    }

    function getDeferred(name) {
      if (name === 'pause') return pendingPause;
      if (name === 'resume') return pendingResume;
      if (name === 'cancel') return pendingCancel;
      return null;
    }

    function setDeferred(name, value) {
      if (name === 'pause') pendingPause = value;
      if (name === 'resume') pendingResume = value;
      if (name === 'cancel') pendingCancel = value;
    }

    function notifyError(err) {
      if (err && lastNotifiedError === err) return;
      lastNotifiedError = err || null;
      if (config.onError) config.onError(err && err.message ? err.message : String(err));
    }

    function ensureJobId(id) {
      if (typeof id === 'string' && id.trim()) return;
      throw new Error('Invalid solver backend createJob response');
    }
  };

  function hasFunction(object, key) {
    return !!(object && typeof object[key] === 'function');
  }

  function createDeferred() {
    var resolve;
    var reject;
    var promise = new Promise(function (res, rej) {
      resolve = res;
      reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject };
  }

  function normalizeJobEvent(payload, expectedId) {
    if (!payload || typeof payload !== 'object') return null;

    var eventType = normalizeEventType(readField(payload, ['eventType', 'event_type', 'type']));
    if (!eventType) return null;

    var jobId = readField(payload, ['jobId', 'job_id', 'id'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) || expectedId;
    if (!jobId) return null;
    if (String(jobId) !== String(expectedId)) return null;

    var meta = {
      id: String(jobId),
      jobId: String(jobId),
      eventType: eventType,
      eventSequence: readField(payload, ['eventSequence', 'event_sequence'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]),
      lifecycleState: normalizeLifecycleState(readField(payload, ['lifecycleState', 'lifecycle_state', 'solverStatus', 'solver_status'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]), eventType),
      terminalReason: readField(payload, ['terminalReason', 'terminal_reason'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) || null,
      telemetry: normalizeTelemetry(readField(payload, ['telemetry'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]), payload),
      currentScore: readField(payload, ['currentScore', 'current_score'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) || null,
      bestScore: readField(payload, ['bestScore', 'best_score'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) || null,
      snapshotRevision: readField(payload, ['snapshotRevision', 'snapshot_revision'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]),
    };

    return {
      eventType: eventType,
      meta: meta,
      solution: payload.solution || (payload.data && payload.data.solution) || null,
      error: readField(payload, ['error'], [payload, payload.data]) || null,
    };
  }

  function normalizeSnapshot(payload, fallbackMeta) {
    if (!payload || typeof payload !== 'object') return null;

    var jobId = readField(payload, ['jobId', 'job_id', 'id'], [payload, payload.data]) || (fallbackMeta && fallbackMeta.jobId) || null;
    return {
      id: jobId != null ? String(jobId) : null,
      jobId: jobId != null ? String(jobId) : null,
      snapshotRevision: readField(payload, ['snapshotRevision', 'snapshot_revision'], [payload, payload.data]),
      lifecycleState: normalizeLifecycleState(readField(payload, ['lifecycleState', 'lifecycle_state'], [payload, payload.data]), fallbackMeta && fallbackMeta.eventType),
      terminalReason: readField(payload, ['terminalReason', 'terminal_reason'], [payload, payload.data]) || null,
      currentScore: readField(payload, ['currentScore', 'current_score'], [payload, payload.data]) || null,
      bestScore: readField(payload, ['bestScore', 'best_score'], [payload, payload.data]) || null,
      telemetry: normalizeTelemetry(readField(payload, ['telemetry'], [payload, payload.data]), payload),
      solution: payload.solution || (payload.data && payload.data.solution) || null,
    };
  }

  function normalizeAnalysis(payload, fallbackMeta) {
    if (!payload || typeof payload !== 'object') return null;

    var analysisBody = payload.analysis || (payload.data && payload.data.analysis) || payload;
    var constraints = readAnalysisConstraints(analysisBody);
    return {
      jobId: readField(payload, ['jobId', 'job_id', 'id'], [payload, payload.data]) || (fallbackMeta && fallbackMeta.jobId) || null,
      snapshotRevision: readField(payload, ['snapshotRevision', 'snapshot_revision'], [payload, payload.data]) || (fallbackMeta && fallbackMeta.snapshotRevision) || null,
      lifecycleState: normalizeLifecycleState(readField(payload, ['lifecycleState', 'lifecycle_state'], [payload, payload.data]), fallbackMeta && fallbackMeta.eventType),
      terminalReason: readField(payload, ['terminalReason', 'terminal_reason'], [payload, payload.data]) || (fallbackMeta && fallbackMeta.terminalReason) || null,
      analysis: analysisBody,
      score: analysisBody && analysisBody.score != null ? analysisBody.score : null,
      constraints: constraints,
    };
  }

  function buildLiveSnapshot(event) {
    return {
      id: event.meta.jobId,
      jobId: event.meta.jobId,
      snapshotRevision: event.meta.snapshotRevision,
      lifecycleState: event.meta.lifecycleState,
      terminalReason: event.meta.terminalReason,
      currentScore: event.meta.currentScore,
      bestScore: event.meta.bestScore,
      telemetry: event.meta.telemetry,
      solution: event.solution,
    };
  }

  function mergeMeta(meta, snapshot, eventType) {
    if (!snapshot) return meta;
    return {
      id: meta && meta.id ? meta.id : snapshot.id,
      jobId: meta && meta.jobId ? meta.jobId : snapshot.jobId,
      eventType: meta && meta.eventType ? meta.eventType : eventType,
      eventSequence: meta ? meta.eventSequence : null,
      lifecycleState: (meta && meta.lifecycleState) || snapshot.lifecycleState || normalizeLifecycleState(null, eventType),
      terminalReason: (meta && meta.terminalReason) || snapshot.terminalReason || null,
      telemetry: snapshot.telemetry || (meta && meta.telemetry) || null,
      currentScore: snapshot.currentScore || (meta && meta.currentScore) || null,
      bestScore: snapshot.bestScore || (meta && meta.bestScore) || null,
      snapshotRevision: snapshot.snapshotRevision != null ? snapshot.snapshotRevision : (meta && meta.snapshotRevision),
    };
  }

  function readField(payload, names, sources) {
    var fields = Array.isArray(names) ? names : [names];
    var roots = sources || [payload];
    for (var i = 0; i < roots.length; i++) {
      var source = roots[i];
      if (!source || typeof source !== 'object') continue;
      for (var j = 0; j < fields.length; j++) {
        if (source[fields[j]] != null) return source[fields[j]];
      }
    }
    return null;
  }

  function normalizeEventType(value) {
    if (typeof value !== 'string') return null;
    var normalized = value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
    if (!normalized) return null;
    if (normalized === 'finished') return 'completed';
    return normalized;
  }

  function normalizeLifecycleState(value, eventType) {
    if (typeof value === 'string' && value.trim()) {
      return value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toUpperCase();
    }

    if (eventType === 'progress' || eventType === 'best_solution' || eventType === 'resumed') return 'SOLVING';
    if (eventType === 'pause_requested') return 'PAUSE_REQUESTED';
    if (eventType === 'paused') return 'PAUSED';
    if (eventType === 'completed') return 'COMPLETED';
    if (eventType === 'cancelled') return 'CANCELLED';
    if (eventType === 'failed') return 'FAILED';
    return 'IDLE';
  }

  function normalizeTelemetry(rawTelemetry, payload) {
    if (rawTelemetry && typeof rawTelemetry === 'object') return rawTelemetry;

    var telemetry = {};
    var movesPerSecond = readField(payload, ['movesPerSecond', 'moves_per_second']);
    var stepCount = readField(payload, ['stepCount', 'step_count']);
    if (movesPerSecond != null) telemetry.movesPerSecond = movesPerSecond;
    if (stepCount != null) telemetry.stepCount = stepCount;
    return Object.keys(telemetry).length ? telemetry : null;
  }

  function readMovesPerSecond(telemetry) {
    if (!telemetry || typeof telemetry !== 'object') return null;
    if (telemetry.movesPerSecond != null) return telemetry.movesPerSecond;
    if (telemetry.moves_per_second != null) return telemetry.moves_per_second;
    return null;
  }

  function readAnalysisConstraints(analysis) {
    if (!analysis || typeof analysis !== 'object') return null;
    if (Array.isArray(analysis.constraints)) return analysis.constraints;
    if (analysis.analysis && Array.isArray(analysis.analysis.constraints)) return analysis.analysis.constraints;
    return null;
  }

  function isActiveLifecycle(state) {
    return state === 'STARTING'
      || state === 'SOLVING'
      || state === 'PAUSE_REQUESTED'
      || state === 'RESUMING'
      || state === 'CANCELLING';
  }

})(SF);
