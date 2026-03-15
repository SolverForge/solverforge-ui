/* ============================================================================
   SolverForge UI — Header Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createHeader = function (config) {
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
      var nav = sf.el('nav', { className: 'sf-header-nav' });
      config.tabs.forEach(function (tab) {
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
