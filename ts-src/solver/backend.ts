/* ============================================================================
   SolverForge UI — Backend Adapters
   Pluggable transport: Axum, Tauri IPC, generic fetch.
   ============================================================================ */

(function (sf) {
  'use strict';

  /**
   * Creates a backend adapter for the given transport type.
   * @param {BackendConfig} config
   * @returns {BackendAdapter}
   */
  sf.createBackend = function (config) {
    config = config || {};
    var type = config.type || 'axum';
    if (type === 'tauri') {
      return createTauriBackend(/** @type {TauriBackendConfig} */(config));
    }
    return createHttpBackend(/** @type {HttpBackendConfig} */(config));
  };

  /**
   * @param {unknown} raw
   * @returns {string}
   */
  function resolveJobId(raw) {
    return sf.normalizeCreateJobId(raw);
  }

  /**
   * Extracts a job id string from a solver event payload.
   * @param {SolverEvent} payload
   * @returns {string}
   */
  function resolveEventJobId(payload) {
    if (!payload || typeof payload !== 'object') return '';
    if (payload.jobId != null) return String(payload.jobId).trim();
    if (payload.job_id != null) return String(payload.job_id).trim();
    if (payload.id != null) return String(payload.id).trim();
    if (payload.data && typeof payload.data === 'object' && payload.data.id != null) return String(payload.data.id).trim();
    if (payload.data && typeof payload.data === 'object' && payload.data.jobId != null) return String(payload.data.jobId).trim();
    return '';
  }

  /**
   * @param {string} path
   * @param {string|number|undefined} snapshotRevision
   * @returns {string}
   */
  function withSnapshotRevision(path, snapshotRevision) {
    if (snapshotRevision == null || snapshotRevision === '') return path;
    return path + '?snapshot_revision=' + encodeURIComponent(String(snapshotRevision));
  }

  /* ── HTTP backend (Axum, Rails, anything) ── */

  /**
   * Create a new HTTP backend instance.
   * @param {HttpBackendConfig} config
   * @returns {BackendAdapter}
   */
  function createHttpBackend(config) {
    var baseUrl = config.baseUrl || '';
    var jobsPath = config.jobsPath || '/jobs';
    var demoDataPath = config.demoDataPath || '/demo-data';
    var extraHeaders = config.headers || {};

    /**
     * @param {Record<string, string>|undefined} [extra]
     * @returns {Record<string, string>}
     */
    function headers(extra) {
      var h = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders, extra || {});
      return h;
    }

    /**
     * Creates an enriched Error with HTTP request context.
     * @param {string} method
     * @param {string} path
     * @param {{ status: number; statusText: string }} res
     * @returns {HttpError}
     */
    function createRequestError(method, path, res) {
      var err = /** @type {HttpError} */ (new Error(res.status + ' ' + res.statusText));
      err.status = res.status;
      err.statusText = res.statusText;
      err.method = method;
      err.path = path;
      err.url = baseUrl + path;
      return err;
    }

    /**
     * @param {string} method
     * @param {string} path
     * @param {unknown} [body]
     * @returns {Promise<unknown>}
     */
    function request(method, path, body) {
      var opts = { method: method, headers: headers() };
      if (body !== undefined) opts.body = JSON.stringify(body);
      return fetch(baseUrl + path, opts).then(function (res) {
        if (!res.ok) throw createRequestError(method, path, res);
        var ct = res.headers.get('content-type') || '';
        return ct.indexOf('json') !== -1 ? res.json() : res.text();
      });
    }

    return {
      createJob: function (data) {
        return request('POST', jobsPath, data).then(resolveJobId);
      },
      getJob: function (id) {
        return request('GET', jobsPath + '/' + id);
      },
      getJobStatus: function (id) {
        return request('GET', jobsPath + '/' + id + '/status');
      },
      getSnapshot: function (id, snapshotRevision) {
        return request('GET', withSnapshotRevision(jobsPath + '/' + id + '/snapshot', snapshotRevision));
      },
      analyzeSnapshot: function (id, snapshotRevision) {
        return request('GET', withSnapshotRevision(jobsPath + '/' + id + '/analysis', snapshotRevision));
      },
      pauseJob: function (id) {
        return request('POST', jobsPath + '/' + id + '/pause');
      },
      resumeJob: function (id) {
        return request('POST', jobsPath + '/' + id + '/resume');
      },
      cancelJob: function (id) {
        return request('POST', jobsPath + '/' + id + '/cancel');
      },
      deleteJob: function (id) {
        return request('DELETE', jobsPath + '/' + id);
      },
      getDemoData: function (name) {
        return request('GET', demoDataPath + '/' + (name || 'STANDARD'));
      },
      listDemoData: function () {
        return request('GET', demoDataPath);
      },
      streamJobEvents: function (id, onMessage, onError) {
        var url = baseUrl + jobsPath + '/' + id + '/events';
        var es = new EventSource(url);
        var closed = false;
        es.onmessage = function (e) {
          try { onMessage(JSON.parse(e.data)); } catch (_) { }
        };
        es.onerror = function () {
          if (closed || !onError) return;
          if (typeof EventSource !== 'undefined' && es.readyState === EventSource.CLOSED) {
            onError(createSseClosedError(url));
          }
        };
        return function close() {
          closed = true;
          es.onmessage = null;
          es.onerror = null;
          es.close();
        };
      },
    };
  }

  /* ── Tauri IPC backend ── */

  /**
   * Create a new IPC backend for Tauri
   * @param {TauriBackendConfig} config
   * @returns {BackendAdapter}
   */
  function createTauriBackend(config) {
    sf.assert(typeof config === 'object', 'createBackend({}) is required for Tauri adapter');
    sf.assert(typeof config.invoke === 'function', 'Tauri backend requires config.invoke');
    sf.assert(typeof config.listen === 'function', 'Tauri backend requires config.listen');

    var invoke = config.invoke;
    var listen = config.listen;
    var commands = config.commands || {};
    var eventName = config.eventName || 'solver-update';

    return {
      createJob: function (data) {
        return invoke(commands.createJob || 'create_job', { request: data }).then(resolveJobId);
      },
      getJob: function (id) {
        return invoke(commands.getJob || 'get_job', { id: id });
      },
      getJobStatus: function (id) {
        return invoke(commands.getJobStatus || 'get_job_status', { id: id });
      },
      getSnapshot: function (id, snapshotRevision) {
        var payload = { id: id };
        if (snapshotRevision != null && snapshotRevision !== '') payload.snapshotRevision = snapshotRevision;
        return invoke(commands.getSnapshot || 'get_snapshot', payload);
      },
      analyzeSnapshot: function (id, snapshotRevision) {
        var payload = { id: id };
        if (snapshotRevision != null && snapshotRevision !== '') payload.snapshotRevision = snapshotRevision;
        return invoke(commands.analyzeSnapshot || 'analyze_snapshot', payload);
      },
      pauseJob: function (id) {
        return invoke(commands.pauseJob || 'pause_job', { id: id });
      },
      resumeJob: function (id) {
        return invoke(commands.resumeJob || 'resume_job', { id: id });
      },
      cancelJob: function (id) {
        return invoke(commands.cancelJob || 'cancel_job', { id: id });
      },
      deleteJob: function (id) {
        return invoke(commands.deleteJob || 'delete_job', { id: id });
      },
      getDemoData: function (name) {
        return invoke(commands.demoData || 'demo_seed', { name: name });
      },
      listDemoData: function () {
        return Promise.resolve([]);
      },
      streamJobEvents: function (id, onMessage, onError) {
        var targetId = String(id);
        var unlisten = null;
        listen(eventName, function (event) {
          var payload = (event && event.payload) || /** @type {SolverEvent} */ ({});
          var payloadId = resolveEventJobId(payload);
          if (payloadId && payloadId !== targetId) return;
          onMessage(/** @type {SolverEvent} */(payload));
        }).then(function (fn) { unlisten = fn; });
        return function close() { if (unlisten) unlisten(); };
      },
    };
  }

  /**
   * Creates an enriched Error for SSE stream closure events.
   * @param {string} url
   * @returns {SseError}
   */
  function createSseClosedError(url) {
    var err = /** @type {SseError} */ (new Error('Event stream closed for ' + url));
    err.code = 'SSE_CLOSED';
    err.transport = 'sse';
    err.url = url;
    return err;
  }

})(SF);
