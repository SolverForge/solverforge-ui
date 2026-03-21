/* ============================================================================
   SolverForge UI — Gantt (Frappe Gantt + Split.js wrapper)
   Requires: Frappe Gantt (Gantt) and Split (Split) loaded globally.
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.gantt = {};

  sf.gantt.create = function (config) {
    config = config || {};
    var instanceId = sf.uid('sf-gantt');
    var chartPaneId = config.chartPane || (instanceId + '-chart-pane');
    var gridPaneId = config.gridPane || (instanceId + '-grid-pane');
    var chartContainerId = config.chartContainer || (instanceId + '-container');
    var svgId = config.svgId || (instanceId + '-svg');
    var ganttChart = null;
    var splitInstance = null;
    var tasks = [];

    // ── Build DOM ──
    var wrapper = sf.el('div', { className: 'sf-gantt-split' });

    // Grid pane
    var gridPane = sf.el('div', { className: 'sf-gantt-pane', id: gridPaneId });
    var gridHeader = sf.el('div', { className: 'sf-gantt-pane-header' });
    gridHeader.appendChild(sf.el('h3', null, config.gridTitle || 'Tasks'));
    var gridControls = sf.el('div', { className: 'sf-gantt-pane-controls' });
    gridHeader.appendChild(gridControls);
    gridPane.appendChild(gridHeader);

    var gridContent = sf.el('div', { className: 'sf-gantt-pane-content' });
    var grid = sf.el('div', { className: 'sf-gantt-grid' });
    gridContent.appendChild(grid);
    gridPane.appendChild(gridContent);

    // Chart pane
    var chartPane = sf.el('div', { className: 'sf-gantt-pane', id: chartPaneId });
    var chartHeader = sf.el('div', { className: 'sf-gantt-pane-header' });
    chartHeader.appendChild(sf.el('h3', null, config.chartTitle || 'Timeline'));

    // View mode selector
    var viewControls = sf.el('div', { className: 'sf-gantt-view-controls' });
    var viewSelect = sf.el('select', { className: 'sf-gantt-view-select' });
    var modes = [
      { value: 'Quarter Day', label: 'Quarter Day' },
      { value: 'Half Day', label: 'Half Day' },
      { value: 'Day', label: 'Day' },
      { value: 'Week', label: 'Week' },
      { value: 'Month', label: 'Month' },
    ];
    modes.forEach(function (m) {
      var opt = sf.el('option', { value: m.value }, m.label);
      if (m.value === (config.viewMode || 'Quarter Day')) opt.selected = true;
      viewSelect.appendChild(opt);
    });
    viewSelect.addEventListener('change', function () {
      if (ganttChart) {
        ganttChart.change_view_mode(viewSelect.value);
      }
    });
    viewControls.appendChild(viewSelect);

    var chartControls = sf.el('div', { className: 'sf-gantt-pane-controls' });
    chartHeader.appendChild(viewControls);
    chartHeader.appendChild(chartControls);
    chartPane.appendChild(chartHeader);

    var chartContent = sf.el('div', { className: 'sf-gantt-pane-content' });
    var chartContainer = sf.el('div', { className: 'sf-gantt-container', id: chartContainerId });
    chartContent.appendChild(chartContainer);
    chartPane.appendChild(chartContent);

    wrapper.appendChild(gridPane);
    wrapper.appendChild(chartPane);

    // ── API ──
    var ctrl = { el: wrapper };

    ctrl.mount = function (parent) {
      sf.assert(parent, 'gantt.mount(parent) requires a mount target');
      var target = typeof parent === 'string' ? document.getElementById(parent) : parent;
      sf.assert(target, 'gantt.mount(parent) target not found: ' + parent);
      target.appendChild(wrapper);
      initSplit();
    };

    ctrl.setTasks = function (newTasks) {
      sf.assert(Array.isArray(newTasks), 'gantt.setTasks(tasks) expects an array');
      tasks = newTasks;
      renderGrid(newTasks);
      renderChart(newTasks);
    };

    ctrl.refresh = function () {
      if (ganttChart && tasks.length > 0) {
        var frappeTasks = tasksToFrappe(tasks);
        ganttChart.refresh(frappeTasks);
      }
    };

    ctrl.getChart = function () { return ganttChart; };

    ctrl.changeViewMode = function (mode) {
      viewSelect.value = mode;
      if (ganttChart) ganttChart.change_view_mode(mode);
    };

    ctrl.highlightTask = function (taskId) {
      // Grid highlight
      grid.querySelectorAll('.sf-gantt-row').forEach(function (row) {
        row.classList.toggle('selected', row.dataset.taskId === taskId);
      });
      // Bar highlight
      var svg = chartContainer.querySelector('svg');
      if (svg) {
        svg.querySelectorAll('.bar-wrapper').forEach(function (bw) {
          bw.classList.remove('highlighted');
        });
        var bar = svg.querySelector('.bar-wrapper[data-id="' + taskId + '"]');
        if (bar) bar.classList.add('highlighted');
      }
    };

    ctrl.destroy = function () {
      if (splitInstance) { splitInstance.destroy(); splitInstance = null; }
      ganttChart = null;
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };

    return ctrl;

    // ── Internal ──

    function initSplit() {
      if (typeof Split !== 'function') return;
      splitInstance = Split(['#' + gridPaneId, '#' + chartPaneId], {
        direction: 'vertical',
        sizes: config.splitSizes || [40, 60],
        minSize: config.splitMinSize || [200, 300],
        snapOffset: 30,
        gutterSize: 4,
        cursor: 'col-resize',
        onDragEnd: function () {
          if (ganttChart) {
            setTimeout(function () { ganttChart.refresh(tasksToFrappe(tasks)); }, 100);
          }
        },
      });
    }

    function tasksToFrappe(taskList) {
      return taskList
        .filter(function (t) { return t.start && t.end; })
        .map(function (t) {
          return {
            id: t.id,
            name: t.name || t.label || t.id,
            start: t.start,
            end: t.end,
            custom_class: t.custom_class || '',
            dependencies: t.dependencies || '',
          };
        });
    }

    function renderChart(taskList) {
      var frappeTasks = tasksToFrappe(taskList);

      if (frappeTasks.length === 0) {
        chartContainer.textContent = '';
        chartContainer.appendChild(sf.el('div', {
          className: 'sf-gantt-empty-state',
          style: {
            padding: '24px',
            color: 'var(--sf-gray-400)',
            fontFamily: 'var(--sf-font-mono)',
            fontSize: '13px',
          },
        }, 'No scheduled tasks to display.'));
        ganttChart = null;
        return;
      }

      chartContainer.textContent = '';
      chartContainer.appendChild(createSvgRoot(svgId));

      ganttChart = new Gantt('#' + svgId, frappeTasks, {
        view_mode: viewSelect.value || 'Quarter Day',
        date_format: 'YYYY-MM-DD HH:mm',
        custom_popup_html: config.unsafePopupHtml || config.popupHtml || defaultPopup,
        on_click: function (task) {
          ctrl.highlightTask(task.id);
          if (config.onTaskClick) config.onTaskClick(task);
        },
        on_date_change: function (task, start, end) {
          if (config.onDateChange) config.onDateChange(task, start, end);
        },
      });
    }

    function renderGrid(taskList) {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      var table = sf.el('table', { className: 'sf-gantt-table' });

      // Header
      var thead = sf.el('thead');
      var headerRow = sf.el('tr');
      var columns = config.columns || [
        { key: 'name', label: 'Task' },
        { key: 'start', label: 'Start' },
        { key: 'end', label: 'End' },
      ];
      columns.forEach(function (col) {
        headerRow.appendChild(sf.el('th', null, col.label));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Body
      var tbody = sf.el('tbody');
      taskList.forEach(function (task) {
        var tr = sf.el('tr', {
          className: 'sf-gantt-row' + (task.custom_class ? ' ' + task.custom_class : ''),
          dataset: { taskId: task.id },
          onClick: function () {
            ctrl.highlightTask(task.id);
            if (config.onTaskClick) config.onTaskClick(task);
          },
        });
        columns.forEach(function (col) {
          var td = sf.el('td');
          if (col.key === 'name') {
            td.className = 'sf-task-name';
            td.textContent = task.name || task.label || task.id;
          } else if (col.render) {
            var content = col.render(task);
            if (typeof content === 'string') td.textContent = content;
            else if (content && content.unsafeHtml) td.innerHTML = content.unsafeHtml;
            else if (content instanceof Node) td.appendChild(content);
          } else {
            td.textContent = task[col.key] || '';
            td.style.fontFamily = 'var(--sf-font-mono)';
            td.style.fontSize = '12px';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      grid.appendChild(table);
    }

    function defaultPopup(task) {
      var t = tasks.find(function (x) { return x.id === task.id; });
      if (!t) return '';
      return '<div class="sf-gantt-popup">' +
        '<h4>' + sf.escHtml(t.name || t.id) + '</h4>' +
        '<p><strong>Start:</strong> ' + sf.escHtml(t.start) + '</p>' +
        '<p><strong>End:</strong> ' + sf.escHtml(t.end) + '</p>' +
        (t.duration_minutes ? '<p><strong>Duration:</strong> ' + t.duration_minutes + ' min</p>' : '') +
        (t.pinned ? '<p class="sf-gantt-popup-pinned"><i class="fa-solid fa-thumbtack"></i> Pinned</p>' : '') +
        '</div>';
    }

    function createSvgRoot(id) {
      if (document.createElementNS) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = id;
        return svg;
      }
      return sf.el('svg', { id: id });
    }
  };

})(SF);
