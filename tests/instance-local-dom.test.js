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

test('gantt remount recreates the chart and preserves refresh behavior', () => {
  const splitCalls = [];
  const refreshCalls = [];
  let ganttInstanceCount = 0;

  const { SF, document } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js'], {
    Split: function (targets, options) {
      splitCalls.push({ targets, options });
      return {
        destroy() {},
      };
    },
    Gantt: function () {
      ganttInstanceCount++;
      return {
        change_view_mode() {},
        refresh(tasks) {
          refreshCalls.push(tasks);
        },
      };
    },
  });

  const mountOne = document.createElement('div');
  const mountTwo = document.createElement('div');
  document.body.appendChild(mountOne);
  document.body.appendChild(mountTwo);

  const gantt = SF.gantt.create({});
  gantt.setTasks([{ id: 'task-1', start: '2026-03-21', end: '2026-03-22' }]);
  gantt.mount(mountOne);
  gantt.mount(mountTwo);
  gantt.refresh();

  assert.equal(ganttInstanceCount >= 2, true);
  assert.equal(mountOne.childNodes.includes(gantt.el), false);
  assert.equal(mountTwo.childNodes.includes(gantt.el), true);
  assert.notEqual(gantt.getChart(), null);
  assert.equal(refreshCalls.length, 1);
  assert.equal(splitCalls.length, 2);
});

test('failed gantt remount keeps the existing mounted chart intact', () => {
  let destroyCount = 0;

  const { SF, document } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js'], {
    Split: function () {
      return {
        destroy() {
          destroyCount++;
        },
      };
    },
    Gantt: function () {
      return {
        change_view_mode() {},
        refresh() {},
      };
    },
  });

  const validMount = document.createElement('div');
  const hiddenMount = document.createElement('div');
  hiddenMount.clientWidth = 0;
  hiddenMount.clientHeight = 0;
  hiddenMount.offsetWidth = 0;
  hiddenMount.offsetHeight = 0;
  document.body.appendChild(validMount);
  document.body.appendChild(hiddenMount);

  const gantt = SF.gantt.create({});
  gantt.setTasks([{ id: 'task-1', start: '2026-03-21', end: '2026-03-22' }]);
  gantt.mount(validMount);

  assert.throws(function () {
    gantt.mount(hiddenMount);
  }, /target is not laid out yet/);
  assert.equal(validMount.childNodes.includes(gantt.el), true);
  assert.equal(hiddenMount.childNodes.includes(gantt.el), false);
  assert.equal(destroyCount, 0);
});

test('gantt initSplit keeps accepting scalar splitMinSize values', () => {
  const splitCalls = [];

  const { SF, document } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js'], {
    Split: function (targets, options) {
      splitCalls.push({ targets, options });
      return {
        destroy() {},
      };
    },
  });

  const mount = document.createElement('div');
  document.body.appendChild(mount);

  const gantt = SF.gantt.create({ splitMinSize: 160 });
  gantt.mount(mount);

  assert.equal(splitCalls.length, 1);
  assert.equal(splitCalls[0].options.minSize[0], 160);
  assert.equal(splitCalls[0].options.minSize[1], 160);
});
