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
