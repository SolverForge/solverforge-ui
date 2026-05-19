/* ============================================================================
   SolverForge UI — Backend Adapters
   Pluggable transport: Axum, Tauri IPC, generic fetch.
   ============================================================================ */

import { assert, normalizeCreateJobId } from "../core";

/**
 * Creates a backend adapter for the given transport type.
 */
export function createBackend(
  config: SF.BackendConfig = {}
): SF.BackendAdapter {
  const type = config.type ?? 'axum';

  if (type === 'tauri') {
    return createTauriBackend(config as SF.TauriBackendConfig);
  }

  return createHttpBackend(config);
}

/**
 * @param raw
 * @returns
 */
function resolveJobId(raw: unknown): string {
  return normalizeCreateJobId(raw);
}

/**
 * Extracts a job id string from a solver event payload.
 * @param payload
 * @returns
 */
function resolveEventJobId(payload: SF.SolverEvent): string {
  if (!payload || typeof payload !== 'object') return '';
  if (payload.jobId != null) return String(payload.jobId).trim();
  if (payload.job_id != null) return String(payload.job_id).trim();
  if (payload.id != null) return String(payload.id).trim();
  if (payload.data && typeof payload.data === 'object' && payload.data.id != null) return String(payload.data.id).trim();
  if (payload.data && typeof payload.data === 'object' && payload.data.jobId != null) return String(payload.data.jobId).trim();
  return '';
}

/**
 * @param path
 * @param snapshotRevision
 * @returns
 */
function withSnapshotRevision(path: string, snapshotRevision?: string | number): string {
  if (snapshotRevision == null || snapshotRevision === '') return path;
  return path + '?snapshot_revision=' + encodeURIComponent(String(snapshotRevision));
}

/* ── HTTP backend (Axum, Rails, anything) ── */

/**
 * Create a new HTTP backend instance.
 * @param config
 * @returns
 */
function createHttpBackend(config: SF.HttpBackendConfig): SF.BackendAdapter {
  var baseUrl = config.baseUrl || '';
  var jobsPath = config.jobsPath || '/jobs';
  var demoDataPath = config.demoDataPath || '/demo-data';
  var extraHeaders = config.headers || {};

  /**
   * Builds the HTTP headers object used for API requests.
   *
   * Default JSON headers are merged with configured global headers
   * and optional request-specific headers.
   *
   * @param extra
   * Additional headers to merge into the request.
   *
   * @returns
   * The final merged headers object.
   */
  function headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...extraHeaders,
      ...extra,
    };
  }

  /**
   * Creates an enriched Error with HTTP request context.
   * @param method
   * @param path
   * @param res
   * @returns
   */
  function createRequestError(method: string, path: string, res: { status: number; statusText: string }): SF.HttpError {
    var err = new Error(res.status + ' ' + res.statusText) as SF.HttpError;
    err.status = res.status;
    err.statusText = res.statusText;
    err.method = method;
    err.path = path;
    err.url = baseUrl + path;
    return err;
  }

  /**
   * Performs an HTTP request to the API.
   *
   * @template TResponse Expected response type.
   * @template TBody Request body type.
   *
   * @param method HTTP method (`GET`, `POST`, `PUT`, etc.).
   * @param path Relative endpoint path.
   * @param body Data sent in the request body.
   *
   * @returns
   *
   * @throws {Error} Throws an error when the HTTP response is not successful.
   */
  function request<TResponse, TBody = unknown>(
    method: string,
    path: string,
    body?: TBody
  ): Promise<TResponse> {
    const opts: RequestInit = {
      method,
      headers: headers(),
    };

    if (body !== undefined) opts.body = JSON.stringify(body);


    return fetch(baseUrl + path, opts).then(function (res) {
      if (!res.ok) throw createRequestError(method, path, res);
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('json')) {
        return res.json() as Promise<TResponse>;
      }

      return res.text() as unknown as TResponse;
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
        try { onMessage(JSON.parse(e.data)); } catch { }
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
 * @param config
 * @returns
 */
function createTauriBackend(config: SF.TauriBackendConfig): SF.BackendAdapter {
  assert(typeof config === 'object', 'createBackend({}) is required for Tauri adapter');
  assert(typeof config.invoke === 'function', 'Tauri backend requires config.invoke');
  assert(typeof config.listen === 'function', 'Tauri backend requires config.listen');

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
      var payload = {
        id: id,
        ...(snapshotRevision != null && snapshotRevision !== ''
          ? { snapshotRevision }
          : {}),
      };
      return invoke(commands.getSnapshot || 'get_snapshot', payload);
    },
    analyzeSnapshot: function (id, snapshotRevision) {
      var payload = {
        id: id,
        ...(snapshotRevision != null && snapshotRevision !== ''
          ? { snapshotRevision }
          : {}),
      };
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
    streamJobEvents: function (id, onMessage, _onError) {
      var targetId = String(id);
      var unlisten = null;
      listen(eventName, function (event) {
        var payload= (event && event.payload) || {} as  SF.SolverEvent ;
        var payloadId = resolveEventJobId(payload);
        if (payloadId && payloadId !== targetId) return;
        onMessage(payload as SF.SolverEvent);
      }).then(function (fn) { unlisten = fn; });
      return function close() { if (unlisten) unlisten(); };
    },
  };
}

/**
 * Creates an enriched Error for SSE stream closure events.
 * @param url
 * @returns
 */
function createSseClosedError(url: string): SF.SseError {
  var err = (new Error('Event stream closed for ' + url)) as SF.SseError;
  err.code = 'SSE_CLOSED';
  err.transport = 'sse';
  err.url = url;
  return err;
}
