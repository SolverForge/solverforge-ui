/* ============================================================================
   SolverForge UI — Backend Adapters
   Pluggable transport: Axum, Tauri IPC, generic fetch.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createBackend = function (config) {
    config = config || {};
    var type = config.type || 'axum';
    sf.assert(type === 'axum' || type === 'fetch' || type === 'tauri', 'createBackend(type) must be axum, fetch, or tauri');
    if (type === 'tauri') return createTauriBackend(config);
    return createHttpBackend(config);
  };

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
        return request('POST', schedulesPath, data);
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
    sf.assert(typeof config === 'object', 'createBackend({}) is required for Tauri adapter');
    sf.assert(typeof config.invoke === 'function', 'Tauri backend requires config.invoke');
    sf.assert(typeof config.listen === 'function', 'Tauri backend requires config.listen');

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
        var unlisten = null;
        listen(eventName, function (event) {
          onMessage(event.payload);
        }).then(function (fn) { unlisten = fn; });
        return function close() { if (unlisten) unlisten(); };
      },
    };
  }

})(SF);
