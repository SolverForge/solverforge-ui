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
    navigator: {
      clipboard: {
        writeText() {
          return Promise.resolve();
        },
      },
    },
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

test('status bar constraint dots keep stable ids for solver analysis coloring', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/01-score.js', 'js-src/05-statusbar.js']);

  const statusBar = SF.createStatusBar({
    constraints: [
      { name: 'Hard A', type: 'hard' },
      { name: 'Soft B', type: 'soft' },
    ],
  });

  const dots = statusBar.el.querySelectorAll('.sf-constraint-dot');
  assert.equal(dots[0].id, 'sf-cdot-0');
  assert.equal(dots[1].id, 'sf-cdot-1');
});

test('modal, toast, and api guide copy controls expose aria-label attributes', () => {
  const { SF } = loadSf([
    'js-src/00-core.js',
    'js-src/06-modal.js',
    'js-src/09-toast.js',
    'js-src/12-api-guide.js',
  ]);

  const modal = SF.createModal({ title: 'Example', body: 'Body' });
  const modalClose = modal.el.querySelector('.sf-modal-close');
  assert.equal(modalClose.attributes['aria-label'], 'Close modal');

  SF.showToast({ message: 'Saved' });
  const toastBtn = modal.el.ownerDocument.body.querySelector('.sf-toast-close');
  assert.equal(toastBtn.attributes['aria-label'], 'Dismiss toast');

  const guide = SF.createApiGuide({
    endpoints: [{ path: '/x', curl: 'curl /x' }],
  });
  const copyBtn = guide.querySelector('.sf-copy-btn');
  assert.equal(copyBtn.attributes['aria-label'], 'Copy command');
});

test('reduced-motion CSS only targets solverforge scoped classes', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css-src/14-animations.css'), 'utf8');

  assert.match(css, /\[class\^="sf-"\]/);
  assert.doesNotMatch(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,/);
});
