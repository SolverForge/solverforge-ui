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

test('iconOnly buttons keep an accessible label without rendering text content', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/03-buttons.js']);

  const button = SF.createButton({
    text: 'Settings',
    icon: 'fa-gear',
    iconOnly: true,
  });

  assert.equal(button.textContent, '');
  assert.equal(button.attributes['aria-label'], 'Settings');
});

test('rail card badges accept a single string badge and preserve heatmap alignment', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js']);

  const card = SF.rail.createCard({
    name: 'Kiln 1',
    badges: 'TEMPRA',
    labelWidth: 220,
    columns: 4,
    heatmap: {
      label: 'Load',
      horizon: 100,
      segments: [{ start: 0, end: 25, color: '#0f0' }],
    },
  });

  const badges = card.el.querySelectorAll('.sf-resource-type-badge');
  const heatmap = card.el.querySelector('.sf-heatmap');

  assert.equal(badges.length, 1);
  assert.equal(badges[0].textContent, 'TEMPRA');
  assert.equal(heatmap.style.gridTemplateColumns, '220px 1fr');
});
