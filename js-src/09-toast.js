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
