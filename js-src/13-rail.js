/* ============================================================================
   SolverForge UI — Timeline Rail
   Resource-lane timeline: header + cards with positioned blocks.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.rail = {};

  sf.rail.createHeader = function (config) {
    var labelWidth = config.labelWidth || 200;
    var columns = config.columns || [];

    var header = sf.el('div', { className: 'sf-timeline-header' });
    header.style.gridTemplateColumns = labelWidth + 'px 1fr';

    var spacer = sf.el('div', { className: 'sf-timeline-label-spacer' }, config.label || '');
    header.appendChild(spacer);

    var days = sf.el('div', { className: 'sf-timeline-days' });
    days.style.gridTemplateColumns = 'repeat(' + columns.length + ', 1fr)';

    columns.forEach(function (col) {
      var colEl = sf.el('div', { className: 'sf-timeline-day-col' });
      colEl.appendChild(sf.el('span', null, typeof col === 'string' ? col : col.label));
      days.appendChild(colEl);
    });

    header.appendChild(days);
    return header;
  };

  sf.rail.createCard = function (config) {
    var labelWidth = config.labelWidth || 200;
    var card = sf.el('div', { className: 'sf-resource-card' });

    if (config.id) card.dataset.resourceId = config.id;

    // Header row (identity + gauges)
    var resHeader = sf.el('div', { className: 'sf-resource-header' });
    resHeader.style.gridTemplateColumns = labelWidth + 'px 1fr';

    var identity = sf.el('div', { className: 'sf-resource-identity' });
    if (config.name) {
      identity.appendChild(sf.el('div', { className: 'sf-resource-name' }, config.name));
    }
    if (config.badges || config.type) {
      var meta = sf.el('div', { className: 'sf-resource-meta' });
      if (config.type) {
        var badge = sf.el('span', { className: 'sf-resource-type-badge' }, config.type);
        if (config.typeStyle) {
          badge.style.background = config.typeStyle.bg || '';
          badge.style.color = config.typeStyle.color || '';
          badge.style.border = config.typeStyle.border || '';
        }
        meta.appendChild(badge);
      }
      identity.appendChild(meta);
    }
    resHeader.appendChild(identity);

    // Gauges
    if (config.gauges && config.gauges.length > 0) {
      var gauges = sf.el('div', { className: 'sf-gauges' });
      config.gauges.forEach(function (g) {
        var row = sf.el('div', { className: 'sf-gauge-row' });
        row.appendChild(sf.el('span', { className: 'sf-gauge-label' }, g.label));
        var track = sf.el('div', { className: 'sf-gauge-track' });
        var fill = sf.el('div', {
          className: 'sf-gauge-fill' + (g.style ? ' sf-gauge-fill--' + g.style : ''),
        });
        fill.style.width = Math.min(g.pct || 0, 100) + '%';
        track.appendChild(fill);
        row.appendChild(track);
        if (g.text) row.appendChild(sf.el('span', { className: 'sf-gauge-value' }, g.text));
        gauges.appendChild(row);
      });
      resHeader.appendChild(gauges);
    }

    card.appendChild(resHeader);

    // Body (stats + rail)
    var body = sf.el('div', { className: 'sf-resource-body' });
    body.style.gridTemplateColumns = labelWidth + 'px 1fr';

    // Stats panel
    var stats = sf.el('div', { className: 'sf-resource-stats' });
    if (config.stats) {
      config.stats.forEach(function (s) {
        var row = sf.el('div', { className: 'sf-stat-row' });
        row.appendChild(sf.el('span', { className: 'sf-stat-label' }, s.label));
        row.appendChild(sf.el('span', { className: 'sf-stat-value' }, String(s.value)));
        stats.appendChild(row);
      });
    }
    body.appendChild(stats);

    // Rail
    var railContainer = sf.el('div', { className: 'sf-rail-container' });
    var rail = sf.el('div', { className: 'sf-rail' });
    if (config.id) rail.id = 'sf-rail-' + config.id;

    // Day grid
    var numCols = config.columns || 5;
    var dayGrid = sf.el('div', { className: 'sf-day-grid' });
    dayGrid.style.gridTemplateColumns = 'repeat(' + numCols + ', 1fr)';
    for (var i = 0; i < numCols; i++) {
      dayGrid.appendChild(sf.el('div', { className: 'sf-day-col' }));
    }
    rail.appendChild(dayGrid);

    railContainer.appendChild(rail);
    body.appendChild(railContainer);
    card.appendChild(body);

    // API
    var cardApi = { el: card, rail: rail };

    cardApi.addBlock = function (blockConfig) {
      return sf.rail.addBlock(rail, blockConfig);
    };

    cardApi.clearBlocks = function () {
      rail.querySelectorAll('.sf-block, .sf-changeover').forEach(function (el) {
        el.remove();
      });
    };

    cardApi.setSolving = function (solving) {
      card.classList.toggle('solving', solving);
    };

    return cardApi;
  };

  sf.rail.addBlock = function (rail, config) {
    var horizon = config.horizon || 1;
    var startPct = (config.start / horizon) * 100;
    var widthPct = ((config.end - config.start) / horizon) * 100;

    var block = sf.el('div', { className: 'sf-block' });
    block.style.left = startPct + '%';
    block.style.width = Math.max(widthPct, 0.5) + '%';

    if (config.color) {
      block.style.background = config.color;
      block.style.borderLeftColor = config.borderColor || config.color;
    }
    if (config.className) block.classList.add(config.className);
    if (config.late) block.classList.add('late');
    if (config.id) block.dataset.blockId = config.id;
    if (config.delay) block.style.animationDelay = config.delay;

    if (config.label) {
      block.appendChild(sf.el('div', { className: 'sf-block-label' }, config.label));
    }
    if (config.meta) {
      block.appendChild(sf.el('div', { className: 'sf-block-meta' }, config.meta));
    }

    if (config.onHover) {
      block.addEventListener('mouseenter', function (e) { config.onHover(e, config); });
    }
    if (config.onLeave) {
      block.addEventListener('mouseleave', function () { config.onLeave(); });
    }
    if (config.onClick) {
      block.addEventListener('click', function (e) { config.onClick(e, config); });
    }

    rail.appendChild(block);
    return block;
  };

  sf.rail.addChangeover = function (rail, config) {
    var horizon = config.horizon || 1;
    var startPct = (config.start / horizon) * 100;
    var widthPct = ((config.end - config.start) / horizon) * 100;

    var co = sf.el('div', { className: 'sf-changeover' });
    co.style.left = startPct + '%';
    co.style.width = widthPct + '%';
    rail.appendChild(co);
    return co;
  };

})(SF);
