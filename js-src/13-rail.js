/* ============================================================================
   SolverForge UI — Timeline Rail
   Resource-lane timeline: header + cards with positioned blocks.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.rail = {};

  sf.rail.createHeader = function (config) {
    sf.assert(config, 'createHeader(config) requires a configuration object');
    sf.assert(!config.columns || Array.isArray(config.columns), 'createHeader(config.columns) expects an array');

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
    sf.assert(config, 'createCard(config) requires a configuration object');

    var labelWidth = config.labelWidth || 200;
    var card = sf.el('div', { className: 'sf-resource-card' });
    var state = {
      unassigned: [],
      railConfig: config,
    };

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

    // Optional heatmap strip
    if (config.heatmap) {
      var heatmapCfg = {
        horizon: config.heatmap.horizon || 1,
        label: config.heatmap.label,
        segments: config.heatmap.segments,
      };
      heatmapCfg.railConfig = config;
      var heatmap = sf.rail.createHeatmap(heatmapCfg);
      if (heatmap) card.appendChild(heatmap);
    }

    // Optional unassigned list
    var unassignedRail = sf.el('div', { className: 'sf-unassigned-rail' });
    if (config.unassigned) {
      state.unassigned = config.unassigned;
      renderUnassigned(unassignedRail, config.unassigned, config.onUnassignedClick);
    }
    if (unassignedRail.children.length > 0) card.appendChild(unassignedRail);

    // API
    var cardApi = { el: card, rail: rail };

    cardApi.addBlock = function (blockConfig) {
      return sf.rail.addBlock(rail, blockConfig);
    };

    cardApi.setUnassigned = function (items) {
      state.unassigned = Array.isArray(items) ? items : [];
      if (state.unassigned.length === 0 && unassignedRail.parentNode) {
        unassignedRail.innerHTML = '';
        unassignedRail.parentNode && unassignedRail.parentNode.removeChild(unassignedRail);
        return;
      }
      if (state.unassigned.length > 0) {
        renderUnassigned(unassignedRail, state.unassigned, config.onUnassignedClick);
      } else {
        unassignedRail.innerHTML = '';
      }
      if (state.unassigned.length > 0 && !unassignedRail.parentNode) {
        card.appendChild(unassignedRail);
      }
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

  sf.rail.createHeatmap = function (config) {
    if (!config || !config.segments || !Array.isArray(config.segments) || config.segments.length === 0) return null;

    var heatmap = sf.el('div', { className: 'sf-heatmap' });
    var label = sf.el('div', { className: 'sf-heatmap-label' }, config.label || '');
    heatmap.appendChild(label);

    var track = sf.el('div', { className: 'sf-heatmap-track' });
    var columns = config.railConfig && config.railConfig.columns || 1;
    track.style.gridTemplateColumns = 'repeat(' + columns + ', 1fr)';
    heatmap.appendChild(track);

    var horizon = config.horizon || 1;
    config.segments.forEach(function (segment) {
      if (!segment || segment.end <= segment.start) return;
      var band = sf.el('div', { className: 'sf-heatmap-segment' });
      var start = Math.max(0, segment.start);
      var width = Math.max(0, segment.end - start);
      band.style.left = (start / horizon * 100) + '%';
      band.style.width = Math.max(width / horizon * 100, 0.25) + '%';
      if (segment.color) band.style.background = segment.color;
      if (segment.opacity != null) band.style.opacity = segment.opacity;
      if (segment.tooltip) band.title = segment.tooltip;
      track.appendChild(band);
    });

    return heatmap;
  };

  sf.rail.createUnassignedRail = function (tasks, onTaskClick) {
    var rail = sf.el('div', { className: 'sf-unassigned-rail' });
    renderUnassigned(rail, tasks, onTaskClick);
    return rail;
  };

  sf.rail.addBlock = function (rail, config) {
    sf.assert(rail, 'addBlock(rail) requires a rail element');
    sf.assert(config && config.horizon != null, 'addBlock(config.horizon) is required');
    sf.assert(config.start != null && config.end != null, 'addBlock(config.start/config.end) are required');

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
      block.setAttribute('role', 'button');
      block.tabIndex = 0;
      sf.bindActivation(block, function (e) { config.onClick(e, config); });
    }

    rail.appendChild(block);
    return block;
  };

  sf.rail.addChangeover = function (rail, config) {
    sf.assert(rail, 'addChangeover(rail) requires a rail element');
    sf.assert(config && config.horizon != null, 'addChangeover(config.horizon) is required');
    sf.assert(config.start != null && config.end != null, 'addChangeover(config.start/config.end) are required');

    var horizon = config.horizon || 1;
    var startPct = (config.start / horizon) * 100;
    var widthPct = ((config.end - config.start) / horizon) * 100;

    var co = sf.el('div', { className: 'sf-changeover' });
    co.style.left = startPct + '%';
    co.style.width = widthPct + '%';
    rail.appendChild(co);
    return co;
  };

  function renderUnassigned(unassignedRail, items, onTaskClick) {
    unassignedRail.innerHTML = '';
    (items || []).forEach(function (item) {
      var label = typeof item === 'string' ? item : item.label || item.id || '';
      if (!label) return;
      var pill = sf.el('button', {
        className: 'sf-unassigned-pill',
        onClick: function () {
          if (onTaskClick) onTaskClick(item);
        },
      }, label);
      unassignedRail.appendChild(pill);
    });
  }

})(SF);
