import assert from 'node:assert/strict';
import test from 'node:test';
import { createHeader, createStatusBar, createTabs, showTab, gantt } from '../static/sf/sf.mjs';
import { createDom } from './support/fake-dom.js';
import { mockGlobals } from './support/mock-globals.js';

test('status bars only toggle the controls on their bound header', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });
  const headerOne = createHeader({ actions: { onSolve() { }, onPause() { }, onResume() { }, onCancel() { } } });
  const headerTwo = createHeader({ actions: { onSolve() { }, onPause() { }, onResume() { }, onCancel() { } } });
  const barOne = createStatusBar({ header: headerOne });
  const barTwo = createStatusBar({ header: headerTwo });
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
  assertControls(headerOne, { state: 'CANCELLING', solve: false, pause: false, resume: false, cancel: true, spinner: true });
  assert.equal(headerOne.sfControls.cancelBtn.disabled, false);

  ['COMPLETED', 'CANCELLED', 'FAILED', 'TERMINATED_BY_CONFIG'].forEach((state) => {
    barOne.setLifecycleState(state);
    assertControls(headerOne, { state, solve: true, pause: false, resume: false, cancel: false, spinner: false });
  });

  barOne.setLifecycleState('IDLE');
  assertControls(headerOne, { state: 'IDLE', solve: true, pause: false, resume: false, cancel: false, spinner: false });

  barTwo.setLifecycleState('PAUSED');
  assertControls(headerTwo, { state: 'PAUSED', solve: false, pause: false, resume: true, cancel: true, spinner: false });

  barTwo.setLifecycleState('SOLVING');
  assertControls(headerTwo, { state: 'SOLVING', solve: false, pause: true, resume: false, cancel: true, spinner: true });
});

test('status bar can show the same score again after reset', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const bar = createStatusBar({});
  document.body.appendChild(bar.el);
  const score = document.getElementById('sfScoreDisplay');

  bar.updateScore('0hard/0soft');
  assert.equal(score.textContent, '0hard/0soft');

  bar.updateScore(null);
  assert.equal(score.textContent, '\u2014');

  bar.updateScore('0hard/0soft');
  assert.equal(score.textContent, '0hard/0soft');
});

test('tab switching stays scoped to the owning tab container', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const tabsOne = createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan' },
      { id: 'gantt', content: 'Gantt' },
    ],
  });
  const tabsTwo = createTabs({
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

test('global showTab updates every matching tab container independently', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const tabsOne = createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan A' },
      { id: 'gantt', content: 'Gantt A' },
    ],
  });
  const tabsTwo = createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan B' },
      { id: 'gantt', content: 'Gantt B' },
    ],
  });

  document.body.appendChild(tabsOne.el);
  document.body.appendChild(tabsTwo.el);

  showTab('gantt');
  assert.equal(tabsOne.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
});

test('root-scoped showTab only updates the targeted tab container', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const tabsOne = createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan A' },
      { id: 'gantt', content: 'Gantt A' },
    ],
  });
  const tabsTwo = createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan B' },
      { id: 'gantt', content: 'Gantt B' },
    ],
  });

  document.body.appendChild(tabsOne.el);
  document.body.appendChild(tabsTwo.el);

  showTab('gantt', tabsOne.el);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), false);
  assert.equal(tabsOne.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="plan"]').classList.contains('active'), true);
  assert.equal(tabsTwo.el.querySelector('[data-tab-id="gantt"]').classList.contains('active'), false);
});

