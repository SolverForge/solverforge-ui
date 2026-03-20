/* ============================================================================
   SolverForge UI — Backend Adapters
   Pluggable transport: Axum, Tauri IPC, generic fetch.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createBackend = function (config) {
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
    if (raw.scheduleId != null) return String(raw.scheduleId).trim();
    if (raw.schedule_id != null) return String(raw.schedule_id).trim();

    if (raw.data && typeof raw.data === 'object' && raw.data.id != null) {
      return String(raw.data.id).trim();
    }
    return '';
  }

  function resolveEventJobId(payload) {
    if (!payload || typeof payload !== 'object') return '';
    if (payload.jobId != null) return String(payload.jobId).trim();
    if (payload.job_id != null) return String(payload.job_id).trim();
    if (payload.scheduleId != null) return String(payload.scheduleId).trim();
    if (payload.schedule_id != null) return String(payload.schedule_id).trim();
    if (payload.id != null) return String(payload.id).trim();
    if (payload.data && typeof payload.data === 'object' && payload.data.jobId != null) return String(payload.data.jobId).trim();
    return '';
  }

  /* ── HTTP backend (Axum, Rails, anything) ── */

  function createHttpBackend(config) {
    var baseUrl = config.baseUrl || '';
    var schedulesPath = config.schedulesPath || '/schedules';
    var demoDataPath = config.demoDataPath || '/demo-data';
    var extraHeaders = config.headers || {};

    function headers(extra) {
      var h = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders, extra || {});
      return h;
    }

    function request(method, path, body) {
      var opts = { method: method, headers: headers() };
      if (body !== undefined) opts.body = JSON.stringify(body);
      return fetch(baseUrl + path, opts).then(function (res) {
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        var ct = res.headers.get('content-type') || '';
        return ct.indexOf('json') !== -1 ? res.json() : res.text();
      });
    }

    return {
      createSchedule: function (data) {
        return request('POST', schedulesPath, data).then(resolveJobId);
      },
      getSchedule: function (id) {
        return request('GET', schedulesPath + '/' + id);
      },
      deleteSchedule: function (id) {
        return request('DELETE', schedulesPath + '/' + id);
      },
      analyze: function (id) {
        return request('GET', schedulesPath + '/' + id + '/analyze');
      },
      getDemoData: function (name) {
        return request('GET', demoDataPath + '/' + (name || 'STANDARD'));
      },
      listDemoData: function () {
        return request('GET', demoDataPath);
      },
      streamEvents: function (id, onMessage) {
        var url = baseUrl + schedulesPath + '/' + id + '/events';
        var es = new EventSource(url);
        es.onmessage = function (e) {
          try { onMessage(JSON.parse(e.data)); } catch (_) {}
        };
        return function close() { es.close(); };
      },
    };
  }

  /* ── Tauri IPC backend ── */

  function createTauriBackend(config) {
    var invoke = config.invoke;
    var listen = config.listen;
    var commands = config.commands || {};
    var eventName = config.eventName || 'solver-update';

    return {
      createSchedule: function (data) {
        return invoke(commands.startSolve || 'create_schedule', { request: data });
      },
      getSchedule: function (id) {
        return invoke(commands.getSchedule || 'get_schedule', { id: id });
      },
      deleteSchedule: function (id) {
        return invoke(commands.stopSolve || 'delete_schedule', { id: id });
      },
      analyze: function (id) {
        return invoke(commands.analyze || 'score_schedule', { id: id });
      },
      getDemoData: function (name) {
        return invoke(commands.demoData || 'demo_seed', { name: name });
      },
      listDemoData: function () {
        return Promise.resolve([]);
      },
      streamEvents: function (id, onMessage) {
        var targetId = String(id);
        var unlisten = null;
        listen(eventName, function (event) {
          var payload = event && event.payload ? event.payload : {};
          if (resolveEventJobId(payload) !== targetId) return;
          onMessage(payload);
        }).then(function (fn) { unlisten = fn; });
        return function close() { if (unlisten) unlisten(); };
      },
    };
  }

})(SF);
