/* ============================================================================
   SolverForge UI — Solver Lifecycle
   Shared job orchestration for start, pause, resume, cancel, and snapshots.
   ============================================================================ */

import { assert, normalizeCreateJobId } from "../core";

/**
 * Creates a shared solver lifecycle orchestrator.
 */
export const createSolver = function (
  config: SF.SolverConfig
): SF.SolverApi {
  assert(config, 'createSolver(config) requires a configuration object');
  assert(config.backend, 'createSolver(config.backend) is required');
  assert(hasFunction(config.backend, 'createJob'), 'createSolver(config.backend.createJob) must be a function');
  assert(hasFunction(config.backend, 'getSnapshot'), 'createSolver(config.backend.getSnapshot) must be a function');
  assert(hasFunction(config.backend, 'analyzeSnapshot'), 'createSolver(config.backend.analyzeSnapshot) must be a function');
  assert(hasFunction(config.backend, 'pauseJob'), 'createSolver(config.backend.pauseJob) must be a function');
  assert(hasFunction(config.backend, 'resumeJob'), 'createSolver(config.backend.resumeJob) must be a function');
  assert(hasFunction(config.backend, 'cancelJob'), 'createSolver(config.backend.cancelJob) must be a function');
  assert(hasFunction(config.backend, 'deleteJob'), 'createSolver(config.backend.deleteJob) must be a function');
  assert(hasFunction(config.backend, 'streamJobEvents'), 'createSolver(config.backend.streamJobEvents) must be a function');
  assert(!config.onProgress || typeof config.onProgress === 'function', 'createSolver(config.onProgress) must be a function');
  assert(!config.onSolution || typeof config.onSolution === 'function', 'createSolver(config.onSolution) must be a function');
  assert(!config.onPauseRequested || typeof config.onPauseRequested === 'function', 'createSolver(config.onPauseRequested) must be a function');
  assert(!config.onPaused || typeof config.onPaused === 'function', 'createSolver(config.onPaused) must be a function');
  assert(!config.onResumed || typeof config.onResumed === 'function', 'createSolver(config.onResumed) must be a function');
  assert(!config.onCancelled || typeof config.onCancelled === 'function', 'createSolver(config.onCancelled) must be a function');
  assert(!config.onComplete || typeof config.onComplete === 'function', 'createSolver(config.onComplete) must be a function');
  assert(!config.onFailure || typeof config.onFailure === 'function', 'createSolver(config.onFailure) must be a function');
  assert(!config.onAnalysis || typeof config.onAnalysis === 'function', 'createSolver(config.onAnalysis) must be a function');
  assert(!config.onError || typeof config.onError === 'function', 'createSolver(config.onError) must be a function');

  var backend: SF.SolverBackend = config.backend;

  var statusBar: SF.SolverConfig['statusBar'] =
    config.statusBar;

  var closeStream: (() => void) | null = null;

  var activeJobId: string | null = null;

  var retainedJobId: string | null = null;

  var lifecycleState: SF.LifecycleState = 'IDLE';

  var phase: SF.SolverPhase = 'idle';

  var runToken: number = 0;

  var lastSnapshotRevision: number | string | null =
    null;

  var lastMeta: SF.EventMeta | null = null;

  var lastNotifiedError: Error | null = null;

  var queuedAction: string | null = null;

  var pendingPause:
    | SF.Deferred<{
      snapshot: SF.SolverSnapshot | null;
      meta: SF.EventMeta;
      analysis: SF.SolverAnalysis | null;
    } | null>
    | null = null;

  var pendingResume:
    | SF.Deferred<SF.EventMeta | null>
    | null = null;

  var pendingCancel:
    | SF.Deferred<{
      snapshot: SF.SolverSnapshot | null;
      meta: SF.EventMeta;
      analysis: SF.SolverAnalysis | null;
    } | null>
    | null = null;

  var terminalSync: SF.TerminalSyncRecord | null =
    null;

  var api: SF.SolverApi = {
    /**
     * Start a new solver job.
     */
    start: function (data?: unknown): Promise<void> {
      if (retainedJobId) {
        return Promise.reject(
          new Error(
            'Cannot start a new solve while a retained job exists; wait for a terminal lifecycle state and call delete() first'
          )
        );
      }

      if (phase !== 'idle') {
        return Promise.resolve();
      }

      resetForStart();
      phase = 'starting';
      runToken += 1;

      applyLifecycleState('STARTING');
      updateMoves(null);

      var token = runToken;

      return backend
        .createJob(data)
        .then(function (id) {
          if (token !== runToken) return;

          var jobId = ensureJobId(id);

          activeJobId = jobId;
          retainedJobId = jobId;

          phase = 'solving';

          applyLifecycleState('SOLVING');

          attachStream(token, jobId);

          if (queuedAction === 'pause') {
            queuedAction = null;
            requestPause(token, jobId);
          } else if (queuedAction === 'cancel') {
            queuedAction = null;
            requestCancel(token, jobId);
          }
        })
        .catch(function (err) {
          if (token !== runToken) return;

          if (retainedJobId) {
            failTransport(err);
          } else {
            failStartup(err);
          }

          throw err;
        });
    },

    /**
     * Request to pause the current solver job.
     */
    pause: function (): Promise<{ snapshot: SF.SolverSnapshot | null, meta: SF.EventMeta, analysis: SF.SolverAnalysis | null } | void> {
      if (pendingPause) {
        return pendingPause.promise;
      }

      if (phase === 'starting' && !activeJobId) {
        queuedAction = 'pause';
        pendingPause = createDeferred();

        return pendingPause.promise;
      }

      var jobId = currentJobId();

      if (phase !== 'solving' || !jobId) {
        return Promise.resolve();
      }

      pendingPause = createDeferred();

      if (!ensureStreamAttached(runToken, jobId, 'pause')) {
        return pendingPause.promise;
      }

      requestPause(runToken, jobId);

      return pendingPause.promise;
    },

    /**
     * Resume a paused solver job.
     */
    resume: function (): Promise<SF.EventMeta | void> {
      if (pendingResume) {
        return pendingResume.promise;
      }

      var jobId = currentJobId();

      if (phase !== 'paused' || !jobId) {
        return Promise.resolve();
      }

      pendingResume = createDeferred();

      if (!ensureStreamAttached(runToken, jobId, 'resume')) {
        return pendingResume.promise;
      }

      requestResume(runToken, jobId);

      return pendingResume.promise;
    },

    /**
     * Request to cancel the current solver job.
     */
    cancel: function (): Promise<{ snapshot: SF.SolverSnapshot | null, meta: SF.EventMeta, analysis: SF.SolverAnalysis | null } | void> {
      if (pendingCancel) {
        return pendingCancel.promise;
      }

      if (phase === 'starting' && !activeJobId) {
        queuedAction = 'cancel';
        pendingCancel = createDeferred();

        return pendingCancel.promise;
      }

      var jobId = currentJobId();

      if (phase === 'cancelling' && jobId) {
        pendingCancel = createDeferred();

        if (!ensureStreamAttached(runToken, jobId, 'cancel')) {
          return pendingCancel.promise;
        }

        return pendingCancel.promise;
      }

      if (!jobId || !isCancelablePhase()) {
        return Promise.resolve();
      }

      pendingCancel = createDeferred();

      if (!ensureStreamAttached(runToken, jobId, 'cancel')) {
        return pendingCancel.promise;
      }

      requestCancel(runToken, jobId);

      return pendingCancel.promise;
    },

    /**
     * Delete the retained job and its backend state.
     */
    delete: function (): Promise<void> {
      if (!retainedJobId) {
        return Promise.resolve();
      }

      if (!isTerminalLifecycle(lifecycleState)) {
        return Promise.reject(
          new Error(
            'Cannot delete a retained job before it reaches a terminal lifecycle state'
          )
        );
      }

      var jobId = retainedJobId;

      return ensureTerminalSyncBeforeDelete(jobId)
        .then(function () {
          if (retainedJobId !== jobId) return;

          return backend.deleteJob(jobId);
        })
        .then(function () {
          if (retainedJobId !== jobId) return;

          resetAfterDelete();
        })
        .catch(function (err) {
          notifyError(err);
          throw err;
        });
    },

    /**
     * Get a snapshot for the current job.
     */
    getSnapshot: function (snapshotRevision?: number | string): Promise<SF.SolverSnapshot | null> {
      var jobId = currentJobId();

      if (!jobId) {
        return Promise.reject(
          new Error('No retained job is available')
        );
      }

      var revision =
        resolveRequestedSnapshotRevision(snapshotRevision);

      return backend
        .getSnapshot(jobId, revision)
        .then(function (payload) {
          return normalizeSnapshot(payload as SF.BackendPayload, lastMeta);
        });
    },

    /**
     * Get analysis for a snapshot of the current job.
     */
    analyzeSnapshot: function (snapshotRevision?: number | string): Promise<SF.SolverAnalysis | null> {
      var jobId = currentJobId();

      if (!jobId) {
        return Promise.reject(
          new Error('No retained job is available')
        );
      }

      var revision =
        resolveRequestedSnapshotRevision(snapshotRevision);

      return backend
        .analyzeSnapshot(jobId, revision)
        .then(function (payload) {
          return normalizeAnalysis(payload as SF.BackendPayload, lastMeta);
        });
    },

    /**
     * Check if the solver is currently running.
     */
    isRunning: function (): boolean {
      return phase !== 'idle' && phase !== 'paused';
    },

    /**
     * Get the current job ID.
     */
    getJobId: function (): (string | null) {
      return activeJobId != null
        ? activeJobId
        : retainedJobId;
    },

    /**
     * Get the current lifecycle state.
     */
    getLifecycleState: function (): SF.LifecycleState {
      return lifecycleState;
    },

    /**
     * Get the current snapshot revision.
     */
    getSnapshotRevision: function (): number | string | null {
      return lastSnapshotRevision;
    }
  };

  return api;

  /**
   * Send a pause request to the backend.
   */
  function requestPause(token: number, id: string): void {
    phase = 'pause-requested';
    backend.pauseJob(id).catch(function (err) {
      if (token !== runToken) return;
      phase = 'solving';
      rejectDeferred('pause', err);
      notifyError(err);
    });
  }

  /**
   * Attach an event stream for the given job.
   */
  function attachStream(token: number, id: string): void {
    closeStream = backend.streamJobEvents(id, function (payload) {
      if (token !== runToken) return;
      handleEvent(token, id, payload);
    }, function (err) {
      if (token !== runToken) return;
      failTransport(err);
    });
  }

  /**
   * Ensure the stream is attached, creating it if necessary.
   */
  function ensureStreamAttached(token: number, id: string, pendingName: string): boolean {
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

  /**
   * Send a resume request to the backend.
   */
  function requestResume(token: number, id: string): void {
    phase = 'resuming';
    backend.resumeJob(id).catch(function (err) {
      if (token !== runToken) return;
      phase = 'paused';
      rejectDeferred('resume', err);
      notifyError(err);
    });
  }

  /**
   * Send a cancel request to the backend.
   */
  function requestCancel(token: number, id: string): void {
    phase = 'cancelling';
    backend.cancelJob(id).catch(function (err) {
      if (token !== runToken) return;
      phase = lifecycleState === 'PAUSED' ? 'paused' : 'solving';
      rejectDeferred('cancel', err);
      notifyError(err);
    });
  }

  /**
   * Handle an incoming event from the solver backend.
   */
  function handleEvent(token: number, expectedId: string, payload: unknown): void {
    var event = normalizeJobEvent(payload as SF.BackendPayload, expectedId);
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

  /**
   * Fetch and sync snapshot and optional analysis for terminal events.
   */
  function syncSnapshotBundle(meta: SF.EventMeta, requireSnapshot: boolean): Promise<{ meta: SF.EventMeta, snapshot: SF.SolverSnapshot | null, analysis: SF.SolverAnalysis | null }> {
    var analysisRequired = !!config.onAnalysis;
    var snapshotRevision = meta && meta.snapshotRevision != null ? meta.snapshotRevision : null;

    return backend.getSnapshot(meta.jobId, snapshotRevision).then(function (snapshotPayload) {
      var snapshot = normalizeSnapshot(snapshotPayload as SF.BackendPayload, meta);
      if (!snapshot) throw new Error('Solver backend returned an invalid snapshot payload');

      var mergedMeta = mergeMeta(meta, snapshot, meta.eventType);
      var result = {
        meta: mergedMeta,
        snapshot: snapshot,
        analysis: null,
      };

      if (!analysisRequired) return result;

      return backend.analyzeSnapshot(meta.jobId, mergedMeta.snapshotRevision).then(function (analysisPayload) {
        result.analysis = normalizeAnalysis(analysisPayload as SF.BackendPayload, mergedMeta);
        return result;
      });
    }).catch(function (err) {
      if (requireSnapshot) throw err;

      var fallback = { meta: meta, snapshot: null, analysis: null };
      if (!analysisRequired || snapshotRevision == null) return fallback;

      return backend.analyzeSnapshot(meta.jobId, snapshotRevision).then(function (analysisPayload) {
        fallback.analysis = normalizeAnalysis(analysisPayload as SF.BackendPayload, meta);
        return fallback;
      }).catch(function () {
        return fallback;
      });
    });
  }

  /**
   * Apply a snapshot bundle to the current state.
   */
  function applyBundle(bundle: { meta: SF.EventMeta, snapshot: SF.SolverSnapshot | null, analysis: SF.SolverAnalysis | null }): void {
    if (!bundle) return;
    lastMeta = bundle.meta;
    if (bundle.meta && bundle.meta.snapshotRevision != null) {
      lastSnapshotRevision = bundle.meta.snapshotRevision;
    }
    applyEventMeta(bundle.meta, bundle.analysis);
    if (bundle.analysis && config.onAnalysis) config.onAnalysis(bundle.analysis, bundle.meta);
  }

  /**
   * Finalize state after a terminal event.
   */
  function finalizeTerminal(meta: SF.EventMeta): void {
    closeCurrentStream();
    activeJobId = null;
    queuedAction = null;
    phase = 'idle';
    applyLifecycleState(meta && meta.lifecycleState ? meta.lifecycleState : 'IDLE');
    updateMoves(null);
  }

  /**
   * Handle transport-level failure (stream closed).
   */
  function failTransport(err: Error): void {
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

  /**
   * Handle startup failure (job creation failed).
   */
  function failStartup(err: Error): void {
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

  /**
   * Apply event metadata to the UI status bar.
   */
  function applyEventMeta(
    meta: SF.EventMeta | null,
    analysis?: SF.SolverAnalysis | null
  ) {
    applyLifecycleState(meta && meta.lifecycleState ? meta.lifecycleState : lifecycleState);
    updateScore(readDisplayScore(meta, analysis));
    updateMoves(meta ? readMovesPerSecond(meta.telemetry) : null);
    if (analysis) {
      var constraints = readAnalysisConstraints(analysis);
      if (constraints && constraints.length && statusBar && statusBar.colorDotsFromAnalysis) {
        statusBar.colorDotsFromAnalysis(constraints);
      }
    }
  }

  /**
   * Extract display score from meta or analysis.
   */
  function readDisplayScore(meta: SF.EventMeta | null, analysis: SF.SolverAnalysis | null): string | number | null {
    if (meta && (meta.currentScore || meta.bestScore)) return meta.currentScore || meta.bestScore;
    if (analysis && analysis.score != null) return analysis.score;
    return null;
  }

  /**
   * Apply lifecycle state to the UI status bar.
   */
  function applyLifecycleState(state: SF.LifecycleState): void {
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

  /**
   * Update the score display on the status bar.
   */
  function updateScore(score: string | number | null): void {
    if (statusBar && typeof statusBar.updateScore === 'function') {
      statusBar.updateScore(score);
    }
  }

  /**
   * Update the moves per second display on the status bar.
   */
  function updateMoves(value: number | null): void {
    if (statusBar && typeof statusBar.updateMoves === 'function') {
      statusBar.updateMoves(value);
    }
  }

  /**
   * Reset internal state before starting a new job.
   */
  function resetForStart(): void {
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

  /**
   * Reset internal state after a job is deleted.
   */
  function resetAfterDelete(): void {
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

  /**
   * Close the current event stream.
   */
  function closeCurrentStream(): void {
    if (!closeStream) return;
    closeStream();
    closeStream = null;
  }

  /**
   * Get the current job ID (active or retained).
   */
  function currentJobId(): string | null {
    return activeJobId != null ? activeJobId : retainedJobId;
  }

  /**
   * Check if there's a newer event than the given meta.
   */
  function hasNewerEvent(meta: SF.EventMeta): boolean {
    var currentSequence = lastMeta && typeof lastMeta.eventSequence === 'number' ? lastMeta.eventSequence : null;
    var candidateSequence = meta && typeof meta.eventSequence === 'number' ? meta.eventSequence : null;
    if (currentSequence == null || candidateSequence == null) return false;
    return currentSequence > candidateSequence;
  }

  /**
   * Resolve the snapshot revision to request.
   */
  function resolveRequestedSnapshotRevision(snapshotRevision: number | string | null): number | string | null {
    if (snapshotRevision != null && snapshotRevision !== '') return snapshotRevision;
    return lastSnapshotRevision;
  }

  /**
   * Create a terminal sync record for an event.
   */
  function createTerminalSync(event: { eventType: string, meta: SF.EventMeta }): SF.TerminalSyncRecord {
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

  /**
   * Run terminal sync for a completed/cancelled/failed event.
   */
  function runTerminalSync(record: SF.TerminalSyncRecord, token: number, event: { eventType: string, meta: SF.EventMeta, error?: string }, requireSnapshot: boolean): Promise<unknown> {
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

  /**
   * Ensure terminal sync is complete before allowing delete.
   */
  function ensureTerminalSyncBeforeDelete(jobId: string): Promise<void> {
    var record = terminalSync && terminalSync.jobId === jobId ? terminalSync : null;
    if (!record) return Promise.resolve();

    return Promise.resolve(record.promise).then(function () {
      if (!requiresSuccessfulTerminalSync(record)) return;
      if (record.status === 'synced') return;
      return retryTerminalSync(record);
    });
  }

  /**
   * Retry terminal sync if it failed.
   */
  function retryTerminalSync(record: SF.TerminalSyncRecord): Promise<void> {
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

  /**
   * Check if a record requires successful terminal sync.
   */
  function requiresSuccessfulTerminalSync(record: { eventType: string, meta: SF.EventMeta }): boolean {
    return record.eventType === 'completed';
  }

  /**
   * Deliver terminal callback for completed/cancelled/failed events.
   */
  function deliverTerminalCallback(record: SF.TerminalSyncRecord, event: { eventType: string, meta: SF.EventMeta, error?: string }, bundle: { meta: SF.EventMeta, snapshot: SF.SolverSnapshot | null, analysis: SF.SolverAnalysis | null }): void {
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

  /**
   * Deliver failure callback when terminal sync fails.
   */
  function deliverTerminalFailureCallback(record: SF.TerminalSyncRecord, event: { eventType: string, meta: SF.EventMeta, error?: string }): void {
    if (record.callbackDelivered || event.eventType !== 'failed') return;
    if (config.onFailure) config.onFailure(event.error || 'Solver job failed', event.meta, null, null);
    record.callbackDelivered = true;
  }

  /**
   * Create an error for a terminal event.
   */
  function terminalEventError(event: { eventType: string, error?: string }): Error | null {
    if (event.eventType !== 'failed') return null;
    return new Error(event.error || 'Solver job failed');
  }

  /**
   * Check if the current phase is cancelable.
   */
  function isCancelablePhase(): boolean {
    return phase === 'solving' || phase === 'pause-requested' || phase === 'paused' || phase === 'resuming';
  }

  /**
   * Map lifecycle state to internal phase.
   */
  function phaseForLifecycleState(state: SF.LifecycleState): SF.SolverPhase {
    if (state === 'STARTING') return 'starting';
    if (state === 'SOLVING') return 'solving';
    if (state === 'PAUSE_REQUESTED') return 'pause-requested';
    if (state === 'PAUSED') return 'paused';
    if (state === 'RESUMING') return 'resuming';
    if (state === 'CANCELLING') return 'cancelling';
    return 'idle';
  }

  /**
   * Check if a lifecycle state is terminal.
   */
  function isTerminalLifecycle(state: SF.LifecycleState): boolean {
    return state === 'COMPLETED'
      || state === 'CANCELLED'
      || state === 'FAILED'
      || state === 'TERMINATED_BY_CONFIG';
  }

  /**
   * Settle pending deferreds when a terminal event occurs.
   */
  function settlePendingFromTerminal(eventType: string, bundle: { meta: SF.EventMeta, snapshot: SF.SolverSnapshot | null, analysis: SF.SolverAnalysis | null } | null, err: Error | null): void {
    if (eventType === 'cancelled') {
      if (pendingCancel) {
        if (bundle) pendingCancel.resolve(bundle);
        else pendingCancel.reject(err || new Error('Cancel did not settle before the job terminated'));
        pendingCancel = null;
      }
    } else if (pendingCancel) {
      if (bundle) pendingCancel.resolve(bundle);
      else pendingCancel.reject(err || new Error('Cancel did not settle before the job terminated'));
      pendingCancel = null;
    }

    if (pendingPause) {
      pendingPause.reject(err || new Error('Job terminated before pause settled'));
      pendingPause = null;
    }
    if (pendingResume) {
      pendingResume.reject(err || new Error('Job terminated before resume settled'));
      pendingResume = null;
    }
  }

  /**
   * Resolve a deferred promise.
   */
  function resolveDeferred(name: string, value: unknown): void {
    var deferred = getDeferred(name);
    if (!deferred) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (deferred as any).resolve(value);
    setDeferred(name, null);
  }

  /**
   * Reject a deferred promise.
   */
  function rejectDeferred(name: string, err: Error): void {
    var deferred = getDeferred(name);
    if (!deferred) return;
    deferred.reject(err);
    setDeferred(name, null);
  }

  /**
   * Get a deferred by name.
   */
  function getDeferred(name: string) {
    if (name === 'pause') return pendingPause;
    if (name === 'resume') return pendingResume;
    if (name === 'cancel') return pendingCancel;
    return null;
  }

  /**
   * Set a deferred by name.
   */
  function setDeferred(name: string, value: unknown): void {
    if (name === 'pause') pendingPause = value as SF.Deferred<{ snapshot: SF.SolverSnapshot | null; meta: SF.EventMeta; analysis: SF.SolverAnalysis | null } | null>;
    if (name === 'resume') pendingResume = value as SF.Deferred<SF.EventMeta | null>;
    if (name === 'cancel') pendingCancel = value as SF.Deferred<{ snapshot: SF.SolverSnapshot | null; meta: SF.EventMeta; analysis: SF.SolverAnalysis | null } | null>;
  }

  /**
   * Notify error through the config.onError callback.
   */
  function notifyError(err: Error): void {
    if (err && lastNotifiedError === err) return;
    lastNotifiedError = err || null;
    if (config.onError) config.onError(err && err.message ? err.message : String(err));
  }

  /**
   * Ensure a valid job ID from the backend response.
   */
  function ensureJobId(id: unknown): string {
    var jobId = normalizeCreateJobId(id);
    if (jobId) return jobId;
    throw new Error('Invalid solver backend createJob response');
  }
};

/**
 * Check if an object has a function property.
 */
function hasFunction(object: object, key: string): boolean {
  return !!(object && typeof object[key] === 'function');
}

/**
 * Create a deferred promise object.
 */
function createDeferred<T>(): SF.Deferred<T> {
  var resolve: (value: T) => void;
  var reject: (error: Error) => void;
  var promise = new Promise<T>(function (res, rej) {
    resolve = res;
    reject = rej;
  });
  return { promise: promise, resolve: resolve, reject: reject };
}

/**
 * Normalize a job event payload into a standard event object.
 */
function normalizeJobEvent(payload: SF.BackendPayload, expectedId: string): SF.NormalizedJobEvent | null {
  if (!payload || typeof payload !== 'object') return null;

  var eventType = normalizeEventType(readField(payload, ['eventType', 'event_type', 'type']) as string | null);
  if (!eventType) return null;

  var jobId: string | null = (readField(payload, ['jobId', 'job_id', 'id'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) as string | null);
  if (jobId == null || jobId === '') jobId = expectedId;
  if (jobId == null || jobId === '') return null;
  if (String(jobId) !== String(expectedId)) return null;

  var solution = payload.solution || (payload.data && payload.data.solution) || null;
  var solutionScore = readField(solution as SF.BackendPayload | null, ['score'], [solution as SF.BackendPayload | null]);
  var meta: SF.EventMeta = {
    id: String(jobId),
    jobId: String(jobId),
    eventType: eventType,
    eventSequence: readField(payload, ['eventSequence', 'event_sequence'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) as number | null,
    lifecycleState: normalizeLifecycleState(readField(payload, ['lifecycleState', 'lifecycle_state', 'solverStatus', 'solver_status'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) as string | null, eventType),
    terminalReason: (readField(payload, ['terminalReason', 'terminal_reason'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) as string | null) || null,
    telemetry: normalizeTelemetry(readField(payload, ['telemetry'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]), payload),
    currentScore: (readField(payload, ['currentScore', 'current_score'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) as string | null) || (solutionScore != null ? String(solutionScore) : null) || null,
    bestScore: (readField(payload, ['bestScore', 'best_score'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) as string | null) || (solutionScore != null ? String(solutionScore) : null) || null,
    snapshotRevision: readField(payload, ['snapshotRevision', 'snapshot_revision'], [payload, payload.metadata, payload.data, payload.data && payload.data.metadata]) as number | string | null,
  };

  return {
    eventType: eventType,
    meta: meta,
    solution: solution,
    error: (readField(payload, ['error'], [payload, payload.data]) as string | null) || null,
  };
}

/**
 * Normalize a snapshot payload into a standard snapshot object.
 */
function normalizeSnapshot(
  payload: SF.BackendPayload,
  fallbackMeta: SF.EventMeta | null
): SF.SolverSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;

  var jobId = readField(payload, ['jobId', 'job_id', 'id'], [payload, payload.data]) as string | null;
  if (jobId == null || jobId === '') jobId = fallbackMeta && fallbackMeta.jobId;
  var solution = payload.solution || (payload.data && payload.data.solution) || null;
  var solutionScore = readField(solution as SF.BackendPayload | null, ['score'], [solution as SF.BackendPayload | null]);
  return {
    id: jobId != null ? String(jobId) : null,
    jobId: jobId != null ? String(jobId) : null,
    snapshotRevision: readField(payload, ['snapshotRevision', 'snapshot_revision'], [payload, payload.data]) as number | string | null,
    lifecycleState: normalizeLifecycleState(readField(payload, ['lifecycleState', 'lifecycle_state'], [payload, payload.data]) as string | null, fallbackMeta && fallbackMeta.eventType),
    terminalReason: (readField(payload, ['terminalReason', 'terminal_reason'], [payload, payload.data]) as string | null) || null,
    currentScore: (readField(payload, ['currentScore', 'current_score'], [payload, payload.data]) as string | null) || (solutionScore != null ? String(solutionScore) : null) || null,
    bestScore: (readField(payload, ['bestScore', 'best_score'], [payload, payload.data]) as string | null) || (solutionScore != null ? String(solutionScore) : null) || null,
    telemetry: normalizeTelemetry(readField(payload, ['telemetry'], [payload, payload.data]), payload),
    solution: solution,
  };
}

/**
 * Normalize an analysis payload into a standard analysis object.
 */
function normalizeAnalysis(
  payload: SF.BackendPayload,
  fallbackMeta: SF.EventMeta | null
): SF.SolverAnalysis | null {
  if (!payload || typeof payload !== 'object') return null;

  var analysisBody = payload.analysis || (payload.data && payload.data.analysis) || payload;
  var constraints = readAnalysisConstraints(analysisBody as SF.SolverAnalysis | null);
  var jobId = readField(payload, ['jobId', 'job_id', 'id'], [payload, payload.data]) as string | null;
  if (jobId == null || jobId === '') jobId = fallbackMeta && fallbackMeta.jobId;
  var snapshotRevision: number | string | null = (readField(payload, ['snapshotRevision', 'snapshot_revision'], [payload, payload.data]) as number | string | null);
  if (snapshotRevision == null || snapshotRevision === '') {
    snapshotRevision = fallbackMeta && fallbackMeta.snapshotRevision;
  }
  return {
    jobId: jobId != null ? String(jobId) : null,
    snapshotRevision: snapshotRevision != null ? snapshotRevision : null,
    lifecycleState: normalizeLifecycleState(readField(payload, ['lifecycleState', 'lifecycle_state'], [payload, payload.data]) as string | null, fallbackMeta && fallbackMeta.eventType),
    terminalReason: (readField(payload, ['terminalReason', 'terminal_reason'], [payload, payload.data]) as string | null) || (fallbackMeta && fallbackMeta.terminalReason) || null,
    analysis: analysisBody,
    score: (analysisBody as Record<string, unknown>).score != null ? ((analysisBody as Record<string, unknown>).score as string | number) : null,
    constraints: constraints,
  };
}

/**
 * Build a live snapshot from an event.
 */
function buildLiveSnapshot(event: { eventType: string, meta: SF.EventMeta, solution: unknown }): SF.SolverSnapshot {
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

/**
 * Merge metadata from event and snapshot.
 */
function mergeMeta(meta: SF.EventMeta | null, snapshot: SF.SolverSnapshot | null, eventType: string): SF.EventMeta {
  if (!snapshot) return meta;
  return {
    id: meta && meta.id != null ? meta.id : snapshot.id,
    jobId: meta && meta.jobId != null ? meta.jobId : snapshot.jobId,
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

/**
 * Read a field from a payload, trying multiple possible names and sources.
 */
function readField(
  payload: SF.BackendPayload,
  names: string | string[],
  sources?: SF.BackendPayload[]
): unknown {
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

/**
 * Normalize an event type string.
 */
function normalizeEventType(value: string): string | null {
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

/**
 * Normalize a lifecycle state string.
 */
function normalizeLifecycleState(value: string | null, eventType: string | null): SF.LifecycleState {
  if (typeof value === 'string' && value.trim()) {
    return value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toUpperCase() as SF.LifecycleState;
  }

  if (eventType === 'progress' || eventType === 'best_solution' || eventType === 'resumed') return 'SOLVING' as SF.LifecycleState;
  if (eventType === 'pause_requested') return 'PAUSE_REQUESTED' as SF.LifecycleState;
  if (eventType === 'paused') return 'PAUSED' as SF.LifecycleState;
  if (eventType === 'completed') return 'COMPLETED' as SF.LifecycleState;
  if (eventType === 'cancelled') return 'CANCELLED' as SF.LifecycleState;
  if (eventType === 'failed') return 'FAILED' as SF.LifecycleState;
  return 'IDLE' as SF.LifecycleState;
}

/**
 * Normalize telemetry data.
 */
function normalizeTelemetry(rawTelemetry: unknown, payload: SF.BackendPayload): Record<string, number> | null {
  if (rawTelemetry && typeof rawTelemetry === 'object') return rawTelemetry as Record<string, number>;

  var telemetry: Record<string, number> = ({});
  var movesPerSecond = readField(payload, ['movesPerSecond', 'moves_per_second']);
  var stepCount = readField(payload, ['stepCount', 'step_count']);
  if (movesPerSecond != null) telemetry.movesPerSecond = Number(movesPerSecond);
  if (stepCount != null) telemetry.stepCount = Number(stepCount);
  return Object.keys(telemetry).length ? telemetry : null;
}

/**
 * Extract movesPerSecond from telemetry.
 */
function readMovesPerSecond(telemetry: Record<string, unknown> | null): number | null {
  if (!telemetry || typeof telemetry !== 'object') return null;

  const value = telemetry.movesPerSecond ?? telemetry.moves_per_second;
  if (value == null) return null;

  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function readAnalysisConstraints(analysis: SF.SolverAnalysis | null): unknown[] | null {
  if (!analysis || typeof analysis !== 'object') return null;
  const a = analysis as unknown as Record<string, unknown>;
  if (Array.isArray(a.constraints)) return a.constraints as unknown[];
  const nested = a.analysis as Record<string, unknown> | null;
  if (nested && Array.isArray(nested.constraints)) return nested.constraints as unknown[];
  return null;
}

/**
 * Check if a lifecycle state is active (not idle or terminal).
 */
function isActiveLifecycle(state: SF.LifecycleState): boolean {
  return state === 'STARTING'
    || state === 'SOLVING'
    || state === 'PAUSE_REQUESTED'
    || state === 'RESUMING'
    || state === 'CANCELLING';
}