test('missing tab ids only clear active state inside the targeted tab container', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const tabsOne = createTabs({
    tabs: [
      { id: 'plan', active: true, content: 'Plan A' },
      { id: 'gantt', content: 'Gantt A' },
    ],
  });
  const tabsTwo = createTabs({
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

test('gantt instances get unique generated IDs by default', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const ganttOne = gantt.create({});
  const ganttTwo = gantt.create({});
  const onePanes = ganttOne.el.querySelectorAll('.sf-gantt-pane');
  const twoPanes = ganttTwo.el.querySelectorAll('.sf-gantt-pane');
  const oneContainer = ganttOne.el.querySelector('.sf-gantt-container');
  const twoContainer = ganttTwo.el.querySelector('.sf-gantt-container');

  assert.equal(onePanes[0].id === twoPanes[0].id, false);
  assert.equal(onePanes[1].id === twoPanes[1].id, false);
  assert.equal(oneContainer.id === twoContainer.id, false);
});

test('gantt.create falls back to built-in defaults when config is omitted', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const ganttChart = gantt.create();
  const panes = ganttChart.el.querySelectorAll('.sf-gantt-pane');
  const chartContainer = ganttChart.el.querySelector('.sf-gantt-container');

  assert.equal(panes.length, 2);
  assert.equal(Boolean(panes[0].id), true);
  assert.equal(Boolean(panes[1].id), true);
  assert.equal(Boolean(chartContainer.id), true);
});

test('gantt remount recreates the chart and preserves refresh behavior', (t) => {
  const splitCalls = [];
  const refreshCalls = [];
  let ganttInstanceCount = 0;

  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });
  globalThis.Split = function (targets, options) {
    splitCalls.push({ targets, options });
    return {
      destroy() { },
    };
  };
  globalThis.Gantt = function () {
    ganttInstanceCount++;
    return {
      change_view_mode() { },
      refresh(tasks) {
        refreshCalls.push(tasks);
      },
    };
  };
  t.after(() => {
    delete globalThis.Split;
    delete globalThis.Gantt;
  });

  const mountOne = document.createElement('div');
  const mountTwo = document.createElement('div');
  document.body.appendChild(mountOne);
  document.body.appendChild(mountTwo);

  const ganttChart = gantt.create({});
  ganttChart.setTasks([{ id: 'task-1', start: '2026-03-21', end: '2026-03-22' }]);
  ganttChart.mount(mountOne);
  ganttChart.mount(mountTwo);
  ganttChart.refresh();

  assert.equal(ganttInstanceCount >= 2, true);
  assert.equal(mountOne.childNodes.includes(ganttChart.el), false);
  assert.equal(mountTwo.childNodes.includes(ganttChart.el), true);
  assert.notEqual(ganttChart.getChart(), null);
  assert.equal(refreshCalls.length, 1);
  assert.equal(splitCalls.length, 2);
});

test('failed gantt remount keeps the existing mounted chart intact', (t) => {
  let destroyCount = 0;

  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });
  globalThis.Split = function () {
    return {
      destroy() {
        destroyCount++;
      },
    };
  };
  globalThis.Gantt = function () {
    return {
      change_view_mode() { },
      refresh() { },
    };
  };
  t.after(() => {
    delete globalThis.Split;
    delete globalThis.Gantt;
  });

  const validMount = document.createElement('div');
  const hiddenMount = document.createElement('div');
  hiddenMount.clientWidth = 0;
  hiddenMount.clientHeight = 0;
  hiddenMount.offsetWidth = 0;
  hiddenMount.offsetHeight = 0;
  document.body.appendChild(validMount);
  document.body.appendChild(hiddenMount);

  const ganttChart = gantt.create({});
  ganttChart.setTasks([{ id: 'task-1', start: '2026-03-21', end: '2026-03-22' }]);
  ganttChart.mount(validMount);

  assert.throws(function () {
    ganttChart.mount(hiddenMount);
  }, /target is not laid out yet/);
  assert.equal(validMount.childNodes.includes(ganttChart.el), true);
  assert.equal(hiddenMount.childNodes.includes(ganttChart.el), false);
  assert.equal(destroyCount, 0);
});

test('gantt initSplit keeps accepting scalar splitMinSize values', (t) => {
  const splitCalls = [];

  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });
  globalThis.Split = function (targets, options) {
    splitCalls.push({ targets, options });
    return {
      destroy() { },
    };
  };
  t.after(() => {
    delete globalThis.Split;
  });

  const mount = document.createElement('div');
  document.body.appendChild(mount);

  const ganttChart = gantt.create({ splitMinSize: 160 });
  ganttChart.mount(mount);

  assert.equal(splitCalls.length, 1);
  assert.equal(splitCalls[0].options.minSize[0], 160);
  assert.equal(splitCalls[0].options.minSize[1], 160);
});

test('gantt sortable columns render and reorder grid rows without throwing', (t) => {
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

  const ganttChart = gantt.create({
    columns: [
      { key: 'name', label: 'Task', sortable: true },
      { key: 'start', label: 'Start' },
    ],
  });

  ganttChart.setTasks([
    { id: 'b', name: 'Beta', start: '2026-03-22', end: '2026-03-23' },
    { id: 'a', name: 'Alpha', start: '2026-03-21', end: '2026-03-22' },
  ]);

  const header = ganttChart.el.querySelector('th');
  header.click();

  const rows = ganttChart.el.querySelectorAll('.sf-gantt-row');
  assert.equal(rows[0].dataset.taskId, 'a');
  assert.equal(rows[1].dataset.taskId, 'b');
});

test('gantt pinned tasks propagate pinned custom class to chart tasks', (t) => {
  let seenTasks = null;
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  globalThis.Gantt = function (_selector, tasks) {
    seenTasks = tasks;
    return {
      change_view_mode() { },
      refresh() { },
    };
  };
  t.after(() => {
    delete globalThis.Gantt;
  });

  const ganttChart = gantt.create({});
  ganttChart.setTasks([
    { id: 'task-1', start: '2026-03-21', end: '2026-03-22', pinned: true, custom_class: 'critical' },
  ]);

  assert.equal(seenTasks[0].custom_class, 'critical pinned');
});
