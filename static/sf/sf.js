/* ============================================================================
   SolverForge UI — Core
   ============================================================================ */

const SF = (function () {
  'use strict';

  const sf = { version: '0.1.0' };

  /* ── Utilities ── */

  sf.escHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  sf.assert = function (cond, message) {
    if (!cond) throw new Error('[SolverForge] ' + message);
  };

  sf.el = function (tag, attrs) {
    var children = Array.prototype.slice.call(arguments, 2);
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') el.className = attrs[key];
        else if (key === 'style' && typeof attrs[key] === 'object') {
          Object.assign(el.style, attrs[key]);
        }
        else if (key.indexOf('on') === 0) el.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
        else if (key === 'dataset') Object.assign(el.dataset, attrs[key]);
        else if (key === 'html') el.innerHTML = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    children.forEach(function (child) {
      if (child == null) return;
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child instanceof Node) el.appendChild(child);
    });
    return el;
  };

  if (typeof window !== 'undefined') window.SF = sf;
  return sf;
})();
/* ============================================================================
   SolverForge UI — Score Parsing
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.score = {};

  sf.score.parseHard = function (scoreStr) {
    if (!scoreStr) return 0;
    var m = scoreStr.match(/(-?\d+)hard/);
    return m ? parseInt(m[1], 10) : 0;
  };

  sf.score.parseSoft = function (scoreStr) {
    if (!scoreStr) return 0;
    var m = scoreStr.match(/(-?\d+)soft/);
    return m ? parseInt(m[1], 10) : 0;
  };

  sf.score.parseMedium = function (scoreStr) {
    if (!scoreStr) return 0;
    var m = scoreStr.match(/(-?\d+)medium/);
    return m ? parseInt(m[1], 10) : 0;
  };

  sf.score.getComponents = function (scoreStr) {
    return {
      hard: sf.score.parseHard(scoreStr),
      medium: sf.score.parseMedium(scoreStr),
      soft: sf.score.parseSoft(scoreStr),
    };
  };

  sf.score.colorClass = function (scoreStr) {
    var hard = sf.score.parseHard(scoreStr);
    var soft = sf.score.parseSoft(scoreStr);
    return hard < 0 ? 'score-red' : soft < 0 ? 'score-yellow' : 'score-green';
  };

})(SF);
/* ============================================================================
   SolverForge UI — Color Factory
   Tango palette + project color assignment.
   ============================================================================ */

