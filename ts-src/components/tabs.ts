/* ============================================================================
   SolverForge UI — Tab Switching
   ============================================================================ */

import {assert, el, uid} from "../core";

export const showTab = function (tabId, root) {
    if (root) {
      activateTabInScope(root, tabId);
      return;
    }

    document.querySelectorAll('.sf-tabs-container').forEach(function (container) {
      activateTabInScope(container, tabId);
    });
  };

export const createTabs = function (config) {
    assert(config, 'createTabs(config) requires a configuration object');
    assert(Array.isArray(config.tabs), 'createTabs(config.tabs) must be an array');

    var container = el('div', { className: 'sf-tabs-container' });
    var tabsId = uid('sf-tabs');

    config.tabs.forEach(function (tab) {
      var panel = el('div', {
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
        showTab(tabId, container);
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
