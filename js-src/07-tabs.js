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
