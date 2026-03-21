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
    var body = sf.el('div', { className: 'sf-modal-body' });

    // Header
    var header = sf.el('div', { className: 'sf-modal-header' });
    header.appendChild(sf.el('div', { className: 'sf-modal-title' }, config.title || ''));

    var closeBtn = sf.el('button', {
      className: 'sf-modal-close',
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
