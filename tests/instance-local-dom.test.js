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

test('status bars only toggle the controls on their bound header', () => {
  const { SF } = loadSf([
    'js-src/00-core.js',
    'js-src/03-buttons.js',
    'js-src/04-header.js',
    'js-src/05-statusbar.js',
  ]);

  const headerOne = SF.createHeader({ actions: { onSolve() {}, onStop() {} } });
  const headerTwo = SF.createHeader({ actions: { onSolve() {}, onStop() {} } });
  const barOne = SF.createStatusBar({ header: headerOne });
  const barTwo = SF.createStatusBar({ header: headerTwo });

  barOne.setSolving(true);
  assert.equal(headerOne.sfControls.solveBtn.style.display, 'none');
  assert.equal(headerOne.sfControls.stopBtn.style.display, '');
  assert.equal(headerOne.sfControls.spinner.classList.contains('active'), true);
  assert.notEqual(headerTwo.sfControls.solveBtn.style.display, 'none');
  assert.equal(headerTwo.sfControls.spinner.classList.contains('active'), false);

  barTwo.setSolving(true);
  assert.equal(headerTwo.sfControls.solveBtn.style.display, 'none');
  assert.equal(headerTwo.sfControls.stopBtn.style.display, '');
});

test('tab switching stays scoped to the owning tab container', () => {
  const { SF, document } = loadSf(['js-src/00-core.js', 'js-src/07-tabs.js']);

  const tabsOne = SF.createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan' },
      { id: 'gantt', content: 'Gantt' },
    ],
  });
  const tabsTwo = SF.createTabs({
    tabs: [
      { id: 'alpha', active: true, content: 'Alpha' },
      { id: 'beta', content: 'Beta' },
    ],
  });

  document.body.appendChild(tabsOne.el);
  document.body.appendChild(tabsTwo.el);

  tabsOne.show('gantt');
  assert.equal(tabsOne.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="alpha"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="beta"]').classList.contains('active'), false);
});

test('global showTab updates every matching tab container independently', () => {
  const { SF, document } = loadSf(['js-src/00-core.js', 'js-src/07-tabs.js']);

  const tabsOne = SF.createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan A' },
      { id: 'gantt', content: 'Gantt A' },
    ],
  });
  const tabsTwo = SF.createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan B' },
      { id: 'gantt', content: 'Gantt B' },
    ],
  });

  document.body.appendChild(tabsOne.el);
  document.body.appendChild(tabsTwo.el);

  SF.showTab('gantt');
  assert.equal(tabsOne.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
});

test('root-scoped showTab only updates the targeted tab container', () => {
  const { SF, document } = loadSf(['js-src/00-core.js', 'js-src/07-tabs.js']);

  const tabsOne = SF.createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan A' },
      { id: 'gantt', content: 'Gantt A' },
    ],
  });
  const tabsTwo = SF.createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan B' },
      { id: 'gantt', content: 'Gantt B' },
    ],
  });

  document.body.appendChild(tabsOne.el);
  document.body.appendChild(tabsTwo.el);

  SF.showTab('gantt', tabsOne.el);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), false);
});

test('gantt instances get unique generated IDs by default', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js']);

  const ganttOne = SF.gantt.create({});
  const ganttTwo = SF.gantt.create({});
  const onePanes = ganttOne.el.querySelectorAll('.sf-gantt-pane');
  const twoPanes = ganttTwo.el.querySelectorAll('.sf-gantt-pane');
  const oneContainer = ganttOne.el.querySelector('.sf-gantt-container');
  const twoContainer = ganttTwo.el.querySelector('.sf-gantt-container');

  assert.equal(onePanes[0].id === twoPanes[0].id, false);
  assert.equal(onePanes[1].id === twoPanes[1].id, false);
  assert.equal(oneContainer.id === twoContainer.id, false);
});

test('gantt.create falls back to built-in defaults when config is omitted', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js']);

  const gantt = SF.gantt.create();
  const panes = gantt.el.querySelectorAll('.sf-gantt-pane');
  const chartContainer = gantt.el.querySelector('.sf-gantt-container');

  assert.equal(panes.length, 2);
  assert.equal(Boolean(panes[0].id), true);
  assert.equal(Boolean(panes[1].id), true);
  assert.equal(Boolean(chartContainer.id), true);
});
