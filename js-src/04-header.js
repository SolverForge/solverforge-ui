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
