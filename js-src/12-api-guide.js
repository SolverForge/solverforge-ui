/* ============================================================================
   SolverForge UI — API Guide Panel
   Generates REST API documentation from endpoint definitions.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createApiGuide = function (config) {
    var guide = sf.el('div', { className: 'sf-api-guide' });
    var endpoints = config.endpoints || [];

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
