import assert from 'node:assert/strict';
import test from 'node:test';
import { createModal, gantt } from '../static/sf/sf.mjs';
import { createDom } from './support/fake-dom.js';
import { mockGlobals } from './support/mock-globals.js';

test('createModal renders unsafeBody as raw HTML and preserves text mode by default', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });
  const safeModal = createModal({ title: 'Safe', body: '<strong>safe</strong>' });
  assert.equal(safeModal.body.textContent, '<strong>safe</strong>');
  assert.equal(safeModal.body.innerHTML, '');

  const unsafeModal = createModal({ title: 'Unsafe', unsafeBody: '<strong>unsafe</strong>' });
  assert.equal(unsafeModal.body.innerHTML, '<strong>unsafe</strong>');

  unsafeModal.setBody({ unsafeBody: '<em>updated</em>' });
  assert.equal(unsafeModal.body.innerHTML, '<em>updated</em>');
});

test('gantt creates the chart root as a namespaced SVG element', (t) => {
  let seenNamespace = null;
  let seenTag = null;

  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });
  globalThis.Gantt = function () {
    return {
      change_view_mode() { },
      refresh() { },
    };
  };
  t.after(() => {
    delete globalThis.Gantt;
  });

  const originalCreateElementNS = document.createElementNS.bind(document);
  document.createElementNS = function (namespaceURI, tagName) {
    seenNamespace = namespaceURI;
    seenTag = tagName;
    return originalCreateElementNS(namespaceURI, tagName);
  };

  const ganttChart = gantt.create({});
  ganttChart.setTasks([{ id: 'task-1', start: '2026-03-21', end: '2026-03-22' }]);
  const chartRoot = ganttChart.el.querySelector('svg');

  assert.equal(seenNamespace, 'http://www.w3.org/2000/svg');
  assert.equal(seenTag, 'svg');
  assert.equal(chartRoot.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(chartRoot.tagName, 'SVG');
});
