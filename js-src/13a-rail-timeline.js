/* ============================================================================
   SolverForge UI — Rail Timeline
   Canonical dense scheduling surface for resource-lane timelines.
   ============================================================================ */

(function (sf) {
  'use strict';

  var DAY_MINUTES = 24 * 60;
  var SIX_HOUR_MINUTES = 6 * 60;
  var WEEK_MINUTES = 7 * DAY_MINUTES;
  var TRACK_HEIGHT = 34;
  var TRACK_GAP = 8;
  var TRACK_PADDING = 12;
  var OVERVIEW_HEIGHT = 68;
  var OVERVIEW_BLOCK_HEIGHT = 34;
  var MIN_LABEL_WIDTH = 180;
  var MIN_VISIBLE_TRACK_WIDTH = 320;
  var MIN_CONTENT_TRACK_WIDTH = 480;
  var MIN_SUPPORTED_VIEWPORT_WIDTH = 500;

  var TONE_MAP = {
    emerald: {
      background: 'rgba(16, 185, 129, 0.22)',
      border: '#059669',
      text: '#064e3b',
      overlay: 'rgba(16, 185, 129, 0.10)',
    },
    blue: {
      background: 'rgba(59, 130, 246, 0.22)',
      border: '#2563eb',
      text: '#1e40af',
      overlay: 'rgba(59, 130, 246, 0.10)',
    },
    amber: {
      background: 'rgba(245, 158, 11, 0.24)',
      border: '#d97706',
      text: '#92400e',
      overlay: 'rgba(245, 158, 11, 0.10)',
    },
    rose: {
      background: 'rgba(244, 63, 94, 0.22)',
      border: '#e11d48',
      text: '#9f1239',
      overlay: 'rgba(244, 63, 94, 0.10)',
    },
    violet: {
      background: 'rgba(139, 92, 246, 0.22)',
      border: '#7c3aed',
      text: '#5b21b6',
      overlay: 'rgba(139, 92, 246, 0.10)',
    },
    cyan: {
      background: 'rgba(6, 182, 212, 0.22)',
      border: '#0891b2',
      text: '#155e75',
      overlay: 'rgba(6, 182, 212, 0.10)',
    },
    red: {
      background: 'rgba(239, 68, 68, 0.22)',
      border: '#dc2626',
      text: '#991b1b',
      overlay: 'rgba(239, 68, 68, 0.10)',
    },
    slate: {
      background: 'rgba(100, 116, 139, 0.20)',
      border: '#475569',
      text: '#1e293b',
      overlay: 'rgba(100, 116, 139, 0.08)',
    },
  };

  sf.rail = sf.rail || {};

  sf.rail.createTimeline = function (config) {
    sf.assert(config && config.model, 'rail.createTimeline(config.model) requires a normalized model');

    var labelWidth = config.labelWidth || 280;
    var state = {
      cleanup: [],
      config: config,
      destroyed: false,
      expandedClusters: {},
      labelWidth: labelWidth,
      model: normalizeModel(config.model),
      scrollSync: null,
      viewport: null,
      layout: null,
    };

    state.viewport = clampViewport(state.model.axis, state.model.axis.initialViewport);

    var root = sf.el('section', {
      className: 'sf-rail-timeline',
      dataset: {
        labelWidth: String(labelWidth),
      },
    });

    var toolbar = sf.el('div', { className: 'sf-rail-timeline-toolbar' });
    var toolbarCopy = sf.el('div', { className: 'sf-rail-timeline-toolbar-copy' });
    toolbarCopy.appendChild(sf.el('div', { className: 'sf-rail-timeline-toolbar-title' }, config.title || 'Scheduling timeline'));
    toolbarCopy.appendChild(sf.el('div', { className: 'sf-rail-timeline-toolbar-subtitle' }, config.subtitle || 'Sticky header, sticky lane labels, hidden scrollbar, drag-to-pan.'));
    toolbar.appendChild(toolbarCopy);

    var zoomControls = sf.el('div', { className: 'sf-rail-timeline-zoom-controls' });
    var zoomButtons = [];
    ['1w', '2w', '4w', 'reset'].forEach(function (preset) {
      var button = sf.el('button', {
        className: 'sf-rail-timeline-zoom-button',
        type: 'button',
        dataset: { zoom: preset },
      }, preset === 'reset' ? 'Reset' : preset.toUpperCase());
      button.addEventListener('click', function () {
        if (preset === 'reset') {
          api.setViewport(state.model.axis.initialViewport);
          return;
        }
        api.setViewport(buildPresetViewport(state.model.axis, state.viewport, preset));
      });
      zoomButtons.push(button);
      zoomControls.appendChild(button);
    });
    toolbar.appendChild(zoomControls);
    root.appendChild(toolbar);

    var shell = sf.el('div', { className: 'sf-rail-timeline-shell' });
    var headerViewport = sf.el('div', { className: 'sf-rail-timeline-header-viewport' });
    var bodyViewport = sf.el('div', { className: 'sf-rail-timeline-body-viewport' });
    var headerRow = sf.el('div', { className: 'sf-rail-timeline-header-row' });
    var lanes = sf.el('div', { className: 'sf-rail-timeline-lanes' });
    headerViewport.appendChild(headerRow);
    bodyViewport.appendChild(lanes);
    shell.appendChild(headerViewport);
    shell.appendChild(bodyViewport);
    root.appendChild(shell);

    var tooltip = sf.el('div', { className: 'sf-tooltip sf-rail-timeline-tooltip' });
    root.appendChild(tooltip);

    bindScrollSync(headerViewport, bodyViewport, state, root, zoomButtons);
    bindDragPan(headerViewport, bodyViewport, state, root, zoomButtons);
    bindDragPan(bodyViewport, headerViewport, state, root, zoomButtons);
    bindResizeObserver(bodyViewport, state, render, syncScrollToViewport);

    function render() {
      state.layout = measureLayout(bodyViewport, state);
      applyLayout(root, headerRow, lanes, state.layout);
      renderHeader();
      renderLanes();
      updateViewportMetadata(root, state);
      updateZoomButtons(zoomButtons, state);
    }

    function renderHeader() {
      headerRow.innerHTML = '';
      if (!state.layout) return;

      var corner = sf.el('div', { className: 'sf-rail-timeline-label-corner' }, config.label || 'Lane');
      headerRow.appendChild(corner);

      var axis = sf.el('div', { className: 'sf-rail-timeline-axis sf-rail-timeline-axis--header' });
      axis.style.height = '82px';
      renderAxisDecor(axis, state.model.axis, true);
      headerRow.appendChild(axis);
    }

    function renderLanes() {
      lanes.innerHTML = '';
      if (!state.layout) return;

      state.model.lanes.forEach(function (lane) {
        var laneRender = lane.mode === 'overview'
          ? buildOverviewRender(lane, state, function () {
            render();
            syncScrollToViewport();
          })
          : buildDetailedRender(lane, lane.items);

        var row = sf.el('div', {
          className: 'sf-rail-timeline-row sf-rail-timeline-row--' + lane.mode + (laneRender.expandedClusterId ? ' sf-rail-timeline-row--expanded' : ''),
          dataset: {
            laneId: lane.id,
            mode: lane.mode,
            trackCount: String(laneRender.trackCount),
          },
        });
        if (laneRender.expandedClusterId) {
          row.dataset.expandedClusterId = laneRender.expandedClusterId;
        }
        row.style.width = state.layout.contentWidth + 'px';

        var label = buildLaneLabel(lane, laneRender);
        row.appendChild(label);

        var track = sf.el('div', { className: 'sf-rail-timeline-track' });
        track.style.height = laneRender.height + 'px';
        renderAxisDecor(track, state.model.axis, false);
        renderOverlays(track, lane.overlays, state.model.axis);
        laneRender.blocks.forEach(function (blockConfig) {
          appendLaneBlock(track, lane, blockConfig, state.model.axis, tooltip, root);
        });
        row.appendChild(track);
        lanes.appendChild(row);
      });
    }

    function syncScrollToViewport() {
      if (!state.layout) return;
      var scrollLeft = viewportToScrollLeft(state, bodyViewport);
      state.scrollSync = bodyViewport;
      bodyViewport.scrollLeft = scrollLeft;
      headerViewport.scrollLeft = scrollLeft;
      state.scrollSync = null;
    }

    var api = {
      destroy: function () {
        if (state.destroyed) return;
        state.destroyed = true;
        state.cleanup.forEach(function (cleanup) {
          if (typeof cleanup === 'function') cleanup();
        });
        root.innerHTML = '';
      },
      el: root,
      expandCluster: function (laneId, clusterId) {
        if (clusterId == null) delete state.expandedClusters[laneId];
        else state.expandedClusters[laneId] = String(clusterId);
        render();
        syncScrollToViewport();
      },
      setModel: function (nextModel) {
        state.model = normalizeModel(nextModel);
        state.viewport = clampViewport(state.model.axis, state.viewport);
        pruneExpandedClusters(state);
        render();
        syncScrollToViewport();
      },
      setViewport: function (nextViewport) {
        state.viewport = clampViewport(state.model.axis, nextViewport);
        render();
        syncScrollToViewport();
      },
    };

    render();
    syncScrollToViewport();

    return api;
  };

  function appendLaneBlock(track, lane, blockConfig, axis, tooltip, root) {
    var tone = blockConfig.tone;
    var block = sf.rail.addBlock(track, {
      start: blockConfig.startMinute - axis.startMinute,
      end: blockConfig.endMinute - axis.startMinute,
      horizon: axis.endMinute - axis.startMinute,
      label: blockConfig.label,
      meta: blockConfig.metaLabel,
      color: tone.background,
      borderColor: tone.border,
      onClick: blockConfig.onClick,
      onHover: function (event) {
        showTooltip(tooltip, root, blockConfig.tooltip, event);
      },
      onLeave: function () {
        hideTooltip(tooltip);
      },
    });

    block.classList.add('sf-rail-timeline-item');
    block.classList.add(blockConfig.kindClass);
    block.style.top = blockConfig.top + 'px';
    block.style.height = blockConfig.height + 'px';
    block.style.bottom = 'auto';
    block.style.color = tone.text;
    block.dataset.itemId = blockConfig.itemId;
    block.dataset.laneId = lane.id;
    if (blockConfig.trackIndex != null) block.dataset.trackIndex = String(blockConfig.trackIndex);
    if (blockConfig.clusterId) block.dataset.clusterId = blockConfig.clusterId;
    if (blockConfig.countLabel) {
      block.appendChild(sf.el('span', { className: 'sf-rail-timeline-cluster-count' }, blockConfig.countLabel));
    }
    if (blockConfig.detailHint) {
      block.appendChild(sf.el('span', { className: 'sf-rail-timeline-detail-hint' }, blockConfig.detailHint));
    }
    block.title = blockConfig.tooltip.title;
    block.addEventListener('mousemove', function (event) {
      showTooltip(tooltip, root, blockConfig.tooltip, event);
    });
  }

  function bindScrollSync(source, target, state, root, zoomButtons) {
    source.addEventListener('scroll', function () {
      handleScroll(source, target, state, root, zoomButtons);
    });
    target.addEventListener('scroll', function () {
      handleScroll(target, source, state, root, zoomButtons);
    });
  }

  function bindDragPan(source, target, state, root, zoomButtons) {
    var drag = {
      active: false,
      startClientX: 0,
      startScrollLeft: 0,
    };

    source.addEventListener('mousedown', function (event) {
      if (event.button != null && event.button !== 0) return;
      drag.active = true;
      drag.startClientX = event.clientX != null ? event.clientX : 0;
      drag.startScrollLeft = source.scrollLeft || 0;
      source.classList.add('is-dragging');
      if (event.preventDefault) event.preventDefault();
    });

    source.addEventListener('mousemove', function (event) {
      if (!drag.active) return;
      var clientX = event.clientX != null ? event.clientX : drag.startClientX;
      var delta = clientX - drag.startClientX;
      source.scrollLeft = clampNumber(drag.startScrollLeft - delta, 0, getMaxScrollLeft(source));
      handleScroll(source, target, state, root, zoomButtons);
      if (event.preventDefault) event.preventDefault();
    });

    function finishDrag() {
      if (!drag.active) return;
      drag.active = false;
      source.classList.remove('is-dragging');
    }

    source.addEventListener('mouseup', finishDrag);
    source.addEventListener('mouseleave', finishDrag);
  }

  function handleScroll(source, target, state, root, zoomButtons) {
    if (state.destroyed) return;
    if (!state.layout) return;
    if (state.scrollSync === source) return;

    state.scrollSync = source;
    target.scrollLeft = source.scrollLeft;
    state.viewport = scrollLeftToViewport(state, source);
    updateViewportMetadata(root, state);
    updateZoomButtons(zoomButtons, state);
    state.scrollSync = null;
  }

  function buildDetailedRender(lane, items) {
    var packed = packItems(items);
    var height = packed.trackCount > 0
      ? TRACK_PADDING * 2 + packed.trackCount * TRACK_HEIGHT + Math.max(0, packed.trackCount - 1) * TRACK_GAP
      : OVERVIEW_HEIGHT;

    var blocks = packed.items.map(function (entry) {
      return {
        endMinute: entry.item.endMinute,
        height: TRACK_HEIGHT,
        itemId: entry.item.id,
        kindClass: 'sf-rail-timeline-item--detail',
        label: entry.item.label,
        metaLabel: describeMeta(entry.item.meta),
        startMinute: entry.item.startMinute,
        top: TRACK_PADDING + entry.trackIndex * (TRACK_HEIGHT + TRACK_GAP),
        tooltip: buildItemTooltip(entry.item, lane),
        tone: entry.item.tone,
        trackIndex: entry.trackIndex,
      };
    });

    return {
      blocks: blocks,
      height: height,
      trackCount: packed.trackCount || 1,
    };
  }

  function buildOverviewRender(lane, state, rerender) {
    var groups = groupOverviewItems(lane);
    var expandedClusterId = state.expandedClusters[lane.id] || null;
    var expandedGroup = null;
    var packedExpanded = null;

    groups.forEach(function (group) {
      if (expandedClusterId && group.id === expandedClusterId && group.isCluster) {
        expandedGroup = group;
      }
    });

    if (expandedGroup) {
      packedExpanded = packItems(expandedGroup.detailItems);
    }

    var height = OVERVIEW_HEIGHT;
    if (packedExpanded && packedExpanded.trackCount > 0) {
      height = Math.max(
        OVERVIEW_HEIGHT,
        TRACK_PADDING * 2 + packedExpanded.trackCount * TRACK_HEIGHT + Math.max(0, packedExpanded.trackCount - 1) * TRACK_GAP
      );
    }

    var blocks = [];
    groups.forEach(function (group) {
      if (expandedGroup && group.id === expandedGroup.id) {
        packedExpanded.items.forEach(function (entry) {
          blocks.push({
            clusterId: group.id,
            detailHint: 'Expanded',
            endMinute: entry.item.endMinute,
            height: TRACK_HEIGHT,
            itemId: entry.item.id,
            kindClass: 'sf-rail-timeline-item--detail',
            label: entry.item.label,
            metaLabel: describeMeta(entry.item.meta),
            startMinute: entry.item.startMinute,
            top: TRACK_PADDING + entry.trackIndex * (TRACK_HEIGHT + TRACK_GAP),
            tooltip: buildItemTooltip(entry.item, lane),
            tone: entry.item.tone,
            trackIndex: entry.trackIndex,
          });
        });
        return;
      }

      if (group.isCluster) {
        blocks.push({
          clusterId: group.id,
          countLabel: String(group.count),
          endMinute: group.endMinute,
          height: OVERVIEW_BLOCK_HEIGHT,
          itemId: group.id,
          kindClass: 'sf-rail-timeline-item--cluster',
          label: group.label,
          metaLabel: group.metaLabel,
          onClick: function () {
            state.expandedClusters[lane.id] = state.expandedClusters[lane.id] === group.id ? null : group.id;
            if (!state.expandedClusters[lane.id]) delete state.expandedClusters[lane.id];
            if (state.config && state.config.onClusterToggle) {
              state.config.onClusterToggle(lane.id, state.expandedClusters[lane.id] || null);
            }
            if (typeof rerender === 'function') rerender();
          },
          startMinute: group.startMinute,
          top: Math.max(Math.round((height - OVERVIEW_BLOCK_HEIGHT) / 2), TRACK_PADDING),
          tooltip: buildClusterTooltip(group, lane),
          tone: group.tone,
        });
        return;
      }

      blocks.push({
        endMinute: group.endMinute,
        height: OVERVIEW_BLOCK_HEIGHT,
        itemId: group.items[0].id,
        kindClass: 'sf-rail-timeline-item--overview',
        label: group.items[0].label,
        metaLabel: describeMeta(group.items[0].meta),
        startMinute: group.startMinute,
        top: Math.max(Math.round((height - OVERVIEW_BLOCK_HEIGHT) / 2), TRACK_PADDING),
        tooltip: buildItemTooltip(group.items[0], lane),
        tone: group.tone,
      });
    });

    return {
      blocks: blocks,
      expandedClusterId: expandedGroup ? expandedGroup.id : null,
      height: height,
      trackCount: packedExpanded ? Math.max(packedExpanded.trackCount, 1) : 1,
    };
  }

  function buildLaneLabel(lane, laneRender) {
    var label = sf.el('div', {
      className: 'sf-rail-timeline-lane-label',
      dataset: { laneId: lane.id },
    });
    label.style.minHeight = laneRender.height + 'px';

    var heading = sf.el('div', { className: 'sf-rail-timeline-lane-heading' });
    heading.appendChild(sf.el('div', { className: 'sf-rail-timeline-lane-title' }, lane.label));
    if (lane.mode) {
      heading.appendChild(sf.el('div', { className: 'sf-rail-timeline-lane-mode' }, lane.mode));
    }
    label.appendChild(heading);

    if (lane.badges.length > 0) {
      var badges = sf.el('div', { className: 'sf-rail-timeline-lane-badges' });
      lane.badges.forEach(function (badge) {
        var badgeEl = sf.el('span', { className: 'sf-rail-timeline-lane-badge' }, badge.label);
        if (badge.style) {
          badgeEl.style.background = badge.style.bg || '';
          badgeEl.style.border = badge.style.border || '';
          badgeEl.style.color = badge.style.color || '';
        }
        badges.appendChild(badgeEl);
      });
      label.appendChild(badges);
    }

    if (lane.stats.length > 0) {
      var stats = sf.el('div', { className: 'sf-rail-timeline-lane-stats' });
      lane.stats.forEach(function (stat) {
        var statRow = sf.el('div', { className: 'sf-rail-timeline-lane-stat' });
        statRow.appendChild(sf.el('span', { className: 'sf-rail-timeline-lane-stat-label' }, stat.label));
        statRow.appendChild(sf.el('span', { className: 'sf-rail-timeline-lane-stat-value' }, String(stat.value)));
        stats.appendChild(statRow);
      });
      label.appendChild(stats);
    }

    return label;
  }

  function buildClusterTooltip(group, lane) {
    var first = group.detailItems[0] || group.items[0];
    var payload = {
      rows: [
        { key: 'Lane', value: lane.label },
        { key: 'Window', value: formatMinuteRange(group.startMinute, group.endMinute, lane.axis) },
        { key: 'Items', value: String(group.count) },
      ],
      title: group.label,
    };

    if (first && first.meta) {
      payload.rows.push({ key: 'Sample', value: describeMeta(first.meta) });
    }

    return payload;
  }

  function buildItemTooltip(item, lane) {
    var rows = [
      { key: 'Lane', value: lane.label },
      { key: 'Time', value: formatMinuteRange(item.startMinute, item.endMinute, lane.axis) },
    ];

    appendMetaRows(rows, item.meta);

    return {
      rows: rows,
      title: item.label,
    };
  }

  function buildOverviewBlockLabel(group) {
    if (group.count === 1) return group.items[0].label;
    return group.count + ' assignments';
  }

  function buildOverviewBlockMeta(group) {
    var labels = [];
    group.items.slice(0, 2).forEach(function (item) {
      labels.push(item.label);
    });
    if (group.count > 2) labels.push('+' + (group.count - 2) + ' more');
    return labels.join(' • ');
  }

  function buildPresetViewport(axis, currentViewport, preset) {
    var duration = preset === '1w' ? WEEK_MINUTES : preset === '2w' ? WEEK_MINUTES * 2 : WEEK_MINUTES * 4;
    var visibleDuration = clampNumber(duration, DAY_MINUTES, axis.endMinute - axis.startMinute);
    var center = currentViewport.startMinute + (currentViewport.endMinute - currentViewport.startMinute) / 2;
    var start = center - visibleDuration / 2;
    return clampViewport(axis, {
      startMinute: start,
      endMinute: start + visibleDuration,
    });
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clampViewport(axis, viewport) {
    var totalDuration = axis.endMinute - axis.startMinute;
    var next = viewport || axis.initialViewport || {
      startMinute: axis.startMinute,
      endMinute: axis.endMinute,
    };
    var duration = next.endMinute - next.startMinute;
    if (!(duration > 0)) duration = totalDuration;
    duration = Math.min(duration, totalDuration);

    var start = next.startMinute;
    if (start == null || !isFinite(start)) start = axis.startMinute;
    start = clampNumber(start, axis.startMinute, axis.endMinute - duration);

    return {
      endMinute: start + duration,
      startMinute: start,
    };
  }

  function describeMeta(meta) {
    if (meta == null) return '';
    if (typeof meta === 'string') return meta;
    if (typeof meta === 'number') return String(meta);
    if (Array.isArray(meta)) {
      return meta.map(function (entry) {
        if (entry && entry.label && entry.value != null) return entry.label + ': ' + entry.value;
        return String(entry || '');
      }).filter(Boolean).join(' • ');
    }
    if (typeof meta === 'object') {
      return Object.keys(meta).map(function (key) {
        return key + ': ' + meta[key];
      }).join(' • ');
    }
    return String(meta);
  }

  function appendMetaRows(rows, meta) {
    if (meta == null) return;
    if (typeof meta === 'string' || typeof meta === 'number') {
      rows.push({ key: 'Meta', value: String(meta) });
      return;
    }
    if (Array.isArray(meta)) {
      meta.forEach(function (entry, index) {
        if (!entry) return;
        if (entry.label && entry.value != null) {
          rows.push({ key: entry.label, value: String(entry.value) });
          return;
        }
        rows.push({ key: 'Meta ' + (index + 1), value: String(entry) });
      });
      return;
    }
    if (typeof meta === 'object') {
      Object.keys(meta).forEach(function (key) {
        rows.push({ key: key, value: String(meta[key]) });
      });
    }
  }

  function normalizeAxis(axis) {
    sf.assert(axis && axis.startMinute != null && axis.endMinute != null, 'createTimeline(model.axis.startMinute/endMinute) are required');
    sf.assert(axis.endMinute > axis.startMinute, 'createTimeline(model.axis.endMinute) must be greater than startMinute');

    var normalized = {
      endMinute: Number(axis.endMinute),
      startMinute: Number(axis.startMinute),
    };

    normalized.days = normalizeDays(axis.days, normalized.startMinute, normalized.endMinute);
    normalized.ticks = normalizeTicks(axis.ticks, normalized.startMinute, normalized.endMinute);
    normalized.initialViewport = clampViewport(normalized, axis.initialViewport || {
      startMinute: normalized.startMinute,
      endMinute: normalized.endMinute,
    });

    return normalized;
  }

  function normalizeBadge(badge) {
    if (!badge) return null;
    if (typeof badge === 'string') return { label: badge };
    return {
      label: badge.label || '',
      style: badge.style || null,
    };
  }

  function normalizeDays(days, startMinute, endMinute) {
    var list = [];
    var source = Array.isArray(days) && days.length > 0 ? days : null;
    var cursor = startMinute;
    var index = 0;

    if (!source) {
      while (cursor < endMinute) {
        list.push(makeDay({
          endMinute: Math.min(cursor + DAY_MINUTES, endMinute),
          isWeekend: false,
          label: 'Day ' + (index + 1),
          startMinute: cursor,
        }, index));
        cursor += DAY_MINUTES;
        index += 1;
      }
      return list;
    }

    source.forEach(function (day, dayIndex) {
      if (cursor >= endMinute) return;
      if (typeof day === 'string') {
        var generatedEnd = Math.min(cursor + DAY_MINUTES, endMinute);
        list.push(makeDay({
          endMinute: generatedEnd,
          isWeekend: inferWeekend(day),
          label: day,
          startMinute: cursor,
        }, dayIndex));
        cursor = generatedEnd;
        return;
      }

      var nextStart = day.startMinute != null ? Number(day.startMinute) : cursor;
      var nextEnd = day.endMinute != null ? Number(day.endMinute) : Math.min(nextStart + DAY_MINUTES, endMinute);
      list.push(makeDay({
        endMinute: nextEnd,
        isWeekend: day.isWeekend != null ? !!day.isWeekend : inferWeekend(day.label),
        label: day.label || 'Day ' + (dayIndex + 1),
        startMinute: nextStart,
        subLabel: day.subLabel || day.meta || '',
      }, dayIndex));
      cursor = nextEnd;
    });

    return list;
  }

  function normalizeItem(item, index) {
    sf.assert(item && item.startMinute != null && item.endMinute != null, 'timeline items require startMinute/endMinute');
    sf.assert(item.endMinute > item.startMinute, 'timeline items must have endMinute > startMinute');

    return {
      clusterId: item.clusterId != null ? String(item.clusterId) : null,
      detailItems: Array.isArray(item.detailItems)
        ? item.detailItems.map(function (detailItem, detailIndex) {
          return normalizeItem(detailItem, index + '-' + detailIndex);
        })
        : [],
      endMinute: Number(item.endMinute),
      id: item.id != null ? String(item.id) : 'item-' + index,
      label: item.label || 'Item ' + (Number(index) + 1),
      meta: item.meta != null ? item.meta : '',
      originalIndex: Number(index),
      startMinute: Number(item.startMinute),
      tone: resolveTone(item.tone || item.color || 'slate'),
    };
  }

  function normalizeLane(lane, index, axis) {
    sf.assert(lane && Array.isArray(lane.items), 'timeline lanes require an items array');

    var normalizedLane = {
      axis: axis,
      badges: [],
      id: lane.id != null ? String(lane.id) : 'lane-' + index,
      items: lane.items.map(function (item, itemIndex) {
        return normalizeItem(item, index + '-' + itemIndex);
      }),
      label: lane.label || 'Lane ' + (index + 1),
      mode: lane.mode === 'overview' ? 'overview' : 'detailed',
      overlays: Array.isArray(lane.overlays)
        ? lane.overlays.map(function (overlay, overlayIndex) {
          return normalizeOverlay(overlay, overlayIndex, axis);
        }).filter(Boolean)
        : [],
      stats: Array.isArray(lane.stats) ? lane.stats : [],
    };

    normalizedLane.items.sort(compareItems);

    if (Array.isArray(lane.badges)) {
      lane.badges.forEach(function (badge) {
        var normalizedBadge = normalizeBadge(badge);
        if (normalizedBadge) normalizedLane.badges.push(normalizedBadge);
      });
    } else {
      var singleBadge = normalizeBadge(lane.badges);
      if (singleBadge) normalizedLane.badges.push(singleBadge);
    }

    return normalizedLane;
  }

  function normalizeModel(model) {
    sf.assert(model && model.axis && Array.isArray(model.lanes), 'createTimeline(model.axis/model.lanes) are required');
    var axis = normalizeAxis(model.axis);

    return {
      axis: axis,
      lanes: model.lanes.map(function (lane, index) {
        return normalizeLane(lane, index, axis);
      }),
    };
  }

  function normalizeOverlay(overlay, index, axis) {
    if (!overlay) return null;

    var startMinute = overlay.startMinute;
    var endMinute = overlay.endMinute;

    if ((startMinute == null || endMinute == null) && overlay.dayIndex != null) {
      var day = axis.days[overlay.dayIndex];
      if (!day) return null;
      var dayCount = overlay.dayCount || 1;
      var lastDay = axis.days[Math.min(axis.days.length - 1, overlay.dayIndex + dayCount - 1)] || day;
      startMinute = day.startMinute;
      endMinute = lastDay.endMinute;
    }

    if (startMinute == null || endMinute == null || endMinute <= startMinute) return null;

    return {
      endMinute: Number(endMinute),
      id: overlay.id != null ? String(overlay.id) : 'overlay-' + index,
      label: overlay.label || '',
      meta: overlay.meta || '',
      startMinute: Number(startMinute),
      tone: resolveTone(overlay.tone || overlay.color || 'slate'),
    };
  }

  function normalizeTicks(ticks, startMinute, endMinute) {
    var list = [];

    if (Array.isArray(ticks) && ticks.length > 0) {
      ticks.forEach(function (tick, index) {
        if (typeof tick === 'number') {
          list.push({ id: 'tick-' + index, label: formatClock(tick), minute: tick });
          return;
        }
        if (!tick || tick.minute == null) return;
        list.push({
          id: tick.id != null ? String(tick.id) : 'tick-' + index,
          label: tick.label || formatClock(tick.minute),
          minute: Number(tick.minute),
        });
      });
      return list;
    }

    for (var minute = startMinute; minute < endMinute; minute += SIX_HOUR_MINUTES) {
      list.push({
        id: 'tick-' + minute,
        label: formatClock(minute),
        minute: minute,
      });
    }

    return list;
  }

  function makeDay(day, index) {
    return {
      endMinute: day.endMinute,
      id: day.id != null ? String(day.id) : 'day-' + index,
      isWeekend: !!day.isWeekend,
      label: day.label || 'Day ' + (index + 1),
      startMinute: day.startMinute,
      subLabel: day.subLabel || '',
    };
  }

  function compareItems(left, right) {
    if (left.startMinute !== right.startMinute) return left.startMinute - right.startMinute;
    if (left.endMinute !== right.endMinute) return left.endMinute - right.endMinute;
    if (left.label !== right.label) return left.label < right.label ? -1 : 1;
    return left.originalIndex - right.originalIndex;
  }

  function renderAxisDecor(track, axis, includeLabels) {
    appendWeekendBands(track, axis);
    appendDayDividers(track, axis);
    appendTicks(track, axis, includeLabels);
    if (includeLabels) appendDayBands(track, axis);
  }

  function appendDayBands(track, axis) {
    axis.days.forEach(function (day) {
      var band = sf.el('div', { className: 'sf-rail-timeline-day-band' });
      band.style.left = positionPct(day.startMinute, axis) + '%';
      band.style.width = spanPct(day.startMinute, day.endMinute, axis) + '%';
      band.appendChild(sf.el('div', { className: 'sf-rail-timeline-day-label' }, day.label));
      if (day.subLabel) {
        band.appendChild(sf.el('div', { className: 'sf-rail-timeline-day-sub' }, day.subLabel));
      }
      track.appendChild(band);
    });
  }

  function appendDayDividers(track, axis) {
    axis.days.forEach(function (day, index) {
      if (index === 0) return;
      var divider = sf.el('div', { className: 'sf-rail-timeline-day-divider' });
      divider.style.left = positionPct(day.startMinute, axis) + '%';
      track.appendChild(divider);
    });
  }

  function appendTicks(track, axis, includeLabels) {
    axis.ticks.forEach(function (tick) {
      if (tick.minute < axis.startMinute || tick.minute >= axis.endMinute) return;
      var tickEl = sf.el('div', { className: 'sf-rail-timeline-tick' });
      tickEl.style.left = positionPct(tick.minute, axis) + '%';
      track.appendChild(tickEl);

      if (!includeLabels) return;
      var label = sf.el('div', { className: 'sf-rail-timeline-tick-label' }, tick.label);
      label.style.left = positionPct(tick.minute, axis) + '%';
      track.appendChild(label);
    });
  }

  function appendWeekendBands(track, axis) {
    axis.days.forEach(function (day) {
      if (!day.isWeekend) return;
      var band = sf.el('div', { className: 'sf-rail-timeline-weekend-band' });
      band.style.left = positionPct(day.startMinute, axis) + '%';
      band.style.width = spanPct(day.startMinute, day.endMinute, axis) + '%';
      track.appendChild(band);
    });
  }

  function renderOverlays(track, overlays, axis) {
    overlays.forEach(function (overlay) {
      var band = sf.el('div', { className: 'sf-rail-timeline-overlay' });
      band.style.left = positionPct(overlay.startMinute, axis) + '%';
      band.style.width = spanPct(overlay.startMinute, overlay.endMinute, axis) + '%';
      band.style.background = overlay.tone.overlay;
      band.style.borderColor = overlay.tone.border;
      if (overlay.label) band.title = overlay.label;
      track.appendChild(band);
    });
  }

  function groupOverviewItems(lane) {
    var groups = [];
    var current = null;

    lane.items.forEach(function (item) {
      if (!current || item.startMinute >= current.endMinute) {
        if (current) groups.push(current);
        current = {
          clusterId: item.clusterId,
          endMinute: item.endMinute,
          items: [item],
          lane: lane,
          startMinute: item.startMinute,
        };
        return;
      }
      current.items.push(item);
      current.endMinute = Math.max(current.endMinute, item.endMinute);
      if (!current.clusterId && item.clusterId) current.clusterId = item.clusterId;
    });
    if (current) groups.push(current);

    groups.forEach(function (group, groupIndex) {
      finalizeGroup(group, lane, groupIndex);
    });

    return groups;
  }

  function finalizeGroup(group, lane, index) {
    var detailItems = [];

    group.items.forEach(function (item) {
      if (item.detailItems.length > 0) {
        item.detailItems.forEach(function (detailItem) {
          detailItems.push(detailItem);
        });
        return;
      }
      detailItems.push(item);
    });

    detailItems.sort(compareItems);
    group.detailItems = detailItems;
    group.count = detailItems.length;
    group.isCluster = group.count > 1 || group.items.some(function (item) {
      return item.detailItems.length > 0;
    });
    group.id = group.clusterId || (group.isCluster
      ? 'cluster:' + lane.id + ':' + (group.items[0] ? group.items[0].id : index)
      : (group.items[0] ? group.items[0].id : 'group-' + index));
    group.label = group.isCluster ? buildOverviewBlockLabel(group) : group.items[0].label;
    group.metaLabel = group.isCluster ? buildOverviewBlockMeta(group) : describeMeta(group.items[0].meta);
    group.tone = dominantTone(group.detailItems);
  }

  function dominantTone(items) {
    if (!items.length) return resolveTone('slate');
    return items[0].tone;
  }

  function packItems(items) {
    var trackEnds = [];
    var packed = [];

    items.slice().sort(compareItems).forEach(function (item) {
      var trackIndex = 0;
      while (trackIndex < trackEnds.length && item.startMinute < trackEnds[trackIndex]) {
        trackIndex += 1;
      }
      if (trackIndex === trackEnds.length) trackEnds.push(item.endMinute);
      else trackEnds[trackIndex] = item.endMinute;
      packed.push({
        item: item,
        trackIndex: trackIndex,
      });
    });

    return {
      items: packed,
      trackCount: trackEnds.length,
    };
  }

  function positionPct(minute, axis) {
    var total = axis.endMinute - axis.startMinute;
    if (total <= 0) return 0;
    return ((minute - axis.startMinute) / total) * 100;
  }

  function spanPct(startMinute, endMinute, axis) {
    var total = axis.endMinute - axis.startMinute;
    if (total <= 0) return 0;
    return Math.max(((endMinute - startMinute) / total) * 100, 0.25);
  }

  function formatClock(minute) {
    var normalized = minute % DAY_MINUTES;
    if (normalized < 0) normalized += DAY_MINUTES;
    var hours = Math.floor(normalized / 60);
    var minutes = normalized % 60;
    return pad(hours) + ':' + pad(minutes);
  }

  function formatMinuteRange(startMinute, endMinute, axis) {
    return formatMinute(startMinute, axis) + ' → ' + formatMinute(endMinute, axis);
  }

  function formatMinute(minute, axis) {
    var dayLabel = '';
    axis.days.forEach(function (day) {
      if (minute >= day.startMinute && minute < day.endMinute && !dayLabel) {
        dayLabel = day.label;
      }
    });
    return (dayLabel ? dayLabel + ' ' : '') + formatClock(minute);
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function inferWeekend(label) {
    return /sat|sun|weekend/i.test(String(label || ''));
  }

  function isColorString(value) {
    return /^#|^rgb|^hsl/i.test(String(value || ''));
  }

  function resolveTone(tone) {
    if (tone && typeof tone === 'object') {
      return {
        background: tone.background || tone.bg || tone.color || TONE_MAP.slate.background,
        border: tone.border || tone.borderColor || tone.color || TONE_MAP.slate.border,
        overlay: tone.overlay || tone.band || tone.background || tone.bg || TONE_MAP.slate.overlay,
        text: tone.text || tone.textColor || tone.foreground || TONE_MAP.slate.text,
      };
    }
    if (TONE_MAP[tone]) return TONE_MAP[tone];
    if (isColorString(tone)) {
      return {
        background: tone,
        border: tone,
        overlay: tone,
        text: '#111827',
      };
    }
    return TONE_MAP.slate;
  }

  function measureLayout(bodyViewport, state) {
    var viewportWidth = getMeasuredViewportWidth(bodyViewport);
    if (!(viewportWidth > 0)) return null;

    var preferredLabelWidth = state.labelWidth;
    var maxLabelWidth = viewportWidth - MIN_VISIBLE_TRACK_WIDTH;
    var effectiveLabelWidth = preferredLabelWidth;
    var visibleDuration = state.viewport.endMinute - state.viewport.startMinute;
    var totalDuration = state.model.axis.endMinute - state.model.axis.startMinute;
    var scale = totalDuration > 0 && visibleDuration > 0
      ? totalDuration / visibleDuration
      : 1;
    if (effectiveLabelWidth < MIN_LABEL_WIDTH) effectiveLabelWidth = MIN_LABEL_WIDTH;
    if (maxLabelWidth >= MIN_LABEL_WIDTH) effectiveLabelWidth = Math.min(effectiveLabelWidth, maxLabelWidth);
    else effectiveLabelWidth = MIN_LABEL_WIDTH;

    var visibleTrackWidth = Math.max(viewportWidth - effectiveLabelWidth, 0);
    var contentTrackWidth = Math.max(
      Math.round(visibleTrackWidth * scale),
      visibleTrackWidth,
      MIN_CONTENT_TRACK_WIDTH
    );
    var contentWidth = effectiveLabelWidth + contentTrackWidth;

    return {
      contentWidth: contentWidth,
      contentTrackWidth: contentTrackWidth,
      effectiveLabelWidth: effectiveLabelWidth,
      visibleTrackWidth: visibleTrackWidth,
      viewportWidth: viewportWidth,
    };
  }

  function viewportToScrollLeft(state, viewportEl) {
    var axis = state.model.axis;
    var totalDuration = axis.endMinute - axis.startMinute;
    var visibleDuration = state.viewport.endMinute - state.viewport.startMinute;
    var remainingDuration = Math.max(totalDuration - visibleDuration, 0);
    var maxScrollLeft = getMaxScrollLeft(viewportEl);
    if (remainingDuration <= 0 || maxScrollLeft <= 0) return 0;
    return Math.round(((state.viewport.startMinute - axis.startMinute) / remainingDuration) * maxScrollLeft);
  }

  function scrollLeftToViewport(state, viewportEl) {
    var axis = state.model.axis;
    var totalDuration = axis.endMinute - axis.startMinute;
    var visibleDuration = state.viewport.endMinute - state.viewport.startMinute;
    var remainingDuration = Math.max(totalDuration - visibleDuration, 0);
    var maxScrollLeft = getMaxScrollLeft(viewportEl);
    if (remainingDuration <= 0 || maxScrollLeft <= 0) {
      return clampViewport(axis, {
        startMinute: axis.startMinute,
        endMinute: axis.startMinute + visibleDuration,
      });
    }
    var ratio = clampNumber((viewportEl.scrollLeft || 0) / maxScrollLeft, 0, 1);
    var startMinute = axis.startMinute + remainingDuration * ratio;
    return clampViewport(axis, {
      startMinute: startMinute,
      endMinute: startMinute + visibleDuration,
    });
  }

  function getMaxScrollLeft(viewportEl) {
    var scrollWidth = viewportEl.scrollWidth || 0;
    var clientWidth = viewportEl.clientWidth || viewportEl.offsetWidth || 0;
    return Math.max(scrollWidth - clientWidth, 0);
  }

  function bindResizeObserver(bodyViewport, state, render, syncScrollToViewport) {
    if (typeof ResizeObserver !== 'function') return;

    var resizeObserver = new ResizeObserver(function () {
      if (state.destroyed) return;
      render();
      syncScrollToViewport();
    });
    resizeObserver.observe(bodyViewport);
    state.cleanup.push(function () {
      resizeObserver.disconnect();
    });
  }

  function getMeasuredViewportWidth(bodyViewport) {
    if (!bodyViewport) return 0;
    if (typeof bodyViewport.clientWidth === 'number' && bodyViewport.clientWidth > 0) {
      return Math.round(bodyViewport.clientWidth);
    }
    if (typeof bodyViewport.offsetWidth === 'number' && bodyViewport.offsetWidth > 0) {
      return Math.round(bodyViewport.offsetWidth);
    }
    if (typeof bodyViewport.getBoundingClientRect === 'function') {
      var rect = bodyViewport.getBoundingClientRect();
      if (rect && typeof rect.width === 'number' && rect.width > 0) {
        return Math.round(rect.width);
      }
    }
    return 0;
  }

  function applyLayout(root, headerRow, lanes, layout) {
    setCustomProperty(root.style, '--sf-rail-label-width', layout ? layout.effectiveLabelWidth + 'px' : '');
    setCustomProperty(root.style, '--sf-rail-content-width', layout ? layout.contentWidth + 'px' : '');
    headerRow.style.width = layout ? layout.contentWidth + 'px' : '';
    lanes.style.width = layout ? layout.contentWidth + 'px' : '';
    root.dataset.supportedViewportWidth = layout
      ? String(layout.viewportWidth >= MIN_SUPPORTED_VIEWPORT_WIDTH)
      : '';
  }

  function setCustomProperty(style, name, value) {
    if (!style) return;
    if (typeof style.setProperty === 'function') {
      style.setProperty(name, value);
      return;
    }
    style[name] = value;
  }

  function showTooltip(tooltip, root, payload, event) {
    if (!payload) return;
    tooltip.innerHTML = '';
    tooltip.appendChild(sf.el('div', { className: 'sf-tooltip-title' }, payload.title));
    (payload.rows || []).forEach(function (row) {
      var rowEl = sf.el('div', { className: 'sf-tooltip-row' });
      rowEl.appendChild(sf.el('span', { className: 'sf-tooltip-key' }, row.key));
      rowEl.appendChild(sf.el('span', { className: 'sf-tooltip-val' }, row.value));
      tooltip.appendChild(rowEl);
    });

    var hostRect = root.getBoundingClientRect ? root.getBoundingClientRect() : { left: 0, top: 0 };
    var left = event && event.clientX != null ? event.clientX + 16 : hostRect.left + 16;
    var top = event && event.clientY != null ? event.clientY + 16 : hostRect.top + 16;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
  }

  function hideTooltip(tooltip) {
    tooltip.classList.remove('visible');
  }

  function updateViewportMetadata(root, state) {
    var axis = state.model.axis;
    var duration = state.viewport.endMinute - state.viewport.startMinute;
    root.dataset.timelineSpanMinutes = String(axis.endMinute - axis.startMinute);
    root.dataset.viewportDurationMinutes = String(Math.round(duration));
    root.dataset.viewportStartMinute = String(Math.round(state.viewport.startMinute));
    root.dataset.viewportEndMinute = String(Math.round(state.viewport.endMinute));
  }

  function updateZoomButtons(buttons, state) {
    var duration = Math.round(state.viewport.endMinute - state.viewport.startMinute);
    var initial = state.model.axis.initialViewport;
    buttons.forEach(function (button) {
      var preset = button.dataset.zoom;
      var active = false;
      if (preset === 'reset') {
        active = Math.round(initial.startMinute) === Math.round(state.viewport.startMinute)
          && Math.round(initial.endMinute) === Math.round(state.viewport.endMinute);
      } else if (preset === '1w') active = duration === WEEK_MINUTES;
      else if (preset === '2w') active = duration === WEEK_MINUTES * 2;
      else if (preset === '4w') active = duration === WEEK_MINUTES * 4;
      button.classList.toggle('active', active);
    });
  }

  function pruneExpandedClusters(state) {
    Object.keys(state.expandedClusters).forEach(function (laneId) {
      var exists = state.model.lanes.some(function (lane) {
        return lane.id === laneId;
      });
      if (!exists) delete state.expandedClusters[laneId];
    });
  }

})(SF);
