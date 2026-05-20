import assert from 'node:assert/strict';
import test from 'node:test';
import { createButton, createTable, createTabs, showTab } from '../static/sf/sf.mjs';
import { createDom } from './support/fake-dom.js';
import { mockGlobals } from './support/mock-globals.js';

test('button, table, and tabs render and respond to basic interactions', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  let clicked = 0;
  const button = createButton({
    text: 'Solve',
    variant: 'success',
    size: 'small',
    id: 'solve-btn',
    dataset: { action: 'solve' },
    onClick() {
      clicked += 1;
    },
  });
  button.click();
  assert.equal(button.classList.contains('sf-btn--success'), true);
  assert.equal(button.classList.contains('sf-btn--sm'), true);
  assert.equal(button.id, 'solve-btn');
  assert.equal(button.dataset.action, 'solve');
  assert.equal(button.textContent, 'Solve');
  assert.equal(clicked, 1);

  let selectedRow = null;
  const table = createTable({
    columns: [{ label: 'Job', className: 'job-col' }, { label: 'Status', align: 'right' }],
    rows: [['A-1', 'Ready']],
    onRowClick(index, row) {
      selectedRow = { index, row };
    },
  });
  document.body.appendChild(table);
  const row = table.querySelectorAll('tr')[1];
  row.click();
  assert.deepEqual(selectedRow, { index: 0, row: ['A-1', 'Ready'] });
  assert.equal(table.querySelectorAll('th').length, 2);
  assert.equal(table.querySelectorAll('td')[0].textContent, 'A-1');
  assert.equal(table.querySelectorAll('td')[1].style.textAlign, 'right');

  const tabs = createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan' },
      { id: 'gantt', content: 'Gantt' },
    ],
  });
  document.body.appendChild(tabs.el);
  showTab('gantt');
  assert.equal(tabs.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabs.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
});
