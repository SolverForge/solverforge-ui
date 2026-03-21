const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createDom } = require('./support/fake-dom');

const ROOT = path.resolve(__dirname, '..');

function loadSf(files, overrides = {}) {
  const { document, window, Node } = createDom();
  const context = vm.createContext({
    console,
    document,
    window,
    Node,
    setTimeout,
    clearTimeout,
    ...overrides,
  });

  files.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });

  return { SF: context.window.SF, document };
}

test('createModal renders unsafeBody as raw HTML and preserves text mode by default', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/06-modal.js']);

  const safeModal = SF.createModal({ title: 'Safe', body: '<strong>safe</strong>' });
  assert.equal(safeModal.body.textContent, '<strong>safe</strong>');
  assert.equal(safeModal.body.innerHTML, '');

  const unsafeModal = SF.createModal({ title: 'Unsafe', unsafeBody: '<strong>unsafe</strong>' });
  assert.equal(unsafeModal.body.innerHTML, '<strong>unsafe</strong>');

  unsafeModal.setBody({ unsafeBody: '<em>updated</em>' });
  assert.equal(unsafeModal.body.innerHTML, '<em>updated</em>');
});

test('gantt creates the chart root as a namespaced SVG element', () => {
  let seenNamespace = null;
  let seenTag = null;

  const { SF, document } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js'], {
    Gantt: function () {
      return {
        change_view_mode() {},
        refresh() {},
      };
    },
  });

  const originalCreateElementNS = document.createElementNS.bind(document);
  document.createElementNS = function (namespaceURI, tagName) {
    seenNamespace = namespaceURI;
    seenTag = tagName;
    return originalCreateElementNS(namespaceURI, tagName);
  };

  const gantt = SF.gantt.create({});
  gantt.setTasks([{ id: 'task-1', start: '2026-03-21', end: '2026-03-22' }]);
  const chartRoot = gantt.el.querySelector('svg');

  assert.equal(seenNamespace, 'http://www.w3.org/2000/svg');
  assert.equal(seenTag, 'svg');
  assert.equal(chartRoot.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(chartRoot.tagName, 'SVG');
});
