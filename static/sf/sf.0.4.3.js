/* ============================================================================
   SolverForge UI — Core
   ============================================================================ */

const SF = (function () {
  'use strict';

  const sf = { version: '0.4.3' };
  var uidCounter = 0;

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
        else if (key === 'html') el.textContent = attrs[key];
        else if (key === 'unsafeHtml') el.innerHTML = attrs[key];
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

  sf.uid = function (prefix) {
    uidCounter += 1;
    return (prefix || 'sf') + '-' + uidCounter;
  };

  sf.bindActivation = function (el, onActivate) {
    if (!el || typeof onActivate !== 'function') return;

    function handleActivate(e) {
      if (!e || e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      onActivate(e);
    }

    el.addEventListener('click', handleActivate);
    el.addEventListener('keydown', handleActivate);
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

    if (config.text && !config.circle && !config.iconOnly) {
      btn.appendChild(document.createTextNode(config.text));
    }

    if (config.onClick) {
      btn.addEventListener('click', config.onClick);
    }

    if (config.tooltip) {
      btn.title = config.tooltip;
    }

    if (config.ariaLabel) {
      btn.setAttribute('aria-label', config.ariaLabel);
    } else if (config.iconOnly && config.text) {
      btn.setAttribute('aria-label', config.text);
    } else if (config.icon && !config.text) {
      btn.setAttribute('aria-label', config.icon.replace(/fa-/, '').replace(/-/g, ' '));
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
    var controls = {
      actions: null,
      spinner: null,
      solveBtn: null,
      pauseBtn: null,
      resumeBtn: null,
      cancelBtn: null,
      analyzeBtn: null,
      nav: null,
    };

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
      controls.nav = nav;
      config.tabs.forEach(function (tab) {
        sf.assert(tab && tab.id, 'createHeader tab entries require an id');
        sf.assert(typeof tab.label === 'string', 'createHeader tab entries require a label');
        var btn = sf.el('button', {
          className: 'sf-nav-btn' + (tab.active ? ' active' : ''),
          role: 'tab',
          'aria-selected': !!tab.active,
          tabIndex: 0,
          dataset: { tab: tab.id },
          onKeyDown: function (e) {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            var buttons = nav.querySelectorAll('.sf-nav-btn');
            var list = Array.prototype.slice.call(buttons);
            var nextIndex = e.key === 'ArrowRight'
              ? (list.indexOf(btn) + 1) % list.length
              : (list.length + list.indexOf(btn) - 1) % list.length;
            var next = list[nextIndex];
            if (next && next.focus) next.focus();
          },
          onClick: function () {
            nav.querySelectorAll('.sf-nav-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            nav.querySelectorAll('.sf-nav-btn').forEach(function (b) {
              b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
            });
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
      sf.assert(!config.actions.onPause || typeof config.actions.onPause === 'function', 'createHeader(config.actions.onPause) must be a function');
      sf.assert(!config.actions.onResume || typeof config.actions.onResume === 'function', 'createHeader(config.actions.onResume) must be a function');
      sf.assert(!config.actions.onCancel || typeof config.actions.onCancel === 'function', 'createHeader(config.actions.onCancel) must be a function');
      sf.assert(!config.actions.onAnalyze || typeof config.actions.onAnalyze === 'function', 'createHeader(config.actions.onAnalyze) must be a function');
      sf.assert(!config.onTabChange || typeof config.onTabChange === 'function', 'createHeader(config.onTabChange) must be a function');

      var actions = sf.el('div', { className: 'sf-header-actions' });
      controls.actions = actions;

      // Spinner
      var spinner = sf.el('div', { className: 'sf-solving-spinner' });
      controls.spinner = spinner;
      actions.appendChild(spinner);

      if (config.actions.onSolve) {
        var solveBtn = sf.createButton({
          text: 'Solve',
          variant: 'success',
          icon: 'fa-play',
          onClick: config.actions.onSolve,
        });
        controls.solveBtn = solveBtn;
        actions.appendChild(solveBtn);
      }

      if (config.actions.onPause) {
        var pauseBtn = sf.createButton({
          text: 'Pause',
          variant: 'default',
          icon: 'fa-pause',
          onClick: config.actions.onPause,
        });
        pauseBtn.style.display = 'none';
        controls.pauseBtn = pauseBtn;
        actions.appendChild(pauseBtn);
      }

      if (config.actions.onResume) {
        var resumeBtn = sf.createButton({
          text: 'Resume',
          variant: 'primary',
          icon: 'fa-play',
          onClick: config.actions.onResume,
        });
        resumeBtn.style.display = 'none';
        controls.resumeBtn = resumeBtn;
        actions.appendChild(resumeBtn);
      }

      if (config.actions.onCancel) {
        var cancelBtn = sf.createButton({
          text: 'Cancel',
          variant: 'danger',
          icon: 'fa-ban',
          onClick: config.actions.onCancel,
        });
        cancelBtn.style.display = 'none';
        controls.cancelBtn = cancelBtn;
        actions.appendChild(cancelBtn);
      }

      if (config.actions.onAnalyze) {
        var analyzeBtn = sf.createButton({
          variant: 'ghost',
          icon: 'fa-chart-bar',
          circle: true,
          tooltip: 'Score Analysis',
          onClick: config.actions.onAnalyze,
        });
        controls.analyzeBtn = analyzeBtn;
        actions.appendChild(analyzeBtn);
      }

      header.appendChild(actions);
    }

    header.sfControls = controls;
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
    var controls = null;

    // Score display
    var scoreEl = sf.el('span', { className: 'sf-statusbar-score', id: 'sfScoreDisplay', 'aria-live': 'polite' }, '\u2014');
    bar.appendChild(scoreEl);

    // Separator
    bar.appendChild(sf.el('span', { className: 'sf-statusbar-sep' }, '|'));

    // Constraint dots container
    var dotsContainer = sf.el('div', { className: 'sf-statusbar-constraints' });
    bar.appendChild(dotsContainer);

    // Separator + moves display
    var movesSep = sf.el('span', { className: 'sf-statusbar-sep' }, '|');
    movesSep.style.display = 'none';
    bar.appendChild(movesSep);

    var movesEl = sf.el('span');
    movesEl.style.display = 'none';
    bar.appendChild(movesEl);

    // Separator + status text
    bar.appendChild(sf.el('span', { className: 'sf-statusbar-sep' }, '|'));
    var statusEl = sf.el('span', { id: 'sfStatusText', role: 'status', 'aria-live': 'polite' });
    bar.appendChild(statusEl);

    // Build initial constraint dots
    if (config && config.constraints) {
      buildDots(dotsContainer, config.constraints, config.onConstraintClick);
    }

    var api = { el: bar };

    api.bindHeader = function (header) {
      controls = header && header.sfControls ? header.sfControls : null;
      return api;
    };

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

    api.setLifecycleState = function (state) {
      var normalized = normalizeLifecycleState(state);
      var solveBtn = controls && controls.solveBtn;
      var pauseBtn = controls && controls.pauseBtn;
      var resumeBtn = controls && controls.resumeBtn;
      var cancelBtn = controls && controls.cancelBtn;
      var spinner = controls && controls.spinner;

      if (solveBtn) solveBtn.style.display = shouldShowSolve(normalized) ? '' : 'none';
      if (pauseBtn) {
        pauseBtn.style.display = shouldShowPause(normalized) ? '' : 'none';
        pauseBtn.disabled = normalized === 'PAUSE_REQUESTED';
      }
      if (resumeBtn) resumeBtn.style.display = normalized === 'PAUSED' ? '' : 'none';
      if (cancelBtn) cancelBtn.style.display = shouldShowCancel(normalized) ? '' : 'none';
      if (spinner) spinner.classList.toggle('active', shouldSpin(normalized));

      statusEl.textContent = lifecycleLabel(normalized);
      statusEl.style.color = isActiveLifecycle(normalized)
        ? 'var(--sf-emerald-600)'
        : normalized === 'FAILED'
          ? 'var(--sf-red-600)'
          : normalized === 'CANCELLED'
            ? 'var(--sf-amber-700)'
            : 'var(--sf-gray-500)';
    };

    api.setSolving = function (solving) {
      api.setLifecycleState(solving ? 'SOLVING' : 'IDLE');
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
      dotsContainer.querySelectorAll('.sf-constraint-dot').forEach(function (dot, i) {
        var c = constraints[i];
        if (!dot) return;
        var isHard = c.type === 'hard';
        var scoreVal = isHard ? sf.score.parseHard(c.score) : sf.score.parseSoft(c.score);
        var violated = scoreVal < 0;
        dot.classList.toggle('violated', isHard && violated);
        dot.classList.toggle('violated-soft', !isHard && violated);
      });
    };

    if (config && config.header) {
      api.bindHeader(config.header);
    }

    api.setLifecycleState('IDLE');

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
        role: onClick ? 'button' : null,
        tabIndex: onClick ? '0' : null,
        'aria-label': onClick ? ('Open constraint ' + (c.name || ('Constraint ' + i))) : null,
        dataset: { type: c.type || 'hard', index: String(i) },
      });
      if (onClick) {
        dot.style.cursor = 'pointer';
        sf.bindActivation(dot, function () { onClick(i); });
      }
      container.appendChild(dot);
    });
  }

  function normalizeLifecycleState(value) {
    if (typeof value !== 'string' || !value.trim()) return 'IDLE';
    return value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toUpperCase();
  }

  function shouldShowSolve(state) {
    return state === 'IDLE'
      || state === 'COMPLETED'
      || state === 'CANCELLED'
      || state === 'FAILED'
      || state === 'TERMINATED_BY_CONFIG';
  }

  function shouldShowPause(state) {
    return state === 'STARTING'
      || state === 'SOLVING'
      || state === 'PAUSE_REQUESTED'
      || state === 'RESUMING';
  }

  function shouldShowCancel(state) {
    return state === 'STARTING'
      || state === 'SOLVING'
      || state === 'PAUSE_REQUESTED'
      || state === 'PAUSED'
      || state === 'RESUMING'
      || state === 'CANCELLING';
  }

  function shouldSpin(state) {
    return state === 'STARTING'
      || state === 'SOLVING'
      || state === 'PAUSE_REQUESTED'
      || state === 'RESUMING'
      || state === 'CANCELLING';
  }

  function isActiveLifecycle(state) {
    return shouldSpin(state);
  }

  function lifecycleLabel(state) {
    if (state === 'STARTING') return 'Starting...';
    if (state === 'SOLVING') return 'Solving...';
    if (state === 'PAUSE_REQUESTED') return 'Pause requested...';
    if (state === 'PAUSED') return 'Paused';
    if (state === 'RESUMING') return 'Resuming...';
    if (state === 'CANCELLING') return 'Cancelling...';
    if (state === 'COMPLETED') return 'Completed';
    if (state === 'CANCELLED') return 'Cancelled';
    if (state === 'FAILED') return 'Failed';
    if (state === 'TERMINATED_BY_CONFIG') return 'Completed';
    return 'Ready';
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
    var dialogId = sf.uid('sf-modal');
    var dialog = sf.el('div', {
      className: 'sf-modal',
      id: dialogId,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': dialogId + '-title',
    });
    var body = sf.el('div', { className: 'sf-modal-body' });

    // Header
    var header = sf.el('div', { className: 'sf-modal-header' });
    var titleEl = sf.el('div', { className: 'sf-modal-title', id: dialogId + '-title' }, config.title || '');
    header.appendChild(titleEl);

    var closeBtn = sf.el('button', {
      className: 'sf-modal-close',
      html: '&times;',
      'aria-label': 'Close modal',
      onClick: function () { api.close(); },
    }, '×');
    header.appendChild(closeBtn);

    dialog.appendChild(header);

    // Body
    setBodyContent(body, config.body, config.unsafeBody);
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

    var previousFocus = null;

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
        previousFocus = document.activeElement;
        document.body.appendChild(overlay);
        if (closeBtn.focus) closeBtn.focus();
        overlay.classList.add('open');
        document.addEventListener('keydown', onKeyDown);
      };

    api.close = function () {
      overlay.classList.remove('open');
      document.removeEventListener('keydown', onKeyDown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      if (config.onClose) config.onClose();
    };

    api.setBody = function (content) {
      setBodyContent(body, content);
    };

    if (config.width) {
      dialog.style.maxWidth = config.width;
    }

    return api;
  };

  function setBodyContent(target, content, explicitUnsafeHtml) {
    target.textContent = '';
    if (explicitUnsafeHtml != null) {
      target.innerHTML = explicitUnsafeHtml;
    } else if (typeof content === 'string') {
      target.textContent = content;
    } else if (content && content.unsafeBody) {
      target.innerHTML = content.unsafeBody;
    } else if (content && content.unsafeHtml) {
      target.innerHTML = content.unsafeHtml;
    } else if (content instanceof Node) {
      target.appendChild(content);
    }
  }

})(SF);
/* ============================================================================
   SolverForge UI — Tab Switching
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.showTab = function (tabId, root) {
    if (root) {
      activateTabInScope(root, tabId);
      return;
    }

    document.querySelectorAll('.sf-tabs-container').forEach(function (container) {
      activateTabInScope(container, tabId);
    });
  };

  sf.createTabs = function (config) {
    sf.assert(config, 'createTabs(config) requires a configuration object');
    sf.assert(Array.isArray(config.tabs), 'createTabs(config.tabs) must be an array');

    var container = sf.el('div', { className: 'sf-tabs-container' });
    var tabsId = sf.uid('sf-tabs');

    config.tabs.forEach(function (tab) {
      var panel = sf.el('div', {
        className: 'sf-tab-panel' + (tab.active ? ' active' : ''),
        id: tabsId + '-' + tab.id,
        dataset: { tabId: tab.id },
      });
      if (tab.content) {
        if (typeof tab.content === 'string') panel.textContent = tab.content;
        else if (tab.content && tab.content.unsafeHtml) panel.innerHTML = tab.content.unsafeHtml;
        else if (tab.content instanceof Node) panel.appendChild(tab.content);
      }
      container.appendChild(panel);
    });

    return {
      el: container,
      show: function (tabId) {
        sf.showTab(tabId, container);
      },
    };
  };

  function activateTabInScope(scope, tabId) {
    scope.querySelectorAll('.sf-tab-panel').forEach(function (p) {
      p.classList.remove('active');
    });

    var panel = scope.querySelector('[data-tab-id="' + tabId + '"]');
    if (panel) panel.classList.add('active');
  }

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
          } else if (cell && cell.unsafeHtml) {
            td.innerHTML = cell.unsafeHtml;
          }
          var col = config.columns && config.columns[colIdx];
          if (col && col.align) td.style.textAlign = col.align;
          if (col && col.className) td.classList.add(col.className);
          tr.appendChild(td);
        });
        if (config.onRowClick) {
          tr.style.cursor = 'pointer';
          tr.setAttribute('role', 'button');
          tr.tabIndex = 0;
          sf.bindActivation(tr, function () { config.onRowClick(rowIdx, row); });
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
    var toast = sf.el('div', {
      className: 'sf-toast sf-toast--' + variant + ' sf-toast-enter',
      role: 'status',
      'aria-live': 'polite',
    });

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
      'aria-label': 'Dismiss toast',
      onClick: function () { dismiss(); },
    }, '×');
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
          onError(new Error('Event stream failed for ' + url));
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

})(SF);
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
    var queuedAction = null;
    var pendingPause = null;
    var pendingResume = null;
    var pendingCancel = null;

    var api = {};

    api.start = function (data) {
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

        closeStream = backend.streamJobEvents(id, function (payload) {
          if (token !== runToken) return;
          handleEvent(token, id, payload);
        }, function (err) {
          if (token !== runToken) return;
          failTransport(err);
        });

        if (queuedAction === 'pause') {
          queuedAction = null;
          requestPause(token, id);
        } else if (queuedAction === 'cancel') {
          queuedAction = null;
          requestCancel(token, id);
        }
      }).catch(function (err) {
        if (token !== runToken) return;
        failTransport(err);
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
      if (phase !== 'solving' || !activeJobId) return Promise.resolve();

      pendingPause = createDeferred();
      requestPause(runToken, activeJobId);
      return pendingPause.promise;
    };

    api.resume = function () {
      if (pendingResume) return pendingResume.promise;
      if (phase !== 'paused' || !activeJobId) return Promise.resolve();

      pendingResume = createDeferred();
      requestResume(runToken, activeJobId);
      return pendingResume.promise;
    };

    api.cancel = function () {
      if (pendingCancel) return pendingCancel.promise;
      if (phase === 'starting' && !activeJobId) {
        queuedAction = 'cancel';
        pendingCancel = createDeferred();
        return pendingCancel.promise;
      }
      if (!activeJobId || !isCancelablePhase()) return Promise.resolve();

      pendingCancel = createDeferred();
      requestCancel(runToken, activeJobId);
      return pendingCancel.promise;
    };

    api.delete = function () {
      if (!retainedJobId || !hasFunction(backend, 'deleteJob')) return Promise.resolve();
      if (api.isRunning() || phase === 'paused') {
        return Promise.reject(new Error('Cannot delete a live or paused job'));
      }

      var jobId = retainedJobId;
      return backend.deleteJob(jobId).then(function () {
        if (retainedJobId !== jobId) return;
        retainedJobId = null;
        activeJobId = null;
        lastSnapshotRevision = null;
        lastMeta = null;
        applyLifecycleState('IDLE');
        updateMoves(null);
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
        phase = 'solving';
        applyEventMeta(event.meta);
        if (config.onProgress) config.onProgress(event.meta);
        return;
      }

      if (event.eventType === 'best_solution') {
        if (!event.solution || !event.meta.currentScore) return;
        phase = 'solving';
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
        syncSnapshotBundle(event.meta, true).then(function (bundle) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          finalizeTerminal(bundle.meta);
          applyBundle(bundle);
          if (config.onComplete && bundle.snapshot) config.onComplete(bundle.snapshot, bundle.meta);
          settlePendingFromTerminal('completed', bundle);
        }).catch(function (err) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          finalizeTerminal(event.meta);
          settlePendingFromTerminal('completed', null, err);
          notifyError(err);
        });
        return;
      }

      if (event.eventType === 'cancelled') {
        phase = 'idle';
        applyEventMeta(event.meta);
        syncSnapshotBundle(event.meta, false).then(function (bundle) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          finalizeTerminal(bundle.meta);
          applyBundle(bundle);
          if (config.onCancelled) config.onCancelled(bundle.snapshot, bundle.meta);
          settlePendingFromTerminal('cancelled', bundle);
        }).catch(function (err) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          finalizeTerminal(event.meta);
          settlePendingFromTerminal('cancelled', null, err);
          notifyError(err);
        });
        return;
      }

      if (event.eventType === 'failed') {
        phase = 'idle';
        applyEventMeta(event.meta);
        syncSnapshotBundle(event.meta, false).then(function (bundle) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          finalizeTerminal(bundle.meta);
          applyBundle(bundle);
          if (config.onFailure) config.onFailure(event.error || 'Solver job failed', bundle.meta, bundle.snapshot, bundle.analysis);
          settlePendingFromTerminal('failed', bundle, new Error(event.error || 'Solver job failed'));
        }).catch(function (err) {
          if (token !== runToken || hasNewerEvent(event.meta)) return;
          finalizeTerminal(event.meta);
          if (config.onFailure) config.onFailure(event.error || 'Solver job failed', event.meta, null, null);
          settlePendingFromTerminal('failed', null, err);
          notifyError(err);
        });
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
      retainedJobId = activeJobId || retainedJobId;
      closeCurrentStream();
      activeJobId = null;
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
      queuedAction = null;
      pendingPause = null;
      pendingResume = null;
      pendingCancel = null;
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

    function isCancelablePhase() {
      return phase === 'solving' || phase === 'pause-requested' || phase === 'paused' || phase === 'cancelling';
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
          'aria-label': 'Copy command',
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
    var state = {
      unassigned: [],
      railConfig: config,
    };

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
      var badges = Array.isArray(config.badges)
        ? config.badges
        : config.badges
          ? [config.badges]
          : [];
      if (badges.length) {
        badges.forEach(function (entry) {
          if (!entry) return;
          if (typeof entry === 'string') {
            meta.appendChild(sf.el('span', { className: 'sf-resource-type-badge' }, entry));
            return;
          }
          var extraBadge = sf.el('span', { className: 'sf-resource-type-badge' }, entry.label || '');
          if (entry.style) {
            extraBadge.style.background = entry.style.bg || '';
            extraBadge.style.color = entry.style.color || '';
            extraBadge.style.border = entry.style.border || '';
          }
          meta.appendChild(extraBadge);
        });
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

    // Optional heatmap strip
    if (config.heatmap) {
      var heatmapCfg = {
        horizon: config.heatmap.horizon || 1,
        label: config.heatmap.label,
        segments: config.heatmap.segments,
        labelWidth: labelWidth,
      };
      heatmapCfg.railConfig = config;
      var heatmap = sf.rail.createHeatmap(heatmapCfg);
      if (heatmap) card.appendChild(heatmap);
    }

    // Optional unassigned list
    var unassignedRail = sf.el('div', { className: 'sf-unassigned-rail' });
    if (config.unassigned) {
      state.unassigned = config.unassigned;
      renderUnassigned(unassignedRail, config.unassigned, config.onUnassignedClick);
    }
    if (unassignedRail.children.length > 0) card.appendChild(unassignedRail);

    // API
    var cardApi = { el: card, rail: rail };

    cardApi.addBlock = function (blockConfig) {
      return sf.rail.addBlock(rail, blockConfig);
    };

    cardApi.setUnassigned = function (items) {
      state.unassigned = Array.isArray(items) ? items : [];
      if (state.unassigned.length === 0 && unassignedRail.parentNode) {
        unassignedRail.innerHTML = '';
        unassignedRail.parentNode && unassignedRail.parentNode.removeChild(unassignedRail);
        return;
      }
      if (state.unassigned.length > 0) {
        renderUnassigned(unassignedRail, state.unassigned, config.onUnassignedClick);
      } else {
        unassignedRail.innerHTML = '';
      }
      if (state.unassigned.length > 0 && !unassignedRail.parentNode) {
        card.appendChild(unassignedRail);
      }
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

  sf.rail.createHeatmap = function (config) {
    if (!config || !config.segments || !Array.isArray(config.segments) || config.segments.length === 0) return null;

    var heatmap = sf.el('div', { className: 'sf-heatmap' });
    heatmap.style.gridTemplateColumns = (config.labelWidth || 200) + 'px 1fr';
    var label = sf.el('div', { className: 'sf-heatmap-label' }, config.label || '');
    heatmap.appendChild(label);

    var track = sf.el('div', { className: 'sf-heatmap-track' });
    var columns = config.railConfig && config.railConfig.columns || 1;
    track.style.gridTemplateColumns = 'repeat(' + columns + ', 1fr)';
    heatmap.appendChild(track);

    var horizon = config.horizon || 1;
    config.segments.forEach(function (segment) {
      if (!segment || segment.end <= segment.start) return;
      var band = sf.el('div', { className: 'sf-heatmap-segment' });
      var start = Math.max(0, segment.start);
      var width = Math.max(0, segment.end - start);
      band.style.left = (start / horizon * 100) + '%';
      band.style.width = Math.max(width / horizon * 100, 0.25) + '%';
      if (segment.color) band.style.background = segment.color;
      if (segment.opacity != null) band.style.opacity = segment.opacity;
      if (segment.tooltip) band.title = segment.tooltip;
      track.appendChild(band);
    });

    return heatmap;
  };

  sf.rail.createUnassignedRail = function (tasks, onTaskClick) {
    var rail = sf.el('div', { className: 'sf-unassigned-rail' });
    renderUnassigned(rail, tasks, onTaskClick);
    return rail;
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
      block.setAttribute('role', 'button');
      block.tabIndex = 0;
      sf.bindActivation(block, function (e) { config.onClick(e, config); });
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

  function renderUnassigned(unassignedRail, items, onTaskClick) {
    unassignedRail.innerHTML = '';
    (items || []).forEach(function (item) {
      var label = typeof item === 'string' ? item : item.label || item.id || '';
      if (!label) return;
      var pill = sf.el('button', {
        className: 'sf-unassigned-pill',
        onClick: function () {
          if (onTaskClick) onTaskClick(item);
        },
      }, label);
      unassignedRail.appendChild(pill);
    });
  }

})(SF);
/* ============================================================================
   SolverForge UI — Rail Timeline
   Canonical dense scheduling surface for resource-lane timelines.
   ============================================================================ */

(function (sf) {
  'use strict';

  var DAY_MINUTES = 24 * 60;
  var SIX_HOUR_MINUTES = 6 * 60;
  var WEEK_MINUTES = 7 * DAY_MINUTES;
  var TRACK_HEIGHT = 34;
  var TRACK_GAP = 8;
  var TRACK_PADDING = 12;
  var OVERVIEW_HEIGHT = 68;
  var OVERVIEW_BLOCK_HEIGHT = 34;
  var OVERVIEW_GROUP_GAP_MINUTES = 30;
  var MIN_LABEL_WIDTH = 180;
  var MIN_VISIBLE_TRACK_WIDTH = 320;
  var MIN_CONTENT_TRACK_WIDTH = 480;
  var MIN_SUPPORTED_VIEWPORT_WIDTH = 500;

  var TONE_MAP = {
    emerald: {
      id: 'emerald',
      background: 'rgba(16, 185, 129, 0.22)',
      border: '#059669',
      text: '#064e3b',
      overlay: 'rgba(16, 185, 129, 0.10)',
    },
    blue: {
      id: 'blue',
      background: 'rgba(59, 130, 246, 0.22)',
      border: '#2563eb',
      text: '#1e40af',
      overlay: 'rgba(59, 130, 246, 0.10)',
    },
    amber: {
      id: 'amber',
      background: 'rgba(245, 158, 11, 0.24)',
      border: '#d97706',
      text: '#92400e',
      overlay: 'rgba(245, 158, 11, 0.10)',
    },
    rose: {
      id: 'rose',
      background: 'rgba(244, 63, 94, 0.22)',
      border: '#e11d48',
      text: '#9f1239',
      overlay: 'rgba(244, 63, 94, 0.10)',
    },
    violet: {
      id: 'violet',
      background: 'rgba(139, 92, 246, 0.22)',
      border: '#7c3aed',
      text: '#5b21b6',
      overlay: 'rgba(139, 92, 246, 0.10)',
    },
    cyan: {
      id: 'cyan',
      background: 'rgba(6, 182, 212, 0.22)',
      border: '#0891b2',
      text: '#155e75',
      overlay: 'rgba(6, 182, 212, 0.10)',
    },
    red: {
      id: 'red',
      background: 'rgba(239, 68, 68, 0.22)',
      border: '#dc2626',
      text: '#991b1b',
      overlay: 'rgba(239, 68, 68, 0.10)',
    },
    slate: {
      id: 'slate',
      background: 'rgba(100, 116, 139, 0.20)',
      border: '#475569',
      text: '#1e293b',
      overlay: 'rgba(100, 116, 139, 0.08)',
    },
  };

  sf.rail = sf.rail || {};

  sf.rail.createTimeline = function (config) {
    sf.assert(config && config.model, 'rail.createTimeline(config.model) requires a normalized model');

    var labelWidth = config.labelWidth == null
      ? 280
      : assertFiniteNumber(config.labelWidth, 'rail.createTimeline(labelWidth)');
    sf.assert(labelWidth > 0, 'rail.createTimeline(labelWidth) must be greater than zero');
    var state = {
      cleanup: [],
      config: config,
      destroyed: false,
      expandedClusters: {},
      hasQueuedPostMountSync: false,
      instanceId: sf.uid('sf-rail-timeline'),
      labelWidth: labelWidth,
      model: normalizeModel(config.model),
      scrollSync: null,
      viewport: null,
      layout: null,
    };

    state.viewport = clampViewport(state.model.axis, state.model.axis.initialViewport);

    var root = sf.el('section', {
      className: 'sf-rail-timeline',
      dataset: {
        labelWidth: String(labelWidth),
      },
    });
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', config.title || 'Scheduling timeline');

    var toolbar = sf.el('div', { className: 'sf-rail-timeline-toolbar' });
    var toolbarCopy = sf.el('div', { className: 'sf-rail-timeline-toolbar-copy' });
    toolbarCopy.appendChild(sf.el('div', { className: 'sf-rail-timeline-toolbar-title' }, config.title || 'Scheduling timeline'));
    toolbarCopy.appendChild(sf.el('div', { className: 'sf-rail-timeline-toolbar-subtitle' }, config.subtitle || 'Sticky header, sticky lane labels, hidden scrollbar, drag-to-pan.'));
    toolbar.appendChild(toolbarCopy);

    var zoomControls = sf.el('div', { className: 'sf-rail-timeline-zoom-controls' });
    var zoomButtons = [];
    ['1w', '2w', '4w', 'reset'].forEach(function (preset) {
      var button = sf.el('button', {
        className: 'sf-rail-timeline-zoom-button',
        type: 'button',
        dataset: { zoom: preset },
      }, preset === 'reset' ? 'Reset' : preset.toUpperCase());
      button.addEventListener('click', function () {
        if (preset === 'reset') {
          api.setViewport(state.model.axis.initialViewport);
          return;
        }
        api.setViewport(buildPresetViewport(state.model.axis, state.viewport, preset));
      });
      zoomButtons.push(button);
      zoomControls.appendChild(button);
    });
    toolbar.appendChild(zoomControls);
    root.appendChild(toolbar);

    var shell = sf.el('div', { className: 'sf-rail-timeline-shell' });
    var headerViewport = sf.el('div', { className: 'sf-rail-timeline-header-viewport' });
    var bodyViewport = sf.el('div', { className: 'sf-rail-timeline-body-viewport' });
    var headerRow = sf.el('div', { className: 'sf-rail-timeline-header-row' });
    var lanes = sf.el('div', { className: 'sf-rail-timeline-lanes' });
    headerViewport.appendChild(headerRow);
    bodyViewport.appendChild(lanes);
    shell.appendChild(headerViewport);
    shell.appendChild(bodyViewport);
    root.appendChild(shell);

    var tooltip = sf.el('div', { className: 'sf-tooltip sf-rail-timeline-tooltip' });
    tooltip.id = sf.uid('sf-rail-timeline-tooltip');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    root.appendChild(tooltip);

    bindScrollSync(headerViewport, bodyViewport, state, root, zoomButtons);
    bindDragPan(headerViewport, bodyViewport, state, root, zoomButtons);
    bindDragPan(bodyViewport, headerViewport, state, root, zoomButtons);
    bindResizeObserver(bodyViewport, state, syncLayoutFromViewport);
    bindWindowResize(state, syncLayoutFromViewport);

    function renderStructure() {
      renderHeader();
      renderLanes();
    }

    function applyMeasuredLayout() {
      state.layout = measureLayout(bodyViewport, state);
      applyLayout(root, headerRow, lanes, state.layout);
      updateViewportMetadata(root, state);
      updateZoomButtons(zoomButtons, state);
    }

    function renderHeader() {
      headerRow.innerHTML = '';

      var corner = sf.el('div', { className: 'sf-rail-timeline-label-corner' }, config.label || 'Lane');
      headerRow.appendChild(corner);

      var axis = sf.el('div', { className: 'sf-rail-timeline-axis sf-rail-timeline-axis--header' });
      axis.style.height = '82px';
      renderAxisDecor(axis, state.model.axis, true);
      headerRow.appendChild(axis);
    }

    function renderLanes() {
      lanes.innerHTML = '';

      state.model.lanes.forEach(function (lane, laneIndex) {
        var laneRender = lane.mode === 'overview'
          ? buildOverviewRender(lane, state, function () {
            rerenderTimeline();
          })
          : buildDetailedRender(lane, lane.items);

        var row = sf.el('div', {
          className: 'sf-rail-timeline-row sf-rail-timeline-row--' + lane.mode + (laneRender.expandedClusterId ? ' sf-rail-timeline-row--expanded' : ''),
          dataset: {
            laneId: lane.id,
            mode: lane.mode,
            trackCount: String(laneRender.trackCount),
          },
        });
        if (laneRender.expandedClusterId) {
          row.dataset.expandedClusterId = laneRender.expandedClusterId;
        }
        row.setAttribute('role', 'group');

        var label = buildLaneLabel(
          lane,
          laneRender,
          row,
          buildScopedId(state.instanceId, 'lane-title-' + laneIndex)
        );
        row.appendChild(label);

        var track = sf.el('div', { className: 'sf-rail-timeline-track' });
        track.style.height = laneRender.height + 'px';
        renderAxisDecor(track, state.model.axis, false);
        renderOverlays(track, lane.overlays, state.model.axis);
        laneRender.blocks.forEach(function (blockConfig) {
          appendLaneBlock(track, lane, blockConfig, state.model.axis, tooltip, root);
        });
        row.appendChild(track);
        lanes.appendChild(row);
      });
    }

    function rerenderTimeline() {
      renderStructure();
      syncLayoutFromViewport();
    }

    function syncLayoutFromViewport() {
      applyMeasuredLayout();
      syncScrollToViewport();
    }

    function syncScrollToViewport() {
      if (!state.layout) return;
      var scrollLeft = viewportToScrollLeft(state, bodyViewport);
      state.scrollSync = bodyViewport;
      bodyViewport.scrollLeft = scrollLeft;
      headerViewport.scrollLeft = scrollLeft;
      state.scrollSync = null;
    }

    var api = {
      destroy: function () {
        if (state.destroyed) return;
        state.destroyed = true;
        state.cleanup.forEach(function (cleanup) {
          if (typeof cleanup === 'function') cleanup();
        });
        root.innerHTML = '';
      },
      el: root,
      expandCluster: function (laneId, clusterId) {
        setExpandedCluster(state, laneId, clusterId);
        rerenderTimeline();
      },
      setModel: function (nextModel) {
        state.model = normalizeModel(nextModel);
        state.viewport = clampViewport(state.model.axis, state.viewport);
        pruneExpandedClusters(state);
        rerenderTimeline();
      },
      setViewport: function (nextViewport) {
        state.viewport = clampViewport(
          state.model.axis,
          normalizeViewportInput(nextViewport, 'rail.createTimeline().setViewport(viewport)')
        );
        syncLayoutFromViewport();
      },
    };

    renderStructure();
    syncLayoutFromViewport();
    queuePostMountSync(state, syncLayoutFromViewport);

    return api;
  };

  function appendLaneBlock(track, lane, blockConfig, axis, tooltip, root) {
    var tone = blockConfig.tone;
    var block = sf.rail.addBlock(track, {
      start: blockConfig.startMinute - axis.startMinute,
      end: blockConfig.endMinute - axis.startMinute,
      horizon: axis.endMinute - axis.startMinute,
      label: blockConfig.label,
      meta: blockConfig.metaLabel,
      color: tone.background,
      borderColor: tone.border,
      onClick: blockConfig.onClick,
      onHover: function (event) {
        showTooltip(tooltip, root, blockConfig.tooltip, event);
      },
      onLeave: function () {
        hideTooltip(tooltip);
      },
    });

    block.classList.add('sf-rail-timeline-item');
    block.classList.add(blockConfig.kindClass);
    block.style.top = blockConfig.top + 'px';
    block.style.height = blockConfig.height + 'px';
    block.style.bottom = 'auto';
    block.style.color = tone.text;
    block.tabIndex = 0;
    block.dataset.itemId = blockConfig.itemId;
    block.dataset.laneId = lane.id;
    if (blockConfig.trackIndex != null) block.dataset.trackIndex = String(blockConfig.trackIndex);
    if (blockConfig.clusterId) block.dataset.clusterId = blockConfig.clusterId;
    if (blockConfig.onClick) {
      block.setAttribute('role', 'button');
      block.setAttribute('aria-expanded', blockConfig.expanded ? 'true' : 'false');
    } else {
      block.setAttribute('role', 'group');
    }
    if (blockConfig.ariaLabel) block.setAttribute('aria-label', blockConfig.ariaLabel);
    block.setAttribute('aria-describedby', tooltip.id);
    if (blockConfig.summary) appendOverviewSummary(block, blockConfig.summary);
    if (blockConfig.detailHint) {
      block.appendChild(sf.el('span', { className: 'sf-rail-timeline-detail-hint' }, blockConfig.detailHint));
    }
    block.title = blockConfig.tooltip.title;
    block.addEventListener('mousemove', function (event) {
      showTooltip(tooltip, root, blockConfig.tooltip, event);
    });
    block.addEventListener('focus', function () {
      showTooltipForElement(tooltip, root, blockConfig.tooltip, block);
    });
    block.addEventListener('blur', function () {
      hideTooltip(tooltip);
    });
    block.addEventListener('keydown', function (event) {
      if (event && event.key === 'Escape') hideTooltip(tooltip);
    });
  }

  function appendOverviewSummary(block, summary) {
    var footer = sf.el('div', { className: 'sf-rail-timeline-summary-footer' });
    if (summary.badges.length > 0) {
      var badgeRail = sf.el('div', { className: 'sf-rail-timeline-summary-badges' });
      summary.badges.forEach(function (badge) {
        badgeRail.appendChild(sf.el('span', {
          className: 'sf-rail-timeline-summary-pill sf-rail-timeline-summary-pill--' + badge.kind,
        }, badge.text));
      });
      footer.appendChild(badgeRail);
    }
    if (summary.toneSegments.length > 0) {
      var toneBar = sf.el('div', {
        className: 'sf-rail-timeline-summary-tonebar',
        'aria-hidden': 'true',
      });
      var total = summary.toneSegments.reduce(function (sum, segment) {
        return sum + segment.count;
      }, 0) || 1;
      summary.toneSegments.forEach(function (segment) {
        var toneSegment = sf.el('span', { className: 'sf-rail-timeline-summary-tone-segment' });
        toneSegment.style.background = segment.tone.border;
        toneSegment.style.width = ((segment.count / total) * 100) + '%';
        toneBar.appendChild(toneSegment);
      });
      footer.appendChild(toneBar);
    }
    if (footer.children.length > 0) block.appendChild(footer);
  }

  function bindScrollSync(source, target, state, root, zoomButtons) {
    source.addEventListener('scroll', function () {
      handleScroll(source, target, state, root, zoomButtons);
    });
    target.addEventListener('scroll', function () {
      handleScroll(target, source, state, root, zoomButtons);
    });
  }

  function bindDragPan(source, target, state, root, zoomButtons) {
    var drag = {
      active: false,
      startClientX: 0,
      startScrollLeft: 0,
    };

    source.addEventListener('mousedown', function (event) {
      if (event.button != null && event.button !== 0) return;
      drag.active = true;
      drag.startClientX = event.clientX != null ? event.clientX : 0;
      drag.startScrollLeft = source.scrollLeft || 0;
      source.classList.add('is-dragging');
      if (event.preventDefault) event.preventDefault();
    });

    source.addEventListener('mousemove', function (event) {
      if (!drag.active) return;
      var clientX = event.clientX != null ? event.clientX : drag.startClientX;
      var delta = clientX - drag.startClientX;
      source.scrollLeft = clampNumber(drag.startScrollLeft - delta, 0, getMaxScrollLeft(source));
      handleScroll(source, target, state, root, zoomButtons);
      if (event.preventDefault) event.preventDefault();
    });

    function finishDrag() {
      if (!drag.active) return;
      drag.active = false;
      source.classList.remove('is-dragging');
    }

    source.addEventListener('mouseup', finishDrag);
    source.addEventListener('mouseleave', finishDrag);
  }

  function handleScroll(source, target, state, root, zoomButtons) {
    if (state.destroyed) return;
    if (!state.layout) return;
    if (state.scrollSync === source) return;

    state.scrollSync = source;
    target.scrollLeft = source.scrollLeft;
    state.viewport = scrollLeftToViewport(state, source);
    updateViewportMetadata(root, state);
    updateZoomButtons(zoomButtons, state);
    state.scrollSync = null;
  }

  function measurePackedHeight(packed) {
    return packed.trackCount > 0
      ? TRACK_PADDING * 2 + packed.trackCount * TRACK_HEIGHT + Math.max(0, packed.trackCount - 1) * TRACK_GAP
      : OVERVIEW_HEIGHT;
  }

  function buildDetailBlockConfig(item, lane, trackIndex, top, options) {
    var config = options || {};
    return {
      clusterId: config.clusterId || null,
      detailHint: config.detailHint || '',
      endMinute: item.endMinute,
      height: TRACK_HEIGHT,
      itemId: item.id,
      kindClass: 'sf-rail-timeline-item--detail',
      label: item.label,
      metaLabel: describeMeta(item.meta),
      startMinute: item.startMinute,
      top: top,
      ariaLabel: buildItemAriaLabel(item, lane),
      tooltip: buildItemTooltip(item, lane),
      tone: item.tone,
      trackIndex: trackIndex,
    };
  }

  function buildOverviewBlockConfig(group, height, options) {
    var config = options || {};
    return {
      clusterId: config.clusterId || null,
      endMinute: group.endMinute,
      height: OVERVIEW_BLOCK_HEIGHT,
      itemId: config.itemId,
      kindClass: config.kindClass,
      label: group.summary.primaryLabel,
      metaLabel: group.summary.secondaryLabel,
      onClick: config.onClick || null,
      startMinute: group.startMinute,
      summary: buildOverviewBlockSummary(group, !!config.expanded),
      top: config.top != null ? config.top : Math.max(Math.round((height - OVERVIEW_BLOCK_HEIGHT) / 2), TRACK_PADDING),
      ariaLabel: buildOverviewAriaLabel(group, group.lane, !!config.expanded),
      expanded: !!config.expanded,
      tooltip: config.tooltip,
      tone: group.tone,
    };
  }

  function buildDetailedRender(lane, items) {
    var packed = packItems(items);
    var height = measurePackedHeight(packed);

    var blocks = packed.items.map(function (entry) {
      return buildDetailBlockConfig(
        entry.item,
        lane,
        entry.trackIndex,
        TRACK_PADDING + entry.trackIndex * (TRACK_HEIGHT + TRACK_GAP)
      );
    });

    return {
      blocks: blocks,
      height: height,
      trackCount: packed.trackCount || 1,
    };
  }

  function buildOverviewRender(lane, state, rerender) {
    var groups = groupOverviewItems(lane);
    var expandedClusterId = state.expandedClusters[lane.id] || null;
    var expandedGroup = null;
    var packedExpanded = null;
    var expandedDetailsTop = 0;

    groups.forEach(function (group) {
      if (!expandedGroup && expandedClusterId && group.clusterKey === expandedClusterId && group.isCluster) {
        expandedGroup = group;
      }
    });

    if (expandedGroup) {
      packedExpanded = packItems(expandedGroup.detailItems);
      expandedDetailsTop = TRACK_PADDING + OVERVIEW_BLOCK_HEIGHT + TRACK_GAP;
    }

    var height = packedExpanded
      ? Math.max(OVERVIEW_HEIGHT, expandedDetailsTop + measurePackedHeight(packedExpanded))
      : OVERVIEW_HEIGHT;

    var blocks = [];
    groups.forEach(function (group) {
      if (group.isCluster) {
        var isExpanded = !!(expandedGroup && group.renderId === expandedGroup.renderId);
        blocks.push(buildOverviewBlockConfig(group, height, {
          clusterId: group.clusterKey,
          itemId: group.renderId,
          kindClass: 'sf-rail-timeline-item--cluster',
          expanded: isExpanded,
          onClick: function () {
            setExpandedCluster(
              state,
              lane.id,
              state.expandedClusters[lane.id] === group.clusterKey ? null : group.clusterKey
            );
            if (state.config && state.config.onClusterToggle) {
              state.config.onClusterToggle(lane.id, state.expandedClusters[lane.id] || null);
            }
            if (typeof rerender === 'function') rerender();
          },
          top: isExpanded ? TRACK_PADDING : null,
          tooltip: buildClusterTooltip(group, lane),
        }));
        if (isExpanded) {
          packedExpanded.items.forEach(function (entry) {
            blocks.push(buildDetailBlockConfig(
              entry.item,
              lane,
              entry.trackIndex,
              expandedDetailsTop + TRACK_PADDING + entry.trackIndex * (TRACK_HEIGHT + TRACK_GAP),
              {
                clusterId: group.clusterKey,
                detailHint: 'Expanded',
              }
            ));
          });
        }
        return;
      }

      blocks.push(buildOverviewBlockConfig(group, height, {
        itemId: group.items[0].id,
        kindClass: 'sf-rail-timeline-item--overview',
        tooltip: buildOverviewTooltip(group, lane),
      }));
    });

    return {
      blocks: blocks,
      expandedClusterId: expandedGroup ? expandedGroup.clusterKey : null,
      height: height,
      trackCount: packedExpanded ? Math.max(packedExpanded.trackCount, 1) : 1,
    };
  }

  function buildLaneLabel(lane, laneRender, row, headingId) {
    var label = sf.el('div', {
      className: 'sf-rail-timeline-lane-label',
      dataset: { laneId: lane.id },
    });
    label.style.minHeight = laneRender.height + 'px';

    var heading = sf.el('div', { className: 'sf-rail-timeline-lane-heading' });
    var title = sf.el('div', { className: 'sf-rail-timeline-lane-title' }, lane.label);
    title.id = headingId;
    heading.appendChild(title);
    if (lane.mode) {
      heading.appendChild(sf.el('div', { className: 'sf-rail-timeline-lane-mode' }, lane.mode));
    }
    label.appendChild(heading);
    if (row) row.setAttribute('aria-labelledby', title.id);

    if (lane.badges.length > 0) {
      var badges = sf.el('div', { className: 'sf-rail-timeline-lane-badges' });
      lane.badges.forEach(function (badge) {
        var badgeEl = sf.el('span', { className: 'sf-rail-timeline-lane-badge' }, badge.label);
        if (badge.style) {
          badgeEl.style.background = badge.style.bg || '';
          badgeEl.style.border = badge.style.border || '';
          badgeEl.style.color = badge.style.color || '';
        }
        badges.appendChild(badgeEl);
      });
      label.appendChild(badges);
    }

    if (lane.stats.length > 0) {
      var stats = sf.el('div', { className: 'sf-rail-timeline-lane-stats' });
      lane.stats.forEach(function (stat) {
        var statRow = sf.el('div', { className: 'sf-rail-timeline-lane-stat' });
        statRow.appendChild(sf.el('span', { className: 'sf-rail-timeline-lane-stat-label' }, stat.label));
        statRow.appendChild(sf.el('span', { className: 'sf-rail-timeline-lane-stat-value' }, String(stat.value)));
        stats.appendChild(statRow);
      });
      label.appendChild(stats);
    }

    return label;
  }

  function buildClusterTooltip(group, lane) {
    var first = group.detailItems[0] || group.items[0];
    var payload = {
      rows: [
        { key: 'Lane', value: lane.label },
        { key: 'Window', value: formatMinuteRange(group.startMinute, group.endMinute, lane.axis) },
        { key: 'Items', value: String(group.summary.count) },
      ],
      title: group.label,
    };

    if (group.summary.openCount > 0) {
      payload.rows.push({ key: 'Open', value: String(group.summary.openCount) });
    }
    if (group.summary.toneSegments.length > 0) {
      payload.rows.push({ key: 'Mix', value: describeToneSegments(group.summary.toneSegments) });
    }

    if (first && first.meta) {
      payload.rows.push({ key: 'Sample', value: describeMeta(first.meta) });
    }

    return payload;
  }

  function buildItemTooltip(item, lane) {
    var rows = [
      { key: 'Lane', value: lane.label },
      { key: 'Time', value: formatMinuteRange(item.startMinute, item.endMinute, lane.axis) },
    ];

    appendMetaRows(rows, item.meta);

    return {
      rows: rows,
      title: item.label,
    };
  }

  function buildOverviewBlockMeta(group) {
    if (group.summary && group.summary.secondaryLabel) return group.summary.secondaryLabel;
    var labels = [];
    group.items.slice(0, 2).forEach(function (item) {
      labels.push(item.label);
    });
    if (group.count > 2) labels.push('+' + (group.count - 2) + ' more');
    return labels.join(' • ');
  }

  function buildPresetViewport(axis, currentViewport, preset) {
    var duration = preset === '1w' ? WEEK_MINUTES : preset === '2w' ? WEEK_MINUTES * 2 : WEEK_MINUTES * 4;
    var visibleDuration = clampNumber(duration, DAY_MINUTES, axis.endMinute - axis.startMinute);
    var center = currentViewport.startMinute + (currentViewport.endMinute - currentViewport.startMinute) / 2;
    var start = Math.round(center - visibleDuration / 2);
    return clampViewport(axis, {
      startMinute: start,
      endMinute: start + visibleDuration,
    });
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clampViewport(axis, viewport) {
    var totalDuration = axis.endMinute - axis.startMinute;
    var next = viewport || axis.initialViewport || {
      startMinute: axis.startMinute,
      endMinute: axis.endMinute,
    };
    var duration = next.endMinute - next.startMinute;
    duration = Math.min(duration, totalDuration);

    var start = clampNumber(next.startMinute, axis.startMinute, axis.endMinute - duration);

    return {
      endMinute: start + duration,
      startMinute: start,
    };
  }

  function assertFiniteNumber(value, label) {
    sf.assert(typeof value === 'number' && isFinite(value), label + ' must be a finite number');
    return value;
  }

  function assertMinuteValue(value, label) {
    return assertInteger(value, label);
  }

  function assertInteger(value, label) {
    var number = assertFiniteNumber(value, label);
    sf.assert(Math.floor(number) === number, label + ' must be an integer');
    return number;
  }

  function assertNonNegativeInteger(value, label) {
    var number = assertInteger(value, label);
    sf.assert(number >= 0, label + ' must be greater than or equal to zero');
    return number;
  }

  function describeMeta(meta) {
    if (meta == null) return '';
    if (typeof meta === 'string') return meta;
    if (typeof meta === 'number') return String(meta);
    if (Array.isArray(meta)) {
      return meta.map(function (entry) {
        if (entry && entry.label && entry.value != null) return entry.label + ': ' + entry.value;
        return String(entry || '');
      }).filter(Boolean).join(' • ');
    }
    if (typeof meta === 'object') {
      return Object.keys(meta).map(function (key) {
        return key + ': ' + meta[key];
      }).join(' • ');
    }
    return String(meta);
  }

  function appendMetaRows(rows, meta) {
    if (meta == null) return;
    if (typeof meta === 'string' || typeof meta === 'number') {
      rows.push({ key: 'Meta', value: String(meta) });
      return;
    }
    if (Array.isArray(meta)) {
      meta.forEach(function (entry, index) {
        if (!entry) return;
        if (entry.label && entry.value != null) {
          rows.push({ key: entry.label, value: String(entry.value) });
          return;
        }
        rows.push({ key: 'Meta ' + (index + 1), value: String(entry) });
      });
      return;
    }
    if (typeof meta === 'object') {
      Object.keys(meta).forEach(function (key) {
        rows.push({ key: key, value: String(meta[key]) });
      });
    }
  }

  function normalizeMinuteRange(startValue, endValue, startLabel, endLabel) {
    var startMinute = assertMinuteValue(startValue, startLabel);
    var endMinute = assertMinuteValue(endValue, endLabel);
    sf.assert(endMinute > startMinute, endLabel + ' must be greater than startMinute');
    return {
      endMinute: endMinute,
      startMinute: startMinute,
    };
  }

  function normalizeId(value, prefix, suffix) {
    return value != null ? String(value) : prefix + suffix;
  }

  function buildScopedId(scope, suffix) {
    return scope + '-' + suffix;
  }

  function setExpandedCluster(state, laneId, clusterId) {
    if (clusterId == null) delete state.expandedClusters[laneId];
    else state.expandedClusters[laneId] = String(clusterId);
  }

  function normalizeAxis(axis) {
    sf.assert(axis && axis.startMinute != null && axis.endMinute != null, 'createTimeline(model.axis.startMinute/endMinute) are required');
    var axisRange = normalizeMinuteRange(
      axis.startMinute,
      axis.endMinute,
      'createTimeline(model.axis.startMinute)',
      'createTimeline(model.axis.endMinute)'
    );

    var normalized = {
      endMinute: axisRange.endMinute,
      startMinute: axisRange.startMinute,
    };

    normalized.days = normalizeDays(axis.days, normalized.startMinute, normalized.endMinute);
    normalized.ticks = normalizeTicks(axis.ticks, normalized.startMinute, normalized.endMinute);
    normalized.initialViewport = clampViewport(
      normalized,
      normalizeViewportInput(axis.initialViewport, 'createTimeline(model.axis.initialViewport)') || {
        startMinute: normalized.startMinute,
        endMinute: normalized.endMinute,
      }
    );

    return normalized;
  }

  function normalizeBadge(badge) {
    if (!badge) return null;
    if (typeof badge === 'string') return { label: badge };
    return {
      label: badge.label || '',
      style: badge.style || null,
    };
  }

  function normalizeDays(days, startMinute, endMinute) {
    var list = [];
    var source = Array.isArray(days) && days.length > 0 ? days : null;
    var cursor = startMinute;
    var index = 0;

    if (!source) {
      while (cursor < endMinute) {
        list.push(makeDay({
          endMinute: Math.min(cursor + DAY_MINUTES, endMinute),
          isWeekend: false,
          label: 'Day ' + (index + 1),
          startMinute: cursor,
        }, index));
        cursor += DAY_MINUTES;
        index += 1;
      }
      return list;
    }

    source.forEach(function (day, dayIndex) {
      if (cursor >= endMinute) return;
      if (typeof day === 'string') {
        var generatedEnd = Math.min(cursor + DAY_MINUTES, endMinute);
        list.push(makeDay({
          endMinute: generatedEnd,
          isWeekend: inferWeekend(day),
          label: day,
          startMinute: cursor,
        }, dayIndex));
        cursor = generatedEnd;
        return;
      }

      var nextStart = day.startMinute != null
        ? day.startMinute
        : cursor;
      var nextEnd = day.endMinute != null
        ? day.endMinute
        : Math.min(nextStart + DAY_MINUTES, endMinute);
      var dayRange = normalizeMinuteRange(
        nextStart,
        nextEnd,
        'createTimeline(model.axis.days[' + dayIndex + '].startMinute)',
        'createTimeline(model.axis.days[' + dayIndex + '].endMinute)'
      );
      list.push(makeDay({
        endMinute: dayRange.endMinute,
        isWeekend: day.isWeekend != null ? !!day.isWeekend : inferWeekend(day.label),
        label: day.label || 'Day ' + (dayIndex + 1),
        startMinute: dayRange.startMinute,
        subLabel: day.subLabel || day.meta || '',
      }, dayIndex));
      cursor = dayRange.endMinute;
    });

    return list;
  }

  function normalizeItem(item, pathKey, ordinal) {
    sf.assert(item && item.startMinute != null && item.endMinute != null, 'timeline items require startMinute/endMinute');
    var itemRange = normalizeMinuteRange(
      item.startMinute,
      item.endMinute,
      'createTimeline(model.lanes[].items[].startMinute)',
      'createTimeline(model.lanes[].items[].endMinute)'
    );

    return {
      clusterId: item.clusterId != null ? String(item.clusterId) : null,
      detailItems: Array.isArray(item.detailItems)
        ? item.detailItems.map(function (detailItem, detailIndex) {
          return normalizeItem(detailItem, pathKey + '-' + detailIndex, detailIndex);
        })
        : [],
      endMinute: itemRange.endMinute,
      id: normalizeId(item.id, 'item-', pathKey),
      label: item.label || 'Item ' + (ordinal + 1),
      meta: item.meta != null ? item.meta : '',
      originalIndex: ordinal,
      summary: normalizeOverviewSummary(item.summary, 'createTimeline(model.lanes[].items[].summary)'),
      startMinute: itemRange.startMinute,
      tone: resolveTone(item.tone || item.color || 'slate'),
    };
  }

  function normalizeLane(lane, index, axis) {
    sf.assert(lane && Array.isArray(lane.items), 'timeline lanes require an items array');

    var normalizedLane = {
      axis: axis,
      badges: [],
      id: normalizeId(lane.id, 'lane-', index),
      items: lane.items.map(function (item, itemIndex) {
        return normalizeItem(item, index + '-' + itemIndex, itemIndex);
      }),
      label: lane.label || 'Lane ' + (index + 1),
      mode: lane.mode === 'overview' ? 'overview' : 'detailed',
      overlays: Array.isArray(lane.overlays)
        ? lane.overlays.map(function (overlay, overlayIndex) {
          return normalizeOverlay(overlay, overlayIndex, axis);
        }).filter(Boolean)
        : [],
      stats: Array.isArray(lane.stats) ? lane.stats : [],
    };

    normalizedLane.items.sort(compareItems);

    if (Array.isArray(lane.badges)) {
      lane.badges.forEach(function (badge) {
        var normalizedBadge = normalizeBadge(badge);
        if (normalizedBadge) normalizedLane.badges.push(normalizedBadge);
      });
    } else {
      var singleBadge = normalizeBadge(lane.badges);
      if (singleBadge) normalizedLane.badges.push(singleBadge);
    }

    return normalizedLane;
  }

  function normalizeModel(model) {
    sf.assert(model && model.axis && Array.isArray(model.lanes), 'createTimeline(model.axis/model.lanes) are required');
    var axis = normalizeAxis(model.axis);

    return {
      axis: axis,
      lanes: model.lanes.map(function (lane, index) {
        return normalizeLane(lane, index, axis);
      }),
    };
  }

  function normalizeOverlay(overlay, index, axis) {
    var label = 'createTimeline(model.lanes[].overlays[' + index + '])';
    sf.assert(overlay && typeof overlay === 'object', label + ' must be an object');

    var startMinute = overlay.startMinute;
    var endMinute = overlay.endMinute;

    if ((startMinute == null || endMinute == null) && overlay.dayIndex != null) {
      var dayIndex = assertInteger(overlay.dayIndex, label + '.dayIndex');
      var day = axis.days[dayIndex];
      sf.assert(day, label + '.dayIndex must reference an existing day');
      var dayCount = overlay.dayCount == null ? 1 : assertInteger(overlay.dayCount, label + '.dayCount');
      sf.assert(dayCount > 0, label + '.dayCount must be greater than zero');
      var lastDay = axis.days[Math.min(axis.days.length - 1, dayIndex + dayCount - 1)] || day;
      startMinute = day.startMinute;
      endMinute = lastDay.endMinute;
    }

    sf.assert(
      startMinute != null && endMinute != null,
      label + ' requires startMinute/endMinute or dayIndex/dayCount'
    );
    var overlayRange = normalizeMinuteRange(
      startMinute,
      endMinute,
      label + '.startMinute',
      label + '.endMinute'
    );

    return {
      endMinute: overlayRange.endMinute,
      id: normalizeId(overlay.id, 'overlay-', index),
      label: overlay.label || '',
      meta: overlay.meta || '',
      startMinute: overlayRange.startMinute,
      tone: resolveTone(overlay.tone || overlay.color || 'slate'),
    };
  }

  function normalizeTicks(ticks, startMinute, endMinute) {
    var list = [];

    if (Array.isArray(ticks) && ticks.length > 0) {
      ticks.forEach(function (tick, index) {
        if (typeof tick === 'number') {
          var numericTick = assertMinuteValue(tick, 'createTimeline(model.axis.ticks[' + index + '])');
          list.push({ id: 'tick-' + index, label: formatClock(numericTick), minute: numericTick });
          return;
        }
        sf.assert(tick && typeof tick === 'object', 'createTimeline(model.axis.ticks[' + index + ']) must be a number or object');
        sf.assert(tick.minute != null, 'createTimeline(model.axis.ticks[' + index + '].minute) is required');
        var minute = assertMinuteValue(tick.minute, 'createTimeline(model.axis.ticks[' + index + '].minute)');
        list.push({
          id: normalizeId(tick.id, 'tick-', index),
          label: tick.label || formatClock(minute),
          minute: minute,
        });
      });
      return list;
    }

    for (var minute = startMinute; minute < endMinute; minute += SIX_HOUR_MINUTES) {
      list.push({
        id: 'tick-' + minute,
        label: formatClock(minute),
        minute: minute,
      });
    }

    return list;
  }

  function makeDay(day, index) {
    return {
      endMinute: day.endMinute,
      id: normalizeId(day.id, 'day-', index),
      isWeekend: !!day.isWeekend,
      label: day.label || 'Day ' + (index + 1),
      startMinute: day.startMinute,
      subLabel: day.subLabel || '',
    };
  }

  function compareItems(left, right) {
    if (left.startMinute !== right.startMinute) return left.startMinute - right.startMinute;
    if (left.endMinute !== right.endMinute) return left.endMinute - right.endMinute;
    if (left.label !== right.label) return left.label < right.label ? -1 : 1;
    return left.originalIndex - right.originalIndex;
  }

  function normalizeOverviewSummary(summary, label) {
    if (summary == null) return null;
    sf.assert(summary && typeof summary === 'object', label + ' must be an object');

    var normalized = {
      count: summary.count == null ? null : assertNonNegativeInteger(summary.count, label + '.count'),
      openCount: summary.openCount == null ? null : assertNonNegativeInteger(summary.openCount, label + '.openCount'),
      primaryLabel: summary.primaryLabel == null ? '' : String(summary.primaryLabel),
      secondaryLabel: summary.secondaryLabel == null ? '' : String(summary.secondaryLabel),
      toneSegments: Array.isArray(summary.toneSegments)
        ? summary.toneSegments.map(function (segment, index) {
          sf.assert(segment && typeof segment === 'object', label + '.toneSegments[' + index + '] must be an object');
          return {
            count: assertNonNegativeInteger(segment.count, label + '.toneSegments[' + index + '].count'),
            tone: resolveTone(segment.tone || segment.color || 'slate'),
          };
        }).filter(function (segment) {
          return segment.count > 0;
        })
        : [],
    };

    if (normalized.count != null && normalized.openCount != null) {
      sf.assert(normalized.openCount <= normalized.count, label + '.openCount must not exceed count');
    }

    return normalized;
  }

  function renderAxisDecor(track, axis, includeLabels) {
    appendWeekendBands(track, axis);
    appendDayDividers(track, axis);
    appendTicks(track, axis, includeLabels);
    if (includeLabels) appendDayBands(track, axis);
  }

  function appendDayBands(track, axis) {
    axis.days.forEach(function (day) {
      var band = sf.el('div', { className: 'sf-rail-timeline-day-band' });
      band.style.left = positionPct(day.startMinute, axis) + '%';
      band.style.width = spanPct(day.startMinute, day.endMinute, axis) + '%';
      band.appendChild(sf.el('div', { className: 'sf-rail-timeline-day-label' }, day.label));
      if (day.subLabel) {
        band.appendChild(sf.el('div', { className: 'sf-rail-timeline-day-sub' }, day.subLabel));
      }
      track.appendChild(band);
    });
  }

  function appendDayDividers(track, axis) {
    axis.days.forEach(function (day, index) {
      if (index === 0) return;
      var divider = sf.el('div', { className: 'sf-rail-timeline-day-divider' });
      divider.style.left = positionPct(day.startMinute, axis) + '%';
      track.appendChild(divider);
    });
  }

  function appendTicks(track, axis, includeLabels) {
    axis.ticks.forEach(function (tick) {
      if (tick.minute < axis.startMinute || tick.minute >= axis.endMinute) return;
      var tickEl = sf.el('div', { className: 'sf-rail-timeline-tick' });
      tickEl.style.left = positionPct(tick.minute, axis) + '%';
      track.appendChild(tickEl);

      if (!includeLabels) return;
      var label = sf.el('div', { className: 'sf-rail-timeline-tick-label' }, tick.label);
      label.style.left = positionPct(tick.minute, axis) + '%';
      track.appendChild(label);
    });
  }

  function appendWeekendBands(track, axis) {
    axis.days.forEach(function (day) {
      if (!day.isWeekend) return;
      var band = sf.el('div', { className: 'sf-rail-timeline-weekend-band' });
      band.style.left = positionPct(day.startMinute, axis) + '%';
      band.style.width = spanPct(day.startMinute, day.endMinute, axis) + '%';
      track.appendChild(band);
    });
  }

  function renderOverlays(track, overlays, axis) {
    overlays.forEach(function (overlay) {
      var band = sf.el('div', { className: 'sf-rail-timeline-overlay' });
      band.style.left = positionPct(overlay.startMinute, axis) + '%';
      band.style.width = spanPct(overlay.startMinute, overlay.endMinute, axis) + '%';
      band.style.background = overlay.tone.overlay;
      band.style.borderColor = overlay.tone.border;
      if (overlay.label) band.title = overlay.label;
      track.appendChild(band);
    });
  }

  function groupOverviewItems(lane) {
    var groups = [];
    var current = null;

    lane.items.forEach(function (item) {
      if (!current || item.startMinute > current.endMinute + OVERVIEW_GROUP_GAP_MINUTES) {
        if (current) groups.push(current);
        current = {
          clusterId: item.clusterId,
          endMinute: item.endMinute,
          items: [item],
          lane: lane,
          startMinute: item.startMinute,
        };
        return;
      }
      current.items.push(item);
      current.endMinute = Math.max(current.endMinute, item.endMinute);
      if (!current.clusterId && item.clusterId) current.clusterId = item.clusterId;
    });
    if (current) groups.push(current);

    groups.forEach(function (group, groupIndex) {
      finalizeGroup(group, lane, groupIndex);
    });
    assertUniqueClusterKeys(lane, groups);

    return groups;
  }

  function finalizeGroup(group, lane, index) {
    var detailItems = [];

    group.items.forEach(function (item) {
      if (item.detailItems.length > 0) {
        item.detailItems.forEach(function (detailItem) {
          detailItems.push(detailItem);
        });
        return;
      }
      detailItems.push(item);
    });

    detailItems.sort(compareItems);
    group.detailItems = detailItems;
    group.isCluster = detailItems.length > 1 || group.items.some(function (item) {
      return item.detailItems.length > 0;
    });
    group.renderId = group.isCluster
      ? buildScopedId('cluster', lane.id + '-' + index + '-' + (group.items[0] ? group.items[0].id : 'group'))
      : normalizeId(group.items[0] ? group.items[0].id : null, 'group-', lane.id + '-' + index);
    group.clusterKey = group.isCluster ? String(group.clusterId || group.renderId) : null;
    group.summary = deriveOverviewSummary(group);
    group.count = group.summary.count;
    group.label = group.summary.primaryLabel;
    group.metaLabel = group.summary.secondaryLabel;
    group.tone = group.summary.primaryTone || dominantTone(group.detailItems);
  }

  function assertUniqueClusterKeys(lane, groups) {
    var seen = {};

    groups.forEach(function (group) {
      if (!group.clusterKey) return;
      sf.assert(
        !seen[group.clusterKey],
        'createTimeline(model.lanes[].items[].clusterId) must identify at most one overview group per lane; lane "' + lane.id + '" reuses "' + group.clusterKey + '"'
      );
      seen[group.clusterKey] = true;
    });
  }

  function dominantTone(items) {
    var toneSegments = buildToneSegmentsFromItems(items);
    if (!toneSegments.length) return resolveTone('slate');
    return toneSegments[0].tone;
  }

  function effectiveOverviewItems(item) {
    return item.detailItems.length > 0 ? item.detailItems : [item];
  }

  function deriveOverviewContribution(item) {
    var items = effectiveOverviewItems(item);
    var summary = item.summary;

    return {
      count: summary && summary.count != null ? summary.count : items.length,
      openCount: summary && summary.openCount != null ? summary.openCount : inferOpenCount(items),
      toneSegments: summary && summary.toneSegments.length > 0 ? summary.toneSegments : buildToneSegmentsFromItems(items),
    };
  }

  function deriveOverviewSummary(group) {
    var contributions = group.items.map(deriveOverviewContribution);
    var summaries = group.items.map(function (item) {
      return item.summary;
    }).filter(Boolean);
    var count = contributions.reduce(function (sum, contribution) {
      return sum + contribution.count;
    }, 0);
    var openCount = contributions.reduce(function (sum, contribution) {
      return sum + contribution.openCount;
    }, 0);
    var toneSegments = mergeToneSegments(contributions.reduce(function (segments, contribution) {
      return segments.concat(contribution.toneSegments);
    }, []));
    var primarySummary = summaries.length === 1 ? summaries[0] : null;

    return {
      count: count,
      openCount: openCount,
      primaryLabel: primarySummary && primarySummary.primaryLabel
        ? primarySummary.primaryLabel
        : count > 1
          ? count + ' assignments'
          : group.items[0].label,
      primaryTone: toneSegments[0] ? toneSegments[0].tone : dominantTone(group.detailItems),
      secondaryLabel: primarySummary && primarySummary.secondaryLabel
        ? primarySummary.secondaryLabel
        : count > 1
          ? buildOverviewBlockMeta({
            count: count,
            items: group.detailItems,
          })
          : describeMeta(group.items[0].meta),
      toneSegments: toneSegments,
    };
  }

  function inferOpenCount(items) {
    return items.reduce(function (count, item) {
      if (!item) return count;
      if (item.summary && item.summary.openCount != null) return count + item.summary.openCount;
      if (!item.meta || typeof item.meta !== 'object' || Array.isArray(item.meta)) return count;
      if (typeof item.meta.openCount === 'number' && isFinite(item.meta.openCount)) return count + item.meta.openCount;
      if (typeof item.meta.unassignedCount === 'number' && isFinite(item.meta.unassignedCount)) return count + item.meta.unassignedCount;
      if (item.meta.open === true || item.meta.unassigned === true) return count + 1;
      if (typeof item.meta.status === 'string' && /open|unassigned/i.test(item.meta.status)) return count + 1;
      return count;
    }, 0);
  }

  function mergeToneSegments(segments) {
    var byTone = {};
    segments.forEach(function (segment) {
      if (!segment || !(segment.count > 0)) return;
      var toneId = segment.tone.id || segment.tone.border || 'slate';
      if (!byTone[toneId]) {
        byTone[toneId] = {
          count: 0,
          tone: segment.tone,
        };
      }
      byTone[toneId].count += segment.count;
    });
    return Object.keys(byTone).map(function (toneId) {
      return byTone[toneId];
    }).sort(compareToneSegments);
  }

  function buildToneSegmentsFromItems(items) {
    return mergeToneSegments(items.map(function (item) {
      return {
        count: 1,
        tone: item.tone,
      };
    }));
  }

  function compareToneSegments(left, right) {
    if (left.count !== right.count) return right.count - left.count;
    if (left.tone.id === right.tone.id) return 0;
    return left.tone.id < right.tone.id ? -1 : 1;
  }

  function buildOverviewBlockSummary(group, expanded) {
    var badges = [];
    if (group.summary.count > 1) {
      badges.push({ kind: 'count', text: group.summary.count + ' total' });
    }
    if (group.summary.openCount > 0) {
      badges.push({ kind: 'open', text: group.summary.openCount + ' open' });
    }
    if (group.isCluster) {
      badges.push({ kind: 'action', text: expanded ? 'Enter to collapse' : 'Enter to inspect' });
    }
    return {
      badges: badges,
      toneSegments: group.summary.toneSegments,
    };
  }

  function buildItemAriaLabel(item, lane) {
    var parts = [
      lane.label,
      item.label,
      formatMinuteRange(item.startMinute, item.endMinute, lane.axis),
    ];
    var meta = describeMeta(item.meta);
    if (meta) parts.push(meta);
    return parts.join(' · ');
  }

  function buildOverviewAriaLabel(group, lane, expanded) {
    var parts = [
      lane.label,
      group.summary.primaryLabel,
      formatMinuteRange(group.startMinute, group.endMinute, lane.axis),
    ];
    if (group.summary.secondaryLabel) parts.push(group.summary.secondaryLabel);
    if (group.summary.count > 1) parts.push(group.summary.count + ' assignments');
    if (group.summary.openCount > 0) parts.push(group.summary.openCount + ' open');
    if (group.summary.toneSegments.length > 0) parts.push(describeToneSegments(group.summary.toneSegments));
    if (group.isCluster) parts.push(expanded ? 'Expanded. Press Enter to collapse' : 'Press Enter to expand');
    return parts.join(' · ');
  }

  function describeToneSegments(segments) {
    return segments.map(function (segment) {
      return segment.count + ' ' + segment.tone.id;
    }).join(', ');
  }

  function buildOverviewTooltip(group, lane) {
    if (group.summary.count > 1 || group.summary.openCount > 0 || group.summary.toneSegments.length > 1) {
      return buildClusterTooltip(group, lane);
    }
    return buildItemTooltip(group.items[0], lane);
  }

  function packItems(items) {
    var trackEnds = [];
    var packed = [];

    items.slice().sort(compareItems).forEach(function (item) {
      var trackIndex = 0;
      while (trackIndex < trackEnds.length && item.startMinute < trackEnds[trackIndex]) {
        trackIndex += 1;
      }
      if (trackIndex === trackEnds.length) trackEnds.push(item.endMinute);
      else trackEnds[trackIndex] = item.endMinute;
      packed.push({
        item: item,
        trackIndex: trackIndex,
      });
    });

    return {
      items: packed,
      trackCount: trackEnds.length,
    };
  }

  function positionPct(minute, axis) {
    var total = axis.endMinute - axis.startMinute;
    if (total <= 0) return 0;
    return ((minute - axis.startMinute) / total) * 100;
  }

  function spanPct(startMinute, endMinute, axis) {
    var total = axis.endMinute - axis.startMinute;
    if (total <= 0) return 0;
    return Math.max(((endMinute - startMinute) / total) * 100, 0.25);
  }

  function formatClock(minute) {
    var normalized = minute % DAY_MINUTES;
    if (normalized < 0) normalized += DAY_MINUTES;
    var hours = Math.floor(normalized / 60);
    var minutes = normalized % 60;
    return pad(hours) + ':' + pad(minutes);
  }

  function formatMinuteRange(startMinute, endMinute, axis) {
    return formatMinute(startMinute, axis) + ' → ' + formatMinute(endMinute, axis);
  }

  function formatMinute(minute, axis) {
    var dayLabel = '';
    axis.days.forEach(function (day) {
      if (minute >= day.startMinute && minute < day.endMinute && !dayLabel) {
        dayLabel = day.label;
      }
    });
    return (dayLabel ? dayLabel + ' ' : '') + formatClock(minute);
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function inferWeekend(label) {
    return /sat|sun|weekend/i.test(String(label || ''));
  }

  function isColorString(value) {
    return /^#|^rgb|^hsl/i.test(String(value || ''));
  }

  function resolveTone(tone) {
    if (tone && typeof tone === 'object') {
      return {
        id: tone.id || tone.name || tone.borderColor || tone.color || 'custom',
        background: tone.background || tone.bg || tone.color || TONE_MAP.slate.background,
        border: tone.border || tone.borderColor || tone.color || TONE_MAP.slate.border,
        overlay: tone.overlay || tone.band || tone.background || tone.bg || TONE_MAP.slate.overlay,
        text: tone.text || tone.textColor || tone.foreground || TONE_MAP.slate.text,
      };
    }
    if (TONE_MAP[tone]) return TONE_MAP[tone];
    if (isColorString(tone)) {
      return {
        id: String(tone),
        background: tone,
        border: tone,
        overlay: tone,
        text: '#111827',
      };
    }
    return TONE_MAP.slate;
  }

  function measureLayout(bodyViewport, state) {
    var viewportWidth = getMeasuredViewportWidth(bodyViewport);
    if (!(viewportWidth > 0)) return null;

    var preferredLabelWidth = state.labelWidth;
    var maxLabelWidth = viewportWidth - MIN_VISIBLE_TRACK_WIDTH;
    var effectiveLabelWidth = preferredLabelWidth;
    var visibleDuration = state.viewport.endMinute - state.viewport.startMinute;
    var totalDuration = state.model.axis.endMinute - state.model.axis.startMinute;
    var scale = totalDuration > 0 && visibleDuration > 0
      ? totalDuration / visibleDuration
      : 1;
    if (effectiveLabelWidth < MIN_LABEL_WIDTH) effectiveLabelWidth = MIN_LABEL_WIDTH;
    if (maxLabelWidth >= MIN_LABEL_WIDTH) effectiveLabelWidth = Math.min(effectiveLabelWidth, maxLabelWidth);
    else effectiveLabelWidth = MIN_LABEL_WIDTH;

    var visibleTrackWidth = Math.max(viewportWidth - effectiveLabelWidth, 0);
    var contentTrackWidth = Math.max(
      Math.round(visibleTrackWidth * scale),
      visibleTrackWidth,
      MIN_CONTENT_TRACK_WIDTH
    );
    var contentWidth = effectiveLabelWidth + contentTrackWidth;

    return {
      contentWidth: contentWidth,
      contentTrackWidth: contentTrackWidth,
      effectiveLabelWidth: effectiveLabelWidth,
      visibleTrackWidth: visibleTrackWidth,
      viewportWidth: viewportWidth,
    };
  }

  function viewportToScrollLeft(state, viewportEl) {
    var axis = state.model.axis;
    var totalDuration = axis.endMinute - axis.startMinute;
    var visibleDuration = state.viewport.endMinute - state.viewport.startMinute;
    var remainingDuration = Math.max(totalDuration - visibleDuration, 0);
    var maxScrollLeft = getMaxScrollLeft(viewportEl);
    if (remainingDuration <= 0 || maxScrollLeft <= 0) return 0;
    return Math.round(((state.viewport.startMinute - axis.startMinute) / remainingDuration) * maxScrollLeft);
  }

  function scrollLeftToViewport(state, viewportEl) {
    var axis = state.model.axis;
    var totalDuration = axis.endMinute - axis.startMinute;
    var visibleDuration = state.viewport.endMinute - state.viewport.startMinute;
    var remainingDuration = Math.max(totalDuration - visibleDuration, 0);
    var maxScrollLeft = getMaxScrollLeft(viewportEl);
    if (remainingDuration <= 0 || maxScrollLeft <= 0) {
      return clampViewport(axis, {
        startMinute: axis.startMinute,
        endMinute: axis.startMinute + visibleDuration,
      });
    }
    var ratio = clampNumber((viewportEl.scrollLeft || 0) / maxScrollLeft, 0, 1);
    var startMinute = axis.startMinute + remainingDuration * ratio;
    return clampViewport(axis, {
      startMinute: startMinute,
      endMinute: startMinute + visibleDuration,
    });
  }

  function getMaxScrollLeft(viewportEl) {
    var scrollWidth = viewportEl.scrollWidth || 0;
    var clientWidth = viewportEl.clientWidth || viewportEl.offsetWidth || 0;
    return Math.max(scrollWidth - clientWidth, 0);
  }

  function bindResizeObserver(bodyViewport, state, syncLayoutFromViewport) {
    if (typeof ResizeObserver !== 'function') return;

    var resizeObserver = new ResizeObserver(function () {
      if (state.destroyed) return;
      syncLayoutFromViewport();
    });
    resizeObserver.observe(bodyViewport);
    state.cleanup.push(function () {
      resizeObserver.disconnect();
    });
  }

  function bindWindowResize(state, syncLayoutFromViewport) {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    function handleResize() {
      if (state.destroyed) return;
      syncLayoutFromViewport();
    }

    window.addEventListener('resize', handleResize);
    state.cleanup.push(function () {
      if (typeof window.removeEventListener === 'function') window.removeEventListener('resize', handleResize);
    });
  }

  function getMeasuredViewportWidth(bodyViewport) {
    if (!bodyViewport) return 0;
    if (typeof bodyViewport.clientWidth === 'number' && bodyViewport.clientWidth > 0) {
      return Math.round(bodyViewport.clientWidth);
    }
    if (typeof bodyViewport.offsetWidth === 'number' && bodyViewport.offsetWidth > 0) {
      return Math.round(bodyViewport.offsetWidth);
    }
    if (typeof bodyViewport.getBoundingClientRect === 'function') {
      var rect = bodyViewport.getBoundingClientRect();
      if (rect && typeof rect.width === 'number' && rect.width > 0) {
        return Math.round(rect.width);
      }
    }
    return 0;
  }

  function applyLayout(root, headerRow, lanes, layout) {
    setCustomProperty(root.style, '--sf-rail-label-width', layout ? layout.effectiveLabelWidth + 'px' : '');
    setCustomProperty(root.style, '--sf-rail-content-width', layout ? layout.contentWidth + 'px' : '');
    headerRow.style.width = layout ? layout.contentWidth + 'px' : '';
    lanes.style.width = layout ? layout.contentWidth + 'px' : '';
    root.dataset.supportedViewportWidth = layout
      ? String(layout.viewportWidth >= MIN_SUPPORTED_VIEWPORT_WIDTH)
      : '';
  }

  function setCustomProperty(style, name, value) {
    if (!style) return;
    if (typeof style.setProperty === 'function') {
      style.setProperty(name, value);
      return;
    }
    style[name] = value;
  }

  function queuePostMountSync(state, syncLayoutFromViewport) {
    if (state.hasQueuedPostMountSync || typeof setTimeout !== 'function') return;
    state.hasQueuedPostMountSync = true;

    var timerId = setTimeout(function () {
      state.hasQueuedPostMountSync = false;
      if (state.destroyed) return;
      syncLayoutFromViewport();
    }, 0);

    state.cleanup.push(function () {
      if (typeof clearTimeout === 'function') clearTimeout(timerId);
    });
  }

  function normalizeViewportInput(viewport, label) {
    if (viewport == null) return null;
    sf.assert(typeof viewport === 'object', label + ' must be an object');

    return normalizeMinuteRange(
      viewport.startMinute,
      viewport.endMinute,
      label + '.startMinute',
      label + '.endMinute'
    );
  }

  function showTooltip(tooltip, root, payload, event) {
    if (!payload) return;
    tooltip.setAttribute('aria-hidden', 'false');
    tooltip.innerHTML = '';
    tooltip.appendChild(sf.el('div', { className: 'sf-tooltip-title' }, payload.title));
    (payload.rows || []).forEach(function (row) {
      var rowEl = sf.el('div', { className: 'sf-tooltip-row' });
      rowEl.appendChild(sf.el('span', { className: 'sf-tooltip-key' }, row.key));
      rowEl.appendChild(sf.el('span', { className: 'sf-tooltip-val' }, row.value));
      tooltip.appendChild(rowEl);
    });

    var hostRect = root.getBoundingClientRect ? root.getBoundingClientRect() : { left: 0, top: 0 };
    var left = event && event.clientX != null ? event.clientX + 16 : hostRect.left + 16;
    var top = event && event.clientY != null ? event.clientY + 16 : hostRect.top + 16;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
  }

  function showTooltipForElement(tooltip, root, payload, element) {
    var rect = element && typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : null;
    showTooltip(tooltip, root, payload, rect ? {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    } : null);
  }

  function hideTooltip(tooltip) {
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.classList.remove('visible');
  }

  function updateViewportMetadata(root, state) {
    var axis = state.model.axis;
    var duration = state.viewport.endMinute - state.viewport.startMinute;
    root.dataset.timelineSpanMinutes = String(axis.endMinute - axis.startMinute);
    root.dataset.viewportDurationMinutes = String(Math.round(duration));
    root.dataset.viewportStartMinute = String(Math.round(state.viewport.startMinute));
    root.dataset.viewportEndMinute = String(Math.round(state.viewport.endMinute));
  }

  function updateZoomButtons(buttons, state) {
    var duration = Math.round(state.viewport.endMinute - state.viewport.startMinute);
    var initial = state.model.axis.initialViewport;
    buttons.forEach(function (button) {
      var preset = button.dataset.zoom;
      var active = false;
      if (preset === 'reset') {
        active = Math.round(initial.startMinute) === Math.round(state.viewport.startMinute)
          && Math.round(initial.endMinute) === Math.round(state.viewport.endMinute);
      } else if (preset === '1w') active = duration === WEEK_MINUTES;
      else if (preset === '2w') active = duration === WEEK_MINUTES * 2;
      else if (preset === '4w') active = duration === WEEK_MINUTES * 4;
      button.classList.toggle('active', active);
    });
  }

  function pruneExpandedClusters(state) {
    Object.keys(state.expandedClusters).forEach(function (laneId) {
      var exists = state.model.lanes.some(function (lane) {
        return lane.id === laneId;
      });
      if (!exists) delete state.expandedClusters[laneId];
    });
  }

})(SF);
/* ============================================================================
   SolverForge UI — Gantt (Frappe Gantt + Split.js wrapper)
   Requires: Frappe Gantt (Gantt) and Split (Split) loaded globally.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.gantt = {};

  sf.gantt.create = function (config) {
    config = config || {};
    var instanceId = sf.uid('sf-gantt');
    var chartPaneId = config.chartPane || (instanceId + '-chart-pane');
    var gridPaneId = config.gridPane || (instanceId + '-grid-pane');
    var chartContainerId = config.chartContainer || (instanceId + '-container');
    var svgId = config.svgId || (instanceId + '-svg');
    var ganttChart = null;
    var splitInstance = null;
    var mounted = false;
    var mountTarget = null;
    var resizeObserver = null;
    var tasks = [];
    var sortState = { key: null, direction: 'asc' };

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
      if (ganttChart) ganttChart.change_view_mode(viewSelect.value);
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
      validateMountTarget(target);

      if (mounted && mountTarget === target && wrapper.parentNode === target) {
        return;
      }
      if (mounted) ctrl.destroy();
      target.appendChild(wrapper);
      mounted = true;
      mountTarget = target;
      if (tasks.length > 0 || grid.firstChild || chartContainer.firstChild) {
        renderGrid(tasks);
        renderChart(tasks);
      }
      initSplit();
      bindResizeObserver();
    };

    ctrl.setTasks = function (newTasks) {
      sf.assert(Array.isArray(newTasks), 'gantt.setTasks(tasks) expects an array');
      tasks = newTasks;
      renderGrid(newTasks);
      renderChart(newTasks);
    };

    ctrl.refresh = function () {
      if (ganttChart && tasks.length > 0) {
        ganttChart.refresh(tasksToFrappe(tasks));
      }
    };

    ctrl.getChart = function () { return ganttChart; };

    ctrl.changeViewMode = function (mode) {
      viewSelect.value = mode;
      if (ganttChart) ganttChart.change_view_mode(mode);
    };

    ctrl.highlightTask = function (taskId) {
      grid.querySelectorAll('.sf-gantt-row').forEach(function (row) {
        row.classList.toggle('selected', row.dataset.taskId === taskId);
      });
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
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (splitInstance) { splitInstance.destroy(); splitInstance = null; }
      ganttChart = null;
      mounted = false;
      mountTarget = null;
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };

    return ctrl;

    function initSplit() {
      if (typeof Split !== 'function') return;
      if (splitInstance) {
        splitInstance.destroy();
        splitInstance = null;
      }

      var splitSizes = normalizePair(config.splitSizes, [40, 60]);
      var splitMinSize = normalizePair(config.splitMinSize, [200, 300]);

      splitInstance = Split(['#' + gridPaneId, '#' + chartPaneId], {
        direction: 'vertical',
        sizes: splitSizes,
        minSize: splitMinSize,
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

    function bindResizeObserver() {
      if (typeof ResizeObserver !== 'function') return;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      resizeObserver = new ResizeObserver(function () {
        if (!ganttChart) return;
        setTimeout(function () { ganttChart.refresh(tasksToFrappe(tasks)); }, 0);
      });
      if (wrapper.parentNode) resizeObserver.observe(wrapper.parentNode);
    }

    function normalizePair(value, fallback) {
      if (typeof value === 'number' && isFinite(value)) return [value, value];
      if (!Array.isArray(value) || value.length !== 2) return fallback.slice();
      var n0 = Number(value[0]);
      var n1 = Number(value[1]);
      if (!isFinite(n0) || !isFinite(n1)) return fallback.slice();
      return [n0, n1];
    }

    function validateMountTarget(target) {
      sf.assert(target && typeof target.appendChild === 'function', 'gantt.mount(parent) requires a valid DOM container');
      sf.assert(getElementSize(target, 'Width') > 0 && getElementSize(target, 'Height') > 0, 'gantt.mount(parent) target is not laid out yet');
    }

    function getElementSize(target, axis) {
      var clientKey = 'client' + axis;
      var offsetKey = 'offset' + axis;
      var rectKey = axis === 'Width' ? 'width' : 'height';

      if (typeof target[clientKey] === 'number') return target[clientKey];
      if (typeof target[offsetKey] === 'number') return target[offsetKey];
      if (typeof target.getBoundingClientRect === 'function') {
        var rect = target.getBoundingClientRect();
        if (rect && typeof rect[rectKey] === 'number') return rect[rectKey];
      }
      return 0;
    }

    function tasksToFrappe(taskList) {
      return taskList
        .filter(function (t) { return t.start && t.end; })
        .map(function (t) {
          var customClass = t.custom_class || '';
          if (t.pinned) {
            customClass = customClass ? customClass + ' pinned' : 'pinned';
          }
          return {
            id: t.id,
            name: t.name || t.label || t.id,
            start: t.start,
            end: t.end,
            custom_class: customClass,
            dependencies: t.dependencies || '',
          };
        });
    }

    function renderChart(taskList) {
      var frappeTasks = tasksToFrappe(taskList);

      if (frappeTasks.length === 0) {
        chartContainer.textContent = '';
        chartContainer.appendChild(sf.el('div', {
          className: 'sf-gantt-empty-state',
          style: {
            padding: '24px',
            color: 'var(--sf-gray-400)',
            fontFamily: 'var(--sf-font-mono)',
            fontSize: '13px',
          },
        }, 'No scheduled tasks to display.'));
        ganttChart = null;
        return;
      }

      chartContainer.textContent = '';
      chartContainer.appendChild(createSvgRoot(svgId));

      ganttChart = new Gantt('#' + svgId, frappeTasks, {
        view_mode: viewSelect.value || 'Quarter Day',
        date_format: 'YYYY-MM-DD HH:mm',
        custom_popup_html: config.unsafePopupHtml || config.popupHtml || defaultPopup,
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
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      var table = sf.el('table', { className: 'sf-gantt-table' });
      var columns = config.columns || [
        { key: 'name', label: 'Task' },
        { key: 'start', label: 'Start' },
        { key: 'end', label: 'End' },
      ];
      var sortedTasks = sortTasks(taskList);

      var thead = sf.el('thead');
      var headerRow = sf.el('tr');
      columns.forEach(function (col) {
        headerRow.appendChild(buildHeaderCell(col));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tbody = sf.el('tbody');
      sortedTasks.forEach(function (task) {
        var rowClasses = ['sf-gantt-row'];
        if (task.custom_class) rowClasses.push(task.custom_class);
        if (task.projectIndex != null) rowClasses.push('sf-project-' + task.projectIndex);

        var tr = sf.el('tr', {
          className: rowClasses.join(' '),
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
            if (typeof content === 'string') td.textContent = content;
            else if (content && content.unsafeHtml) td.innerHTML = content.unsafeHtml;
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

    function buildHeaderCell(col) {
      if (!col.sortable) {
        return sf.el('th', null, col.label);
      }

      var isCurrent = sortState.key === col.key;
      var th = sf.el('th', {
        className: 'sortable' + (isCurrent ? ' active' : ''),
        role: 'button',
        tabIndex: 0,
        'aria-sort': isCurrent ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none',
      });
      th.appendChild(document.createTextNode(col.label));
      th.appendChild(sf.el('span', { className: 'sort-icon' }, isCurrent ? (sortState.direction === 'asc' ? '▲' : '▼') : ''));

      sf.bindActivation(th, function () {
        if (sortState.key === col.key) {
          sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.key = col.key;
          sortState.direction = 'asc';
        }
        renderGrid(tasks);
      });

      return th;
    }

    function sortTasks(taskList) {
      if (!sortState.key) return taskList.slice();
      var sorted = taskList.slice();
      sorted.sort(function (a, b) {
        var aVal = sortValue(a[sortState.key], sortState.key);
        var bVal = sortValue(b[sortState.key], sortState.key);
        if (aVal === bVal) return 0;
        if (sortState.direction === 'asc') return aVal < bVal ? -1 : 1;
        return aVal > bVal ? -1 : 1;
      });
      return sorted;
    }

    function sortValue(value, key) {
      if (value == null) return '';
      if (key === 'start' || key === 'end') {
        var parsed = Date.parse(value);
        return isNaN(parsed) ? String(value).toLowerCase() : parsed;
      }
      if (typeof value === 'number') return value;
      return String(value).toLowerCase();
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

    function createSvgRoot(id) {
      if (document.createElementNS) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = id;
        return svg;
      }
      return sf.el('svg', { id: id });
    }
  };

})(SF);
/* ============================================================================
   SolverForge UI — Footer Factory
   ============================================================================ */

(function (sf) {
  'use strict';

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
