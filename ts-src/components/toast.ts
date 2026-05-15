/* ============================================================================
   SolverForge UI — Toast Notifications
   jQuery-free replacement for showError/showSimpleError.
   ============================================================================ */

import {assert, el} from "../core";

var container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return;
  container = el('div', { className: 'sf-toast-container' });
  document.body.appendChild(container);
}

export const showToast = function (config) {
  assert(config, 'showToast(config) requires a configuration object');

  ensureContainer();

  var variant = config.variant || 'danger';
  var toast = el('div', {
    className: 'sf-toast sf-toast--' + variant + ' sf-toast-enter',
    role: 'status',
    'aria-live': 'polite',
  });

  var msg = el('div', { className: 'sf-toast-message' });
  if (config.title) {
    msg.appendChild(el('div', { className: 'sf-toast-title' }, config.title));
  }
  if (config.message) {
    msg.appendChild(el('div', null, config.message));
  }
  if (config.detail) {
    var pre = el('pre', { style: { margin: '4px 0 0', fontSize: '11px', whiteSpace: 'pre-wrap' } });
    pre.appendChild(el('code', null, config.detail));
    msg.appendChild(pre);
  }
  toast.appendChild(msg);

  var closeBtn = el('button', {
    className: 'sf-toast-close',
    'aria-label': 'Dismiss toast',
    onClick: function () { dismiss(); },
  }, '\u00d7');
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

export const showError = function (title, detail) {
  showToast({ title: 'Error', message: title, detail: detail, variant: 'danger', delay: 30000 });
};
