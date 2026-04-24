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

  const headerOne = SF.createHeader({ actions: { onSolve() {}, onPause() {}, onResume() {}, onCancel() {} } });
  const headerTwo = SF.createHeader({ actions: { onSolve() {}, onPause() {}, onResume() {}, onCancel() {} } });
  const barOne = SF.createStatusBar({ header: headerOne });
  const barTwo = SF.createStatusBar({ header: headerTwo });
  function isVisible(btn) {
    return btn.style.display !== 'none';
  }
  function assertControls(header, expected) {
    assert.equal(isVisible(header.sfControls.solveBtn), expected.solve, expected.state + ' solve visibility');
    assert.equal(isVisible(header.sfControls.pauseBtn), expected.pause, expected.state + ' pause visibility');
    assert.equal(header.sfControls.pauseBtn.disabled, !!expected.pauseDisabled, expected.state + ' pause disabled');
    assert.equal(isVisible(header.sfControls.resumeBtn), expected.resume, expected.state + ' resume visibility');
    assert.equal(isVisible(header.sfControls.cancelBtn), expected.cancel, expected.state + ' stop visibility');
    assert.equal(header.sfControls.spinner.classList.contains('active'), expected.spinner, expected.state + ' spinner state');
  }

  assert.equal(headerOne.sfControls.cancelBtn.textContent, 'Stop');

  barOne.setLifecycleState('SOLVING');
  assertControls(headerOne, { state: 'SOLVING', solve: false, pause: true, resume: false, cancel: true, spinner: true });
  assert.notEqual(headerTwo.sfControls.solveBtn.style.display, 'none');
  assert.equal(headerTwo.sfControls.spinner.classList.contains('active'), false);

  barOne.setLifecycleState('PAUSE_REQUESTED');
  assertControls(headerOne, { state: 'PAUSE_REQUESTED', solve: false, pause: true, pauseDisabled: true, resume: false, cancel: true, spinner: true });

  barOne.setLifecycleState('RESUMING');
  assertControls(headerOne, { state: 'RESUMING', solve: false, pause: false, resume: false, cancel: true, spinner: true });

  barOne.setLifecycleState('CANCELLING');
  assertControls(headerOne, { state: 'CANCELLING', solve: false, pause: false, resume: false, cancel: false, spinner: true });

  ['COMPLETED', 'CANCELLED', 'FAILED', 'TERMINATED_BY_CONFIG'].forEach((state) => {
    barOne.setLifecycleState(state);
    assertControls(headerOne, { state, solve: false, pause: false, resume: false, cancel: false, spinner: false });
  });

  barOne.setLifecycleState('IDLE');
  assertControls(headerOne, { state: 'IDLE', solve: true, pause: false, resume: false, cancel: false, spinner: false });

  barTwo.setLifecycleState('PAUSED');
  assertControls(headerTwo, { state: 'PAUSED', solve: false, pause: false, resume: true, cancel: true, spinner: false });

  barTwo.setLifecycleState('SOLVING');
  assertControls(headerTwo, { state: 'SOLVING', solve: false, pause: true, resume: false, cancel: true, spinner: true });
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

test('missing tab ids only clear active state inside the targeted tab container', () => {
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

  tabsOne.show('missing');
  assert.equal(tabsOne.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), false);
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

test('gantt sortable columns render and reorder grid rows without throwing', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js'], {
    Gantt: function () {
      return {
        change_view_mode() {},
        refresh() {},
      };
    },
  });

  const gantt = SF.gantt.create({
    columns: [
      { key: 'name', label: 'Task', sortable: true },
      { key: 'start', label: 'Start' },
    ],
  });

  gantt.setTasks([
    { id: 'b', name: 'Beta', start: '2026-03-22', end: '2026-03-23' },
    { id: 'a', name: 'Alpha', start: '2026-03-21', end: '2026-03-22' },
  ]);

  const header = gantt.el.querySelector('th');
  header.click();

  const rows = gantt.el.querySelectorAll('.sf-gantt-row');
  assert.equal(rows[0].dataset.taskId, 'a');
  assert.equal(rows[1].dataset.taskId, 'b');
});

test('gantt pinned tasks propagate pinned custom class to chart tasks', () => {
  let seenTasks = null;

  const { SF } = loadSf(['js-src/00-core.js', 'js-src/14-gantt.js'], {
    Gantt: function (_selector, tasks) {
      seenTasks = tasks;
      return {
        change_view_mode() {},
        refresh() {},
      };
    },
  });

  const gantt = SF.gantt.create({});
  gantt.setTasks([
    { id: 'task-1', start: '2026-03-21', end: '2026-03-22', pinned: true, custom_class: 'critical' },
  ]);

  assert.equal(seenTasks[0].custom_class, 'critical pinned');
});
