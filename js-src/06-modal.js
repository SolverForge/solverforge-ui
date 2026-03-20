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
