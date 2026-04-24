/* ============================================================================
   SolverForge UI — Backend Adapters
   Pluggable transport: Axum, Tauri IPC, generic fetch.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createBackend = function (config) {
    config = config || {};
    var type = config.type || 'axum';
    if (type === 'tauri') return createTauriBackend(config);
    return createHttpBackend(config);
  };

  function resolveJobId(raw) {
    if (raw == null) return '';
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw).trim();
    if (typeof raw !== 'object') return '';

    if (raw.id != null) return String(raw.id).trim();
    if (raw.jobId != null) return String(raw.jobId).trim();
    if (raw.job_id != null) return String(raw.job_id).trim();

    if (raw.data && typeof raw.data === 'object' && raw.data.id != null) {
      return String(raw.data.id).trim();
    }
    return '';
  }

  function resolveEventJobId(payload) {
    if (!payload || typeof payload !== 'object') return '';
    if (payload.jobId != null) return String(payload.jobId).trim();
    if (payload.job_id != null) return String(payload.job_id).trim();
    if (payload.id != null) return String(payload.id).trim();
    if (payload.data && typeof payload.data === 'object' && payload.data.id != null) return String(payload.data.id).trim();
    if (payload.data && typeof payload.data === 'object' && payload.data.jobId != null) return String(payload.data.jobId).trim();
    return '';
  }

  function withSnapshotRevision(path, snapshotRevision) {
    if (snapshotRevision == null || snapshotRevision === '') return path;
    return path + '?snapshot_revision=' + encodeURIComponent(String(snapshotRevision));
  }

  /* ── HTTP backend (Axum, Rails, anything) ── */

  function createHttpBackend(config) {
    var baseUrl = config.baseUrl || '';
    var jobsPath = config.jobsPath || '/jobs';
    var demoDataPath = config.demoDataPath || '/demo-data';
    var extraHeaders = config.headers || {};

    function headers(extra) {
      var h = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders, extra || {});
      return h;
    }

    function createRequestError(method, path, res) {
      var err = new Error(res.status + ' ' + res.statusText);
      err.status = res.status;
      err.statusText = res.statusText;
      err.method = method;
      err.path = path;
      err.url = baseUrl + path;
      return err;
    }

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
          try { onMessage(JSON.parse(e.data)); } catch (_) {}
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
      streamJobEvents: function (id, onMessage) {
        var targetId = String(id);
        var unlisten = null;
        listen(eventName, function (event) {
          var payload = event && event.payload ? event.payload : {};
          var payloadId = resolveEventJobId(payload);
          if (payloadId && payloadId !== targetId) return;
          onMessage(payload);
        }).then(function (fn) { unlisten = fn; });
        return function close() { if (unlisten) unlisten(); };
      },
    };
  }

  function createSseClosedError(url) {
    var err = new Error('Event stream closed for ' + url);
    err.code = 'SSE_CLOSED';
    err.transport = 'sse';
    err.url = url;
    return err;
  }

})(SF);
