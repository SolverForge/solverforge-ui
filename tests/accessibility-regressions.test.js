import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadSf } from './support/load-sf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('status bar constraint dots keep stable ids for solver analysis coloring', () => {
  const { SF } = loadSf();

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
  const { SF } = loadSf();

  const modal = SF.createModal({ title: 'Example', body: 'Body' });
  const modalClose = modal.el.querySelector('.sf-modal-close');
  assert.equal(modalClose.attributes['aria-label'], 'Close modal');
  assert.equal(modalClose.textContent, '×');

  SF.showToast({ message: 'Saved' });
  const toastBtn = modal.el.ownerDocument.body.querySelector('.sf-toast-close');
  assert.equal(toastBtn.attributes['aria-label'], 'Dismiss toast');
  assert.equal(toastBtn.textContent, '×');

  const guide = SF.createApiGuide({
    endpoints: [{ path: '/x', curl: 'curl /x' }],
  });
  const copyBtn = guide.querySelector('.sf-copy-btn');
  assert.equal(copyBtn.attributes['aria-label'], 'Copy command');
});

test('reduced-motion CSS only targets solverforge scoped classes', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css-src/14-animations.css'), 'utf8');

  assert.ok(css.includes('[class^="sf-"]'));
  assert.doesNotMatch(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,/);
});