(function (sf) {
  'use strict';

  var SEQUENCE_1 = [0x8AE234, 0xFCE94F, 0x729FCF, 0xE9B96E, 0xAD7FA8];
  var SEQUENCE_2 = [0x73D216, 0xEDD400, 0x3465A4, 0xC17D11, 0x75507B];

  var colorMap = {};
  var nextColorCount = 0;

  function buildPercentageColor(floor, ceil, pct) {
    var red   = (floor & 0xFF0000) + Math.floor(pct * ((ceil & 0xFF0000) - (floor & 0xFF0000))) & 0xFF0000;
    var green = (floor & 0x00FF00) + Math.floor(pct * ((ceil & 0x00FF00) - (floor & 0x00FF00))) & 0x00FF00;
    var blue  = (floor & 0x0000FF) + Math.floor(pct * ((ceil & 0x0000FF) - (floor & 0x0000FF))) & 0x0000FF;
    return red | green | blue;
  }

  function nextColor() {
    var colorIndex = nextColorCount % SEQUENCE_1.length;
    var shadeIndex = Math.floor(nextColorCount / SEQUENCE_1.length);
    var color;
    if (shadeIndex === 0) {
      color = SEQUENCE_1[colorIndex];
    } else if (shadeIndex === 1) {
      color = SEQUENCE_2[colorIndex];
    } else {
      shadeIndex -= 3;
      var base = Math.floor((shadeIndex / 2) + 1);
      var divisor = 2;
      while (base >= divisor) divisor *= 2;
      base = (base * 2) - divisor + 1;
      color = buildPercentageColor(SEQUENCE_2[colorIndex], SEQUENCE_1[colorIndex], base / divisor);
    }
    nextColorCount++;
    return '#' + color.toString(16).padStart(6, '0');
  }

  sf.colors = {};

  sf.colors.pick = function (key) {
    if (colorMap[key] !== undefined) return colorMap[key];
    var c = nextColor();
    colorMap[key] = c;
    return c;
  };

  sf.colors.reset = function () {
    colorMap = {};
    nextColorCount = 0;
  };

  var PROJECT_COLORS = [
    { main: '#10b981', dark: '#047857', light: 'rgba(16,185,129,0.15)' },
    { main: '#3b82f6', dark: '#1d4ed8', light: 'rgba(59,130,246,0.15)' },
    { main: '#8b5cf6', dark: '#6d28d9', light: 'rgba(139,92,246,0.15)' },
    { main: '#f59e0b', dark: '#b45309', light: 'rgba(245,158,11,0.15)' },
    { main: '#ec4899', dark: '#be185d', light: 'rgba(236,72,153,0.15)' },
    { main: '#06b6d4', dark: '#0e7490', light: 'rgba(6,182,212,0.15)' },
    { main: '#f43f5e', dark: '#be123c', light: 'rgba(244,63,94,0.15)' },
    { main: '#84cc16', dark: '#4d7c0f', light: 'rgba(132,204,22,0.15)' },
  ];

  sf.colors.project = function (index) {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
  };

})(SF);
/* ============================================================================
   SolverForge UI — Button Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createButton = function (config) {
    sf.assert(config, 'createButton(config) requires a configuration object');

    var classes = ['sf-btn'];

    if (config.variant) classes.push('sf-btn--' + config.variant);
    if (config.size === 'small') classes.push('sf-btn--sm');
    if (config.size === 'large') classes.push('sf-btn--lg');
    if (config.pill) classes.push('sf-btn--pill');
    if (config.circle) classes.push('sf-btn--circle');
    if (config.outline) classes.push('sf-btn--outline');
    if (config.iconOnly) classes.push('sf-btn--icon');

    var btn = sf.el('button', {
      className: classes.join(' '),
      type: 'button',
    });

    if (config.disabled) btn.disabled = true;

    sf.assert(!config.onClick || typeof config.onClick === 'function', 'createButton(onClick) must be a function');

    if (config.icon) {
      var icon = sf.el('i', { className: 'fa-solid ' + config.icon });
      btn.appendChild(icon);
    }

    if (config.text && !config.circle) {
      btn.appendChild(document.createTextNode(config.text));
    }

    if (config.onClick) {
      btn.addEventListener('click', config.onClick);
    }

    if (config.tooltip) {
      btn.title = config.tooltip;
    }

    if (config.id) {
      btn.id = config.id;
    }

    if (config.dataset) {
      Object.assign(btn.dataset, config.dataset);
    }

    return btn;
  };

})(SF);
/* ============================================================================
   SolverForge UI — Header Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createHeader = function (config) {
    sf.assert(config, 'createHeader(config) requires a configuration object');

    var header = sf.el('header', { className: 'sf-header' });

    // Logo
    if (config.logo) {
      var logo = sf.el('img', {
        className: 'sf-header-logo',
        src: config.logo,
        alt: 'Logo',
      });
      header.appendChild(logo);
    }

    // Brand text
    var brand = sf.el('div', { className: 'sf-header-brand' });
    if (config.title) {
      brand.appendChild(sf.el('div', { className: 'sf-header-title' }, config.title));
    }
    if (config.subtitle) {
      brand.appendChild(sf.el('div', { className: 'sf-header-subtitle' }, config.subtitle));
    }
    header.appendChild(brand);

    // Nav tabs
    if (config.tabs && config.tabs.length > 0) {
      sf.assert(Array.isArray(config.tabs), 'createHeader(config.tabs) expects an array');
      var nav = sf.el('nav', { className: 'sf-header-nav' });
      config.tabs.forEach(function (tab) {
        sf.assert(tab && tab.id, 'createHeader tab entries require an id');
        sf.assert(typeof tab.label === 'string', 'createHeader tab entries require a label');
        var btn = sf.el('button', {
          className: 'sf-nav-btn' + (tab.active ? ' active' : ''),
          dataset: { tab: tab.id },
          onClick: function () {
            nav.querySelectorAll('.sf-nav-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            if (config.onTabChange) config.onTabChange(tab.id);
          },
        });
        if (tab.icon) {
          btn.appendChild(sf.el('i', { className: 'fa-solid ' + tab.icon }));
        }
        btn.appendChild(document.createTextNode(tab.label));
        nav.appendChild(btn);
      });
      header.appendChild(nav);
    }

    // Action buttons
    if (config.actions) {
      sf.assert(typeof config.actions === 'object', 'createHeader(config.actions) expects an object');
      sf.assert(!config.actions.onSolve || typeof config.actions.onSolve === 'function', 'createHeader(config.actions.onSolve) must be a function');
      sf.assert(!config.actions.onStop || typeof config.actions.onStop === 'function', 'createHeader(config.actions.onStop) must be a function');
      sf.assert(!config.actions.onAnalyze || typeof config.actions.onAnalyze === 'function', 'createHeader(config.actions.onAnalyze) must be a function');
      sf.assert(!config.onTabChange || typeof config.onTabChange === 'function', 'createHeader(config.onTabChange) must be a function');

      var actions = sf.el('div', { className: 'sf-header-actions' });

      // Spinner
      var spinner = sf.el('div', { className: 'sf-solving-spinner', id: 'sfSolvingSpinner' });
      actions.appendChild(spinner);

      if (config.actions.onSolve) {
        var solveBtn = sf.createButton({
          text: 'Solve',
          variant: 'success',
          icon: 'fa-play',
          id: 'sfSolveBtn',
          onClick: config.actions.onSolve,
        });
        actions.appendChild(solveBtn);
      }

      if (config.actions.onStop) {
        var stopBtn = sf.createButton({
          text: 'Stop',
          variant: 'danger',
          icon: 'fa-stop',
          id: 'sfStopBtn',
          onClick: config.actions.onStop,
        });
        stopBtn.style.display = 'none';
        actions.appendChild(stopBtn);
      }

      if (config.actions.onAnalyze) {
        var analyzeBtn = sf.createButton({
          variant: 'ghost',
          icon: 'fa-chart-bar',
          circle: true,
          id: 'sfAnalyzeBtn',
          tooltip: 'Score Analysis',
          onClick: config.actions.onAnalyze,
        });
        actions.appendChild(analyzeBtn);
      }

      header.appendChild(actions);
    }

    return header;
  };

})(SF);
/* ============================================================================
   SolverForge UI — Status Bar Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createStatusBar = function (config) {
    var bar = sf.el('div', { className: 'sf-statusbar' });
    var lastScore = null;

    // Score display
    var scoreEl = sf.el('span', { className: 'sf-statusbar-score', id: 'sfScoreDisplay' }, '\u2014');
    bar.appendChild(scoreEl);

    // Separator
    bar.appendChild(sf.el('span', { className: 'sf-statusbar-sep' }, '|'));

    // Constraint dots container
    var dotsContainer = sf.el('div', { className: 'sf-statusbar-constraints', id: 'sfConstraintDots' });
    bar.appendChild(dotsContainer);

    // Separator + moves display
    var movesSep = sf.el('span', { className: 'sf-statusbar-sep', id: 'sfMovesSep' }, '|');
    movesSep.style.display = 'none';
    bar.appendChild(movesSep);

    var movesEl = sf.el('span', { id: 'sfMovesDisplay' });
    movesEl.style.display = 'none';
    bar.appendChild(movesEl);

    // Separator + status text
    bar.appendChild(sf.el('span', { className: 'sf-statusbar-sep' }, '|'));
    var statusEl = sf.el('span', { id: 'sfStatusText' });
    bar.appendChild(statusEl);

    // Build initial constraint dots
    if (config && config.constraints) {
      buildDots(dotsContainer, config.constraints, config.onConstraintClick);
    }

    var api = { el: bar };

    api.updateScore = function (scoreStr) {
      if (scoreStr && scoreStr !== lastScore) {
        scoreEl.textContent = scoreStr;
        var colorClass = sf.score.colorClass(scoreStr);
        scoreEl.classList.remove('improved', 'score-green', 'score-red', 'score-yellow');
        scoreEl.classList.add(colorClass);
        void scoreEl.offsetWidth;
        scoreEl.classList.add('improved');
        lastScore = scoreStr;
      } else if (!scoreStr) {
        scoreEl.textContent = '\u2014';
        scoreEl.classList.remove('score-green', 'score-red', 'score-yellow', 'improved');
      }
    };

    api.setSolving = function (solving) {
      var solveBtn = document.getElementById('sfSolveBtn');
      var stopBtn = document.getElementById('sfStopBtn');
      var spinner = document.getElementById('sfSolvingSpinner');

      if (solveBtn) solveBtn.style.display = solving ? 'none' : '';
      if (stopBtn) stopBtn.style.display = solving ? '' : 'none';
      if (spinner) spinner.classList.toggle('active', solving);

      statusEl.textContent = solving ? 'Solving\u2026' : 'Ready';
      statusEl.style.color = solving
        ? 'var(--sf-emerald-600)'
        : 'var(--sf-gray-500)';
    };

    api.updateMoves = function (mps) {
      if (mps != null && mps > 0) {
        movesEl.textContent = mps.toLocaleString() + ' moves/s';
        movesEl.style.display = '';
        movesSep.style.display = '';
      } else {
        movesEl.style.display = 'none';
        movesSep.style.display = 'none';
      }
    };

    api.updateConstraintDots = function (constraints) {
      buildDots(dotsContainer, constraints, config && config.onConstraintClick);
    };

    api.colorDotsByScore = function (scoreStr) {
      var hard = sf.score.parseHard(scoreStr);
      var soft = sf.score.parseSoft(scoreStr);
      dotsContainer.querySelectorAll('.sf-constraint-dot').forEach(function (dot) {
        var isHard = dot.dataset.type === 'hard';
        dot.classList.toggle('violated', isHard && hard < 0);
        dot.classList.toggle('violated-soft', !isHard && soft < 0);
      });
    };

    api.colorDotsFromAnalysis = function (constraints) {
      if (!constraints || constraints.length === 0) return;
      buildDots(dotsContainer, constraints, config && config.onConstraintClick);
      constraints.forEach(function (c, i) {
        var dot = document.getElementById('sf-cdot-' + i);
        if (!dot) return;
        var isHard = c.type === 'hard';
        var scoreVal = isHard ? sf.score.parseHard(c.score) : sf.score.parseSoft(c.score);
        var violated = scoreVal < 0;
        dot.classList.toggle('violated', isHard && violated);
        dot.classList.toggle('violated-soft', !isHard && violated);
      });
    };

    return api;
  };

  function buildDots(container, constraints, onClick) {
    container.innerHTML = '';
    if (!constraints) return;
    constraints.forEach(function (c, i) {
      var dot = sf.el('div', {
        className: 'sf-constraint-dot',
        id: 'sf-cdot-' + i,
        title: c.name || ('Constraint ' + i),
        dataset: { type: c.type || 'hard', index: String(i) },
      });
      if (onClick) {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', function () { onClick(i); });
      }
      container.appendChild(dot);
    });
  }

})(SF);
/* ============================================================================
   SolverForge UI — Modal Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createModal = function (config) {
    sf.assert(config, 'createModal(config) requires a configuration object');
    sf.assert(!config.footer || Array.isArray(config.footer), 'createModal(config.footer) must be an array');

    var overlay = sf.el('div', { className: 'sf-modal-overlay' });
    var dialog = sf.el('div', { className: 'sf-modal' });

    // Header
    var header = sf.el('div', { className: 'sf-modal-header' });
    header.appendChild(sf.el('div', { className: 'sf-modal-title' }, config.title || ''));

    var closeBtn = sf.el('button', {
      className: 'sf-modal-close',
      html: '&times;',
      onClick: function () { api.close(); },
    });
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // Body
    var body = sf.el('div', { className: 'sf-modal-body' });
    if (config.body) {
      if (typeof config.body === 'string') {
        body.innerHTML = config.body;
      } else if (config.body instanceof Node) {
        body.appendChild(config.body);
      }
    }
    dialog.appendChild(body);

    // Footer
    if (config.footer) {
      var footer = sf.el('div', { className: 'sf-modal-footer' });
      config.footer.forEach(function (child) {
        footer.appendChild(child);
      });
      dialog.appendChild(footer);
    }

    overlay.appendChild(dialog);

    // Close on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) api.close();
    });

    // Close on Escape
    function onKeyDown(e) {
      if (e.key === 'Escape') api.close();
    }

    var api = { el: overlay, body: body };

    api.open = function () {
      document.body.appendChild(overlay);
      overlay.classList.add('open');
      document.addEventListener('keydown', onKeyDown);
    };

    api.close = function () {
      overlay.classList.remove('open');
      document.removeEventListener('keydown', onKeyDown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (config.onClose) config.onClose();
    };

    api.setBody = function (content) {
      body.innerHTML = '';
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof Node) {
        body.appendChild(content);
      }
    };

    if (config.width) {
      dialog.style.maxWidth = config.width;
    }

    return api;
  };

})(SF);
/* ============================================================================
   SolverForge UI — Tab Switching
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.showTab = function (tabId) {
    document.querySelectorAll('.sf-tab-panel').forEach(function (p) {
      p.classList.remove('active');
    });
    var panel = document.getElementById('sf-tab-' + tabId);
    if (panel) panel.classList.add('active');
  };

  sf.createTabs = function (config) {
    sf.assert(config, 'createTabs(config) requires a configuration object');
    sf.assert(Array.isArray(config.tabs), 'createTabs(config.tabs) must be an array');

    var container = sf.el('div', { className: 'sf-tabs-container' });

    config.tabs.forEach(function (tab) {
      var panel = sf.el('div', {
        className: 'sf-tab-panel' + (tab.active ? ' active' : ''),
        id: 'sf-tab-' + tab.id,
      });
      if (tab.content) {
        if (typeof tab.content === 'string') panel.innerHTML = tab.content;
        else if (tab.content instanceof Node) panel.appendChild(tab.content);
      }
      container.appendChild(panel);
    });

    return { el: container, show: sf.showTab };
  };

})(SF);
/* ============================================================================
   SolverForge UI — Table Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createTable = function (config) {
    sf.assert(config, 'createTable(config) requires a configuration object');
    sf.assert(!config.columns || Array.isArray(config.columns), 'createTable(config.columns) must be an array');
    sf.assert(!config.rows || Array.isArray(config.rows), 'createTable(config.rows) must be an array');

    var wrapper = sf.el('div', { className: 'sf-table-container' });
    var table = sf.el('table', { className: 'sf-table' });

    // Header
    if (config.columns) {
      var thead = sf.el('thead');
      var tr = sf.el('tr');
      config.columns.forEach(function (col) {
        var th = sf.el('th', null, typeof col === 'string' ? col : col.label);
        if (col.align) th.style.textAlign = col.align;
        if (col.width) th.style.width = col.width;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    // Body
    var tbody = sf.el('tbody');
    if (config.rows) {
      config.rows.forEach(function (row, rowIdx) {
        var tr = sf.el('tr');
        row.forEach(function (cell, colIdx) {
          var td = sf.el('td');
          if (typeof cell === 'string' || typeof cell === 'number') {
            td.textContent = cell;
          } else if (cell instanceof Node) {
            td.appendChild(cell);
          } else if (cell && cell.html) {
            td.innerHTML = cell.html;
          }
          var col = config.columns && config.columns[colIdx];
          if (col && col.align) td.style.textAlign = col.align;
          if (col && col.className) td.classList.add(col.className);
          tr.appendChild(td);
        });
        if (config.onRowClick) {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', function () { config.onRowClick(rowIdx, row); });
        }
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  };

})(SF);
/* ============================================================================
   SolverForge UI — Toast Notifications
   jQuery-free replacement for showError/showSimpleError.
   ============================================================================ */

