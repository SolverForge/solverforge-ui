/* ============================================================================
   SolverForge UI — Button Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createButton = function (config) {
    sf.assert(config, 'createButton(config) requires a configuration object');

    var classes = ['sf-btn'];

    if (config.variant) classes.push('sf-btn--' + config.variant);
    if (config.size === 'small') classes.push('sf-btn--sm');
    if (config.size === 'large') classes.push('sf-btn--lg');
    if (config.pill) classes.push('sf-btn--pill');
    if (config.circle) classes.push('sf-btn--circle');
    if (config.outline) classes.push('sf-btn--outline');
    if (config.iconOnly) classes.push('sf-btn--icon');

    var btn = sf.el('button', {
      className: classes.join(' '),
      type: 'button',
    });

    if (config.disabled) btn.disabled = true;

    sf.assert(!config.onClick || typeof config.onClick === 'function', 'createButton(onClick) must be a function');

    if (config.icon) {
      var icon = sf.el('i', { className: 'fa-solid ' + config.icon });
      btn.appendChild(icon);
    }

    if (config.text && !config.circle) {
      btn.appendChild(document.createTextNode(config.text));
    }

    if (config.onClick) {
      btn.addEventListener('click', config.onClick);
    }

    if (config.tooltip) {
      btn.title = config.tooltip;
    }

    if (config.ariaLabel) {
      btn.setAttribute('aria-label', config.ariaLabel);
    } else if (config.icon && !config.text) {
      btn.setAttribute('aria-label', config.icon.replace(/fa-/, '').replace(/-/g, ' '));
    }

    if (config.id) {
      btn.id = config.id;
    }

    if (config.dataset) {
      Object.assign(btn.dataset, config.dataset);
    }

    return btn;
  };

})(SF);
