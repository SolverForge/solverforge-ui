/* ============================================================================
   SolverForge UI — Footer Factory
   ============================================================================ */

import {assert, el} from "../core";

export const createFooter = function (config) {
    assert(config, 'createFooter(config) requires a configuration object');

    var footer = el('footer', { className: 'sf-footer' });
    if (config.links) {
      config.links.forEach(function (link, i) {
        if (i > 0) footer.appendChild(el('span', { className: 'sf-vr' }));
        footer.appendChild(el('a', { href: link.url, target: '_blank' }, link.label));
      });
    }
    if (config.version) {
      footer.appendChild(el('span', { style: { marginLeft: 'auto' } }, config.version));
    }
    return footer;
  };
