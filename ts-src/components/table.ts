/* ============================================================================
   SolverForge UI — Table Factory
   ============================================================================ */

import {assert, bindActivation, el} from "../core";

export const createTable = function (config) {
    assert(config, 'createTable(config) requires a configuration object');
    assert(!config.columns || Array.isArray(config.columns), 'createTable(config.columns) must be an array');
    assert(!config.rows || Array.isArray(config.rows), 'createTable(config.rows) must be an array');

    var wrapper = el('div', { className: 'sf-table-container' });
    var table = el('table', { className: 'sf-table' });

    // Header
    if (config.columns) {
      var thead = el('thead');
      var tr = el('tr');
      config.columns.forEach(function (col) {
        var th = el('th', null, typeof col === 'string' ? col : col.label);
        if (col.align) th.style.textAlign = col.align;
        if (col.width) th.style.width = col.width;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    // Body
    var tbody = el('tbody');
    if (config.rows) {
      config.rows.forEach(function (row, rowIdx) {
        var tr = el('tr');
        row.forEach(function (cell, colIdx) {
          var td = el('td');
          if (typeof cell === 'string' || typeof cell === 'number') {
            td.textContent = String(cell);
          } else if (cell instanceof Node) {
            td.appendChild(cell);
          } else if (cell && cell.unsafeHtml) {
            td.innerHTML = cell.unsafeHtml;
          }
          var col = config.columns && config.columns[colIdx];
          if (col && col.align) td.style.textAlign = col.align;
          if (col && col.className) td.classList.add(col.className);
          tr.appendChild(td);
        });
        if (config.onRowClick) {
          tr.style.cursor = 'pointer';
          tr.setAttribute('role', 'button');
          tr.tabIndex = 0;
          bindActivation(tr, function () { config.onRowClick(rowIdx, row); });
        }
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  };
