/* ============================================================================
   SolverForge UI — Timeline Rail
   Resource-lane timeline: header + cards with positioned blocks.
   ============================================================================ */

import {assert, bindActivation, el} from "../core";

export const createHeader = function (config) {
  assert(config, 'createHeader(config) requires a configuration object');
  assert(!config.columns || Array.isArray(config.columns), 'createHeader(config.columns) expects an array');

  var labelWidth = config.labelWidth || 200;
  var columns = config.columns || [];

  var header = el('div', { className: 'sf-timeline-header' });
  header.style.gridTemplateColumns = labelWidth + 'px 1fr';

  var spacer = el('div', { className: 'sf-timeline-label-spacer' }, config.label || '');
  header.appendChild(spacer);

  var days = el('div', { className: 'sf-timeline-days' });
  days.style.gridTemplateColumns = 'repeat(' + columns.length + ', 1fr)';

  columns.forEach(function (col) {
    var colEl = el('div', { className: 'sf-timeline-day-col' });
    colEl.appendChild(el('span', null, typeof col === 'string' ? col : col.label));
    days.appendChild(colEl);
  });

  header.appendChild(days);
  return header;
};

export const createCard = function (config) {
  assert(config, 'createCard(config) requires a configuration object');

  var labelWidth = config.labelWidth || 200;
  var card = el('div', { className: 'sf-resource-card' });
  var state = {
    unassigned: [],
    railConfig: config,
  };

  if (config.id) card.dataset.resourceId = config.id;

  // Header row (identity + gauges)
  var resHeader = el('div', { className: 'sf-resource-header' });
  resHeader.style.gridTemplateColumns = labelWidth + 'px 1fr';

  var identity = el('div', { className: 'sf-resource-identity' });
  if (config.name) {
    identity.appendChild(el('div', { className: 'sf-resource-name' }, config.name));
  }
  if (config.badges || config.type) {
    var meta = el('div', { className: 'sf-resource-meta' });
    if (config.type) {
      var badge = el('span', { className: 'sf-resource-type-badge' }, config.type);
      if (config.typeStyle) {
        badge.style.background = config.typeStyle.bg || '';
        badge.style.color = config.typeStyle.color || '';
        badge.style.border = config.typeStyle.border || '';
      }
      meta.appendChild(badge);
    }
    var badges = Array.isArray(config.badges)
      ? config.badges
      : config.badges
        ? [config.badges]
        : [];
    if (badges.length) {
      badges.forEach(function (entry) {
        if (!entry) return;
        if (typeof entry === 'string') {
          meta.appendChild(el('span', { className: 'sf-resource-type-badge' }, entry));
          return;
        }
        var extraBadge = el('span', { className: 'sf-resource-type-badge' }, entry.label || '');
        if (entry.style) {
          extraBadge.style.background = entry.style.bg || '';
          extraBadge.style.color = entry.style.color || '';
          extraBadge.style.border = entry.style.border || '';
        }
        meta.appendChild(extraBadge);
      });
    }
    identity.appendChild(meta);
  }
  resHeader.appendChild(identity);

  // Gauges
  if (config.gauges && config.gauges.length > 0) {
    var gauges = el('div', { className: 'sf-gauges' });
    config.gauges.forEach(function (g) {
      var row = el('div', { className: 'sf-gauge-row' });
      row.appendChild(el('span', { className: 'sf-gauge-label' }, g.label));
      var track = el('div', { className: 'sf-gauge-track' });
      var fill = el('div', {
        className: 'sf-gauge-fill' + (g.style ? ' sf-gauge-fill--' + g.style : ''),
      });
      fill.style.width = Math.min(g.pct || 0, 100) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      if (g.text) row.appendChild(el('span', { className: 'sf-gauge-value' }, g.text));
      gauges.appendChild(row);
    });
    resHeader.appendChild(gauges);
  }

  card.appendChild(resHeader);

  // Body (stats + rail)
  var body = el('div', { className: 'sf-resource-body' });
  body.style.gridTemplateColumns = labelWidth + 'px 1fr';

  // Stats panel
  var stats = el('div', { className: 'sf-resource-stats' });
  if (config.stats) {
    config.stats.forEach(function (s) {
      var row = el('div', { className: 'sf-stat-row' });
      row.appendChild(el('span', { className: 'sf-stat-label' }, s.label));
      row.appendChild(el('span', { className: 'sf-stat-value' }, String(s.value)));
      stats.appendChild(row);
    });
  }
  body.appendChild(stats);

  // Rail
  var railContainer = el('div', { className: 'sf-rail-container' });
  var rail = el('div', { className: 'sf-rail' });
  if (config.id) rail.id = 'sf-rail-' + config.id;

  // Day grid
  var numCols = config.columns || 5;
  var dayGrid = el('div', { className: 'sf-day-grid' });
  dayGrid.style.gridTemplateColumns = 'repeat(' + numCols + ', 1fr)';
  for (var i = 0; i < numCols; i++) {
    dayGrid.appendChild(el('div', { className: 'sf-day-col' }));
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
      labelWidth: labelWidth,
    };
    heatmapCfg.railConfig = config;
    var heatmap = createHeatmap(heatmapCfg);
    if (heatmap) card.appendChild(heatmap);
  }

  // Optional unassigned list
  var unassignedRail = el('div', { className: 'sf-unassigned-rail' });
  if (config.unassigned) {
    state.unassigned = config.unassigned;
    renderUnassigned(unassignedRail, config.unassigned, config.onUnassignedClick);
  }
  if (unassignedRail.children.length > 0) card.appendChild(unassignedRail);

  // API
  var cardApi = { el: card, rail: rail };

  cardApi.addBlock = function (blockConfig) {
    return addBlock(rail, blockConfig);
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

export const createHeatmap = function (config) {
  if (!config || !config.segments || !Array.isArray(config.segments) || config.segments.length === 0) return null;

  var heatmap = el('div', { className: 'sf-heatmap' });
  heatmap.style.gridTemplateColumns = (config.labelWidth || 200) + 'px 1fr';
  var label = el('div', { className: 'sf-heatmap-label' }, config.label || '');
  heatmap.appendChild(label);

  var track = el('div', { className: 'sf-heatmap-track' });
  var columns = config.railConfig && config.railConfig.columns || 1;
  track.style.gridTemplateColumns = 'repeat(' + columns + ', 1fr)';
  heatmap.appendChild(track);

  var horizon = config.horizon || 1;
  config.segments.forEach(function (segment) {
    if (!segment || segment.end <= segment.start) return;
    var band = el('div', { className: 'sf-heatmap-segment' });
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

export const createUnassignedRail = function (tasks, onTaskClick) {
  var rail = el('div', { className: 'sf-unassigned-rail' });
  renderUnassigned(rail, tasks, onTaskClick);
  return rail;
};

export const addBlock = function (rail, config) {
  assert(rail, 'addBlock(rail) requires a rail element');
  assert(config && config.horizon != null, 'addBlock(config.horizon) is required');
  assert(config.start != null && config.end != null, 'addBlock(config.start/config.end) are required');

  var horizon = config.horizon || 1;
  var startPct = (config.start / horizon) * 100;
  var widthPct = ((config.end - config.start) / horizon) * 100;
  var minWidthPct = config.minWidthPct == null ? 0.5 : config.minWidthPct;

  var block = el('div', { className: 'sf-block' });
  block.style.left = startPct + '%';
  block.style.width = Math.max(widthPct, minWidthPct) + '%';

  if (config.color) {
    block.style.background = config.color;
    block.style.borderLeftColor = config.borderColor || config.color;
  }
  if (config.className) block.classList.add(config.className);
  if (config.late) block.classList.add('late');
  if (config.id) block.dataset.blockId = config.id;
  if (config.delay) block.style.animationDelay = config.delay;

  if (config.label) {
    block.appendChild(el('div', { className: 'sf-block-label' }, config.label));
  }
  if (config.meta) {
    block.appendChild(el('div', { className: 'sf-block-meta' }, config.meta));
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
    bindActivation(block, function (e) { config.onClick(e, config); });
  }

  rail.appendChild(block);
  return block;
};

export const addChangeover = function (rail, config) {
  assert(rail, 'addChangeover(rail) requires a rail element');
  assert(config && config.horizon != null, 'addChangeover(config.horizon) is required');
  assert(config.start != null && config.end != null, 'addChangeover(config.start/config.end) are required');

  var horizon = config.horizon || 1;
  var startPct = (config.start / horizon) * 100;
  var widthPct = ((config.end - config.start) / horizon) * 100;

  var co = el('div', { className: 'sf-changeover' });
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
    var pill = el('button', {
      className: 'sf-unassigned-pill',
      onClick: function () {
        if (onTaskClick) onTaskClick(item);
      },
    }, label);
    unassignedRail.appendChild(pill);
  });
}

// Export rail namespace for backwards compatibility with sf.rail.*
export const rail = {
  createHeader,
  createCard,
  createHeatmap,
  createUnassignedRail,
  addBlock,
  addChangeover,
};