(function (sf) {
  'use strict';

  var container = null;

  function ensureContainer() {
    if (container && document.body.contains(container)) return;
    container = sf.el('div', { className: 'sf-toast-container' });
    document.body.appendChild(container);
  }

  sf.showToast = function (config) {
    sf.assert(config, 'showToast(config) requires a configuration object');

    ensureContainer();

    var variant = config.variant || 'danger';
    var toast = sf.el('div', { className: 'sf-toast sf-toast--' + variant + ' sf-toast-enter' });

    var msg = sf.el('div', { className: 'sf-toast-message' });
    if (config.title) {
      msg.appendChild(sf.el('div', { className: 'sf-toast-title' }, config.title));
    }
    if (config.message) {
      msg.appendChild(sf.el('div', null, config.message));
    }
    if (config.detail) {
      var pre = sf.el('pre', { style: { margin: '4px 0 0', fontSize: '11px', whiteSpace: 'pre-wrap' } });
      pre.appendChild(sf.el('code', null, config.detail));
      msg.appendChild(pre);
    }
    toast.appendChild(msg);

    var closeBtn = sf.el('button', {
      className: 'sf-toast-close',
      html: '&times;',
      onClick: function () { dismiss(); },
    });
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    var delay = config.delay || 10000;
    var timer = setTimeout(dismiss, delay);

    function dismiss() {
      clearTimeout(timer);
      toast.classList.remove('sf-toast-enter');
      toast.classList.add('sf-toast-exit');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }
  };

  sf.showError = function (title, detail) {
    sf.showToast({ title: 'Error', message: title, detail: detail, variant: 'danger', delay: 30000 });
  };

})(SF);
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
    var running = false;

    var api = {};

    api.start = function (data) {
      if (running) return;
      running = true;

      if (statusBar) {
        statusBar.setSolving(true);
        statusBar.updateMoves(null);
      }

      backend.createSchedule(data).then(function (id) {
        jobId = typeof id === 'string' ? id.trim() : id;
        closeStream = backend.streamEvents(jobId, function (msg) {
          // Solver finished
          if (msg.solverStatus === 'NOT_SOLVING') {
            backend.getSchedule(jobId).then(function (final) {
              if (config.onComplete) config.onComplete(final);
              if (statusBar) {
                statusBar.updateScore(final.score);
                statusBar.updateMoves(null);
              }
            });
            api._cleanup(false);
            return;
          }

          // Live update
          if (statusBar) {
            statusBar.updateScore(msg.score);
            statusBar.updateMoves(msg.movesPerSecond);
          }
          if (config.onUpdate) config.onUpdate(msg);
        });
      }).catch(function (err) {
        running = false;
        if (statusBar) statusBar.setSolving(false);
        if (config.onError) config.onError(err.message || String(err));
      });
    };

    api.stop = function () {
      if (!running || !jobId) return;
      var stoppedId = jobId;

      // Fetch analysis before deleting
      backend.analyze(stoppedId).then(function (analysis) {
        if (statusBar && analysis && analysis.constraints) {
          statusBar.colorDotsFromAnalysis(analysis.constraints);
        }
        if (config.onAnalysis) config.onAnalysis(analysis);
      }).catch(function () {}).then(function () {
        backend.deleteSchedule(stoppedId).catch(function () {});
      });

      api._cleanup(true);
    };

    api._cleanup = function (stopped) {
      if (closeStream) { closeStream(); closeStream = null; }
      running = false;
      jobId = null;
      if (statusBar) {
        statusBar.setSolving(false);
        statusBar.updateMoves(null);
      }
    };

    api.isRunning = function () { return running; };

    api.getJobId = function () { return jobId; };

    return api;
  };

})(SF);
/* ============================================================================
   SolverForge UI — API Guide Panel
   Generates REST API documentation from endpoint definitions.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createApiGuide = function (config) {
    sf.assert(config, 'createApiGuide(config) requires a configuration object');
    sf.assert(Array.isArray(config.endpoints), 'createApiGuide(config.endpoints) must be an array');

    var guide = sf.el('div', { className: 'sf-api-guide' });
    var endpoints = config.endpoints;

    endpoints.forEach(function (ep) {
      var section = sf.el('div', { className: 'sf-api-section' });
      section.appendChild(sf.el('h3', null, (ep.method || 'GET') + ' ' + ep.path));
      if (ep.description) {
        section.appendChild(sf.el('p', { style: { fontSize: '13px', color: 'var(--sf-gray-600)', marginBottom: '8px' } }, ep.description));
      }

      if (ep.curl) {
        var block = sf.el('div', { className: 'sf-api-code-block' });
        block.appendChild(sf.el('code', null, ep.curl));
        var copyBtn = sf.el('button', {
          className: 'sf-copy-btn',
          onClick: function () {
            navigator.clipboard.writeText(ep.curl).then(function () {
              copyBtn.textContent = 'Copied!';
              setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
            });
          },
        }, 'Copy');
        block.appendChild(copyBtn);
        section.appendChild(block);
      }

      guide.appendChild(section);
    });

    return guide;
  };

  sf.createFooter = function (config) {
    sf.assert(config, 'createFooter(config) requires a configuration object');

    var footer = sf.el('footer', { className: 'sf-footer' });
    if (config.links) {
      config.links.forEach(function (link, i) {
        if (i > 0) footer.appendChild(sf.el('span', { className: 'sf-vr' }));
        footer.appendChild(sf.el('a', { href: link.url, target: '_blank' }, link.label));
      });
    }
    if (config.version) {
      footer.appendChild(sf.el('span', { style: { marginLeft: 'auto' } }, config.version));
    }
    return footer;
  };

})(SF);
/* ============================================================================
   SolverForge UI — Timeline Rail
   Resource-lane timeline: header + cards with positioned blocks.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.rail = {};

  sf.rail.createHeader = function (config) {
    sf.assert(config, 'createHeader(config) requires a configuration object');
    sf.assert(!config.columns || Array.isArray(config.columns), 'createHeader(config.columns) expects an array');

    var labelWidth = config.labelWidth || 200;
    var columns = config.columns || [];

    var header = sf.el('div', { className: 'sf-timeline-header' });
    header.style.gridTemplateColumns = labelWidth + 'px 1fr';

    var spacer = sf.el('div', { className: 'sf-timeline-label-spacer' }, config.label || '');
    header.appendChild(spacer);

    var days = sf.el('div', { className: 'sf-timeline-days' });
    days.style.gridTemplateColumns = 'repeat(' + columns.length + ', 1fr)';

    columns.forEach(function (col) {
      var colEl = sf.el('div', { className: 'sf-timeline-day-col' });
      colEl.appendChild(sf.el('span', null, typeof col === 'string' ? col : col.label));
      days.appendChild(colEl);
    });

    header.appendChild(days);
    return header;
  };

  sf.rail.createCard = function (config) {
    sf.assert(config, 'createCard(config) requires a configuration object');

    var labelWidth = config.labelWidth || 200;
    var card = sf.el('div', { className: 'sf-resource-card' });

    if (config.id) card.dataset.resourceId = config.id;

    // Header row (identity + gauges)
    var resHeader = sf.el('div', { className: 'sf-resource-header' });
    resHeader.style.gridTemplateColumns = labelWidth + 'px 1fr';

    var identity = sf.el('div', { className: 'sf-resource-identity' });
    if (config.name) {
      identity.appendChild(sf.el('div', { className: 'sf-resource-name' }, config.name));
    }
    if (config.badges || config.type) {
      var meta = sf.el('div', { className: 'sf-resource-meta' });
      if (config.type) {
        var badge = sf.el('span', { className: 'sf-resource-type-badge' }, config.type);
        if (config.typeStyle) {
          badge.style.background = config.typeStyle.bg || '';
          badge.style.color = config.typeStyle.color || '';
          badge.style.border = config.typeStyle.border || '';
        }
        meta.appendChild(badge);
      }
      identity.appendChild(meta);
    }
    resHeader.appendChild(identity);

    // Gauges
    if (config.gauges && config.gauges.length > 0) {
      var gauges = sf.el('div', { className: 'sf-gauges' });
      config.gauges.forEach(function (g) {
        var row = sf.el('div', { className: 'sf-gauge-row' });
        row.appendChild(sf.el('span', { className: 'sf-gauge-label' }, g.label));
        var track = sf.el('div', { className: 'sf-gauge-track' });
        var fill = sf.el('div', {
          className: 'sf-gauge-fill' + (g.style ? ' sf-gauge-fill--' + g.style : ''),
        });
        fill.style.width = Math.min(g.pct || 0, 100) + '%';
        track.appendChild(fill);
        row.appendChild(track);
        if (g.text) row.appendChild(sf.el('span', { className: 'sf-gauge-value' }, g.text));
        gauges.appendChild(row);
      });
      resHeader.appendChild(gauges);
    }

    card.appendChild(resHeader);

    // Body (stats + rail)
    var body = sf.el('div', { className: 'sf-resource-body' });
    body.style.gridTemplateColumns = labelWidth + 'px 1fr';

    // Stats panel
    var stats = sf.el('div', { className: 'sf-resource-stats' });
    if (config.stats) {
      config.stats.forEach(function (s) {
        var row = sf.el('div', { className: 'sf-stat-row' });
        row.appendChild(sf.el('span', { className: 'sf-stat-label' }, s.label));
        row.appendChild(sf.el('span', { className: 'sf-stat-value' }, String(s.value)));
        stats.appendChild(row);
      });
    }
    body.appendChild(stats);

    // Rail
    var railContainer = sf.el('div', { className: 'sf-rail-container' });
    var rail = sf.el('div', { className: 'sf-rail' });
    if (config.id) rail.id = 'sf-rail-' + config.id;

    // Day grid
    var numCols = config.columns || 5;
    var dayGrid = sf.el('div', { className: 'sf-day-grid' });
    dayGrid.style.gridTemplateColumns = 'repeat(' + numCols + ', 1fr)';
    for (var i = 0; i < numCols; i++) {
      dayGrid.appendChild(sf.el('div', { className: 'sf-day-col' }));
    }
    rail.appendChild(dayGrid);

    railContainer.appendChild(rail);
    body.appendChild(railContainer);
    card.appendChild(body);

    // API
    var cardApi = { el: card, rail: rail };

    cardApi.addBlock = function (blockConfig) {
      return sf.rail.addBlock(rail, blockConfig);
    };

    cardApi.clearBlocks = function () {
      rail.querySelectorAll('.sf-block, .sf-changeover').forEach(function (el) {
        el.remove();
      });
    };

    cardApi.setSolving = function (solving) {
      card.classList.toggle('solving', solving);
    };

    return cardApi;
  };

  sf.rail.addBlock = function (rail, config) {
    sf.assert(rail, 'addBlock(rail) requires a rail element');
    sf.assert(config && config.horizon != null, 'addBlock(config.horizon) is required');
    sf.assert(config.start != null && config.end != null, 'addBlock(config.start/config.end) are required');

    var horizon = config.horizon || 1;
    var startPct = (config.start / horizon) * 100;
    var widthPct = ((config.end - config.start) / horizon) * 100;

    var block = sf.el('div', { className: 'sf-block' });
    block.style.left = startPct + '%';
    block.style.width = Math.max(widthPct, 0.5) + '%';

    if (config.color) {
      block.style.background = config.color;
      block.style.borderLeftColor = config.borderColor || config.color;
    }
    if (config.className) block.classList.add(config.className);
    if (config.late) block.classList.add('late');
    if (config.id) block.dataset.blockId = config.id;
    if (config.delay) block.style.animationDelay = config.delay;

    if (config.label) {
      block.appendChild(sf.el('div', { className: 'sf-block-label' }, config.label));
    }
    if (config.meta) {
      block.appendChild(sf.el('div', { className: 'sf-block-meta' }, config.meta));
    }

    if (config.onHover) {
      block.addEventListener('mouseenter', function (e) { config.onHover(e, config); });
    }
    if (config.onLeave) {
      block.addEventListener('mouseleave', function () { config.onLeave(); });
    }
    if (config.onClick) {
      block.addEventListener('click', function (e) { config.onClick(e, config); });
    }

    rail.appendChild(block);
    return block;
  };

  sf.rail.addChangeover = function (rail, config) {
    sf.assert(rail, 'addChangeover(rail) requires a rail element');
    sf.assert(config && config.horizon != null, 'addChangeover(config.horizon) is required');
    sf.assert(config.start != null && config.end != null, 'addChangeover(config.start/config.end) are required');

    var horizon = config.horizon || 1;
    var startPct = (config.start / horizon) * 100;
    var widthPct = ((config.end - config.start) / horizon) * 100;

    var co = sf.el('div', { className: 'sf-changeover' });
    co.style.left = startPct + '%';
    co.style.width = widthPct + '%';
    rail.appendChild(co);
    return co;
  };

})(SF);
/* ============================================================================
   SolverForge UI — Gantt (Frappe Gantt + Split.js wrapper)
   Requires: Frappe Gantt (Gantt) and Split (Split) loaded globally.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.gantt = {};

  sf.gantt.create = function (config) {
    sf.assert(config, 'gantt.create(config) requires a configuration object');

    var chartPaneId = config.chartPane || 'sf-gantt-chart-pane';
    var gridPaneId = config.gridPane || 'sf-gantt-grid-pane';
    var chartContainerId = config.chartContainer || 'sf-gantt-container';
    var svgId = config.svgId || 'sf-gantt-svg';
    var ganttChart = null;
    var splitInstance = null;
    var tasks = [];

    // ── Build DOM ──
    var wrapper = sf.el('div', { className: 'sf-gantt-split' });

    // Grid pane
    var gridPane = sf.el('div', { className: 'sf-gantt-pane', id: gridPaneId });
    var gridHeader = sf.el('div', { className: 'sf-gantt-pane-header' });
    gridHeader.appendChild(sf.el('h3', null, config.gridTitle || 'Tasks'));
    var gridControls = sf.el('div', { className: 'sf-gantt-pane-controls' });
    gridHeader.appendChild(gridControls);
    gridPane.appendChild(gridHeader);

    var gridContent = sf.el('div', { className: 'sf-gantt-pane-content' });
    var grid = sf.el('div', { className: 'sf-gantt-grid' });
    gridContent.appendChild(grid);
    gridPane.appendChild(gridContent);

    // Chart pane
    var chartPane = sf.el('div', { className: 'sf-gantt-pane', id: chartPaneId });
    var chartHeader = sf.el('div', { className: 'sf-gantt-pane-header' });
    chartHeader.appendChild(sf.el('h3', null, config.chartTitle || 'Timeline'));

    // View mode selector
    var viewControls = sf.el('div', { className: 'sf-gantt-view-controls' });
    var viewSelect = sf.el('select', { className: 'sf-gantt-view-select' });
    var modes = [
      { value: 'Quarter Day', label: 'Quarter Day' },
      { value: 'Half Day', label: 'Half Day' },
      { value: 'Day', label: 'Day' },
      { value: 'Week', label: 'Week' },
      { value: 'Month', label: 'Month' },
    ];
    modes.forEach(function (m) {
      var opt = sf.el('option', { value: m.value }, m.label);
      if (m.value === (config.viewMode || 'Quarter Day')) opt.selected = true;
      viewSelect.appendChild(opt);
    });
    viewSelect.addEventListener('change', function () {
      if (ganttChart) {
        ganttChart.change_view_mode(viewSelect.value);
      }
    });
    viewControls.appendChild(viewSelect);

    var chartControls = sf.el('div', { className: 'sf-gantt-pane-controls' });
    chartHeader.appendChild(viewControls);
    chartHeader.appendChild(chartControls);
    chartPane.appendChild(chartHeader);

    var chartContent = sf.el('div', { className: 'sf-gantt-pane-content' });
    var chartContainer = sf.el('div', { className: 'sf-gantt-container', id: chartContainerId });
    chartContent.appendChild(chartContainer);
    chartPane.appendChild(chartContent);

    wrapper.appendChild(gridPane);
    wrapper.appendChild(chartPane);

    // ── API ──
    var ctrl = { el: wrapper };

    ctrl.mount = function (parent) {
      sf.assert(parent, 'gantt.mount(parent) requires a mount target');
      var target = typeof parent === 'string' ? document.getElementById(parent) : parent;
      sf.assert(target, 'gantt.mount(parent) target not found: ' + parent);
      target.appendChild(wrapper);
      initSplit();
    };

    ctrl.setTasks = function (newTasks) {
      sf.assert(Array.isArray(newTasks), 'gantt.setTasks(tasks) expects an array');
      tasks = newTasks;
      renderGrid(newTasks);
      renderChart(newTasks);
    };

    ctrl.refresh = function () {
      if (ganttChart && tasks.length > 0) {
        var frappeTasks = tasksToFrappe(tasks);
        ganttChart.refresh(frappeTasks);
      }
    };

    ctrl.getChart = function () { return ganttChart; };

    ctrl.changeViewMode = function (mode) {
      viewSelect.value = mode;
      if (ganttChart) ganttChart.change_view_mode(mode);
    };

    ctrl.highlightTask = function (taskId) {
      // Grid highlight
      grid.querySelectorAll('.sf-gantt-row').forEach(function (row) {
        row.classList.toggle('selected', row.dataset.taskId === taskId);
      });
      // Bar highlight
      var svg = chartContainer.querySelector('svg');
      if (svg) {
        svg.querySelectorAll('.bar-wrapper').forEach(function (bw) {
          bw.classList.remove('highlighted');
        });
        var bar = svg.querySelector('.bar-wrapper[data-id="' + taskId + '"]');
        if (bar) bar.classList.add('highlighted');
      }
    };

    ctrl.destroy = function () {
      if (splitInstance) { splitInstance.destroy(); splitInstance = null; }
      ganttChart = null;
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };

    return ctrl;

    // ── Internal ──

    function initSplit() {
      if (typeof Split !== 'function') return;
      splitInstance = Split(['#' + gridPaneId, '#' + chartPaneId], {
        direction: 'vertical',
        sizes: config.splitSizes || [40, 60],
        minSize: config.splitMinSize || [200, 300],
        snapOffset: 30,
        gutterSize: 4,
        cursor: 'col-resize',
        onDragEnd: function () {
          if (ganttChart) {
            setTimeout(function () { ganttChart.refresh(tasksToFrappe(tasks)); }, 100);
          }
        },
      });
    }

    function tasksToFrappe(taskList) {
      return taskList
        .filter(function (t) { return t.start && t.end; })
        .map(function (t) {
          return {
            id: t.id,
            name: t.name || t.label || t.id,
            start: t.start,
            end: t.end,
            custom_class: t.custom_class || '',
            dependencies: t.dependencies || '',
          };
        });
    }

    function renderChart(taskList) {
      var frappeTasks = tasksToFrappe(taskList);

      if (frappeTasks.length === 0) {
        chartContainer.innerHTML = '<div style="padding:24px;color:var(--sf-gray-400);font-family:var(--sf-font-mono);font-size:13px;">No scheduled tasks to display.</div>';
        ganttChart = null;
        return;
      }

      chartContainer.innerHTML = '<svg id="' + svgId + '"></svg>';

      ganttChart = new Gantt('#' + svgId, frappeTasks, {
        view_mode: viewSelect.value || 'Quarter Day',
        date_format: 'YYYY-MM-DD HH:mm',
        custom_popup_html: config.popupHtml || defaultPopup,
        on_click: function (task) {
          ctrl.highlightTask(task.id);
          if (config.onTaskClick) config.onTaskClick(task);
        },
        on_date_change: function (task, start, end) {
          if (config.onDateChange) config.onDateChange(task, start, end);
        },
      });
    }

    function renderGrid(taskList) {
      grid.innerHTML = '';
      var table = sf.el('table', { className: 'sf-gantt-table' });

      // Header
      var thead = sf.el('thead');
      var headerRow = sf.el('tr');
      var columns = config.columns || [
        { key: 'name', label: 'Task' },
        { key: 'start', label: 'Start' },
        { key: 'end', label: 'End' },
      ];
      columns.forEach(function (col) {
        headerRow.appendChild(sf.el('th', null, col.label));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Body
      var tbody = sf.el('tbody');
      taskList.forEach(function (task) {
        var tr = sf.el('tr', {
          className: 'sf-gantt-row' + (task.custom_class ? ' ' + task.custom_class : ''),
          dataset: { taskId: task.id },
          onClick: function () {
            ctrl.highlightTask(task.id);
            if (config.onTaskClick) config.onTaskClick(task);
          },
        });
        columns.forEach(function (col) {
          var td = sf.el('td');
          if (col.key === 'name') {
            td.className = 'sf-task-name';
            td.textContent = task.name || task.label || task.id;
          } else if (col.render) {
            var content = col.render(task);
            if (typeof content === 'string') td.innerHTML = content;
            else if (content instanceof Node) td.appendChild(content);
          } else {
            td.textContent = task[col.key] || '';
            td.style.fontFamily = 'var(--sf-font-mono)';
            td.style.fontSize = '12px';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      grid.appendChild(table);
    }

    function defaultPopup(task) {
      var t = tasks.find(function (x) { return x.id === task.id; });
      if (!t) return '';
      return '<div class="sf-gantt-popup">' +
        '<h4>' + sf.escHtml(t.name || t.id) + '</h4>' +
        '<p><strong>Start:</strong> ' + sf.escHtml(t.start) + '</p>' +
        '<p><strong>End:</strong> ' + sf.escHtml(t.end) + '</p>' +
        (t.duration_minutes ? '<p><strong>Duration:</strong> ' + t.duration_minutes + ' min</p>' : '') +
        (t.pinned ? '<p class="sf-gantt-popup-pinned"><i class="fa-solid fa-thumbtack"></i> Pinned</p>' : '') +
        '</div>';
    }
  };

})(SF);
