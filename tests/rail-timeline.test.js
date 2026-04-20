const assert = require('node:assert/strict');
const test = require('node:test');

const { loadSf } = require('./support/load-sf');

function buildAxis(dayCount, initialViewport) {
  return {
    startMinute: 0,
    endMinute: dayCount * 1440,
    days: Array.from({ length: dayCount }, (_, index) => ({
      label: 'Day ' + (index + 1),
      startMinute: index * 1440,
      endMinute: (index + 1) * 1440,
      isWeekend: index % 7 === 5 || index % 7 === 6,
    })),
    initialViewport: initialViewport || {
      startMinute: 0,
      endMinute: dayCount * 1440,
    },
  };
}

function blockTrackMap(root, className) {
  return Object.fromEntries(
    root.querySelectorAll(className).map((node) => [node.dataset.itemId, Number(node.dataset.trackIndex || 0)])
  );
}

test('timeline detailed lanes pack overlapping items into stable track indices', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const model = {
    axis: buildAxis(7),
    lanes: [
      {
        id: 'employee-a',
        label: 'Employee A',
        mode: 'detailed',
        items: [
          { id: 'alpha', startMinute: 120, endMinute: 300, label: 'Alpha', tone: 'blue' },
          { id: 'beta', startMinute: 60, endMinute: 180, label: 'Beta', tone: 'amber' },
          { id: 'gamma', startMinute: 300, endMinute: 420, label: 'Gamma', tone: 'emerald' },
          { id: 'delta', startMinute: 140, endMinute: 220, label: 'Delta', tone: 'rose' },
        ],
      },
    ],
  };

  const timeline = SF.rail.createTimeline({ model });
  const before = blockTrackMap(timeline.el, '.sf-rail-timeline-item--detail');

  timeline.setModel(model);

  const after = blockTrackMap(timeline.el, '.sf-rail-timeline-item--detail');

  assert.deepEqual(before, {
    alpha: 1,
    beta: 0,
    delta: 2,
    gamma: 0,
  });
  assert.deepEqual(after, before);
  assert.equal(SF.schedule, undefined);
});

test('timeline overview lanes cluster overlaps and expand only the targeted region', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(14, { startMinute: 0, endMinute: 7 * 1440 }),
      lanes: [
        {
          id: 'location-east',
          label: 'Ward East',
          mode: 'overview',
          items: [
            { id: 'early-a', clusterId: 'morning-rush', startMinute: 120, endMinute: 300, label: 'Early A', tone: 'blue' },
            { id: 'early-b', clusterId: 'morning-rush', startMinute: 180, endMinute: 360, label: 'Early B', tone: 'blue' },
            { id: 'late-a', startMinute: 700, endMinute: 840, label: 'Late A', tone: 'emerald' },
          ],
        },
      ],
    },
  });

  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--cluster').length, 1);
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--overview').length, 1);

  timeline.expandCluster('location-east', 'morning-rush');

  const row = timeline.el.querySelector('.sf-rail-timeline-row');

  assert.equal(row.dataset.expandedClusterId, 'morning-rush');
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--cluster').length, 0);
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--detail').length, 2);
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--overview').length, 1);

  timeline.expandCluster('location-east', null);

  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--cluster').length, 1);
});

test('timeline syncs header/body scroll, updates zoom presets, and drag-pans from the header', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(28, { startMinute: 0, endMinute: 14 * 1440 }),
      lanes: [
        {
          id: 'employee-b',
          label: 'Employee B',
          mode: 'detailed',
          items: [
            { id: 'shift-1', startMinute: 30, endMinute: 210, label: 'Shift 1', tone: 'amber' },
            { id: 'shift-2', startMinute: 240, endMinute: 420, label: 'Shift 2', tone: 'blue' },
          ],
        },
      ],
    },
  });

  const headerViewport = timeline.el.querySelector('.sf-rail-timeline-header-viewport');
  const bodyViewport = timeline.el.querySelector('.sf-rail-timeline-body-viewport');

  bodyViewport.scrollLeft = 200;
  bodyViewport.dispatchEvent({ type: 'scroll' });

  assert.equal(headerViewport.scrollLeft, 200);
  assert.notEqual(Number(timeline.el.dataset.viewportStartMinute), 0);

  timeline.el.querySelectorAll('.sf-rail-timeline-zoom-button').forEach((button) => {
    if (button.dataset.zoom === '1w') button.click();
  });

  assert.equal(Number(timeline.el.dataset.viewportDurationMinutes), 7 * 1440);

  const beforeDrag = headerViewport.scrollLeft;

  headerViewport.dispatchEvent({
    type: 'mousedown',
    button: 0,
    clientX: 360,
    preventDefault() {},
  });
  headerViewport.dispatchEvent({
    type: 'mousemove',
    clientX: 240,
    preventDefault() {},
  });
  headerViewport.dispatchEvent({ type: 'mouseup' });

  assert.notEqual(headerViewport.scrollLeft, beforeDrag);
  assert.equal(bodyViewport.scrollLeft, headerViewport.scrollLeft);
});

test('timeline derives content width from the measured body viewport instead of the padded host', () => {
  const observers = [];
  const { SF, document } = loadSf(
    ['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js'],
    {
      ResizeObserver: class ResizeObserver {
        constructor(callback) {
          this.callback = callback;
          observers.push(this);
        }

        observe(target) {
          this.target = target;
        }

        disconnect() {}
      },
    }
  );

  const timeline = SF.rail.createTimeline({
    labelWidth: 280,
    model: {
      axis: buildAxis(28, { startMinute: 0, endMinute: 14 * 1440 }),
      lanes: [
        {
          id: 'employee-c',
          label: 'Employee C',
          mode: 'detailed',
          items: [
            { id: 'shift-1', startMinute: 30, endMinute: 210, label: 'Shift 1', tone: 'amber' },
            { id: 'shift-2', startMinute: 240, endMinute: 420, label: 'Shift 2', tone: 'blue' },
          ],
        },
      ],
    },
  });

  const host = document.createElement('div');
  host.clientWidth = 1400;
  host.offsetWidth = 1400;
  document.body.appendChild(host);

  const root = timeline.el;
  root.clientWidth = 2520;
  root.offsetWidth = 2520;
  host.appendChild(root);

  const bodyViewport = root.querySelector('.sf-rail-timeline-body-viewport');
  bodyViewport.clientWidth = 1364;
  bodyViewport.offsetWidth = 1364;

  observers[0].callback();

  const labelWidth = Number.parseFloat(root.style['--sf-rail-label-width']);
  const visibleTrackWidth = bodyViewport.clientWidth - labelWidth;
  const expectedContentWidth = labelWidth + Math.max(
    Math.round(visibleTrackWidth * 2),
    visibleTrackWidth,
    480
  );

  assert.equal(labelWidth, 280);
  assert.equal(bodyViewport.scrollWidth, expectedContentWidth);
  assert.equal(root.dataset.supportedViewportWidth, 'true');
});

test('timeline compacts the label column before collapsing the visible track', () => {
  const observers = [];
  const { SF, document } = loadSf(
    ['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js'],
    {
      ResizeObserver: class ResizeObserver {
        constructor(callback) {
          this.callback = callback;
          observers.push(this);
        }

        observe(target) {
          this.target = target;
        }

        disconnect() {}
      },
    }
  );

  const timeline = SF.rail.createTimeline({
    labelWidth: 280,
    model: {
      axis: buildAxis(28, { startMinute: 0, endMinute: 14 * 1440 }),
      lanes: [
        {
          id: 'employee-d',
          label: 'Employee D',
          mode: 'detailed',
          items: [
            { id: 'shift-1', startMinute: 60, endMinute: 240, label: 'Shift 1', tone: 'emerald' },
          ],
        },
      ],
    },
  });

  const host = document.createElement('div');
  host.clientWidth = 560;
  host.offsetWidth = 560;
  document.body.appendChild(host);

  const root = timeline.el;
  root.clientWidth = 860;
  root.offsetWidth = 860;
  host.appendChild(root);

  const bodyViewport = root.querySelector('.sf-rail-timeline-body-viewport');
  bodyViewport.clientWidth = 540;
  bodyViewport.offsetWidth = 540;

  observers[0].callback();

  const labelWidth = Number.parseFloat(root.style['--sf-rail-label-width']);
  const visibleTrackWidth = bodyViewport.clientWidth - labelWidth;

  assert.equal(labelWidth, 220);
  assert.equal(visibleTrackWidth, 320);
  assert.equal(bodyViewport.scrollWidth, 860);
  assert.equal(root.dataset.supportedViewportWidth, 'true');
});

test('timeline renders weekend shading and default 6-hour ticks without explicit tick input', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: {
        startMinute: 0,
        endMinute: 2 * 1440,
        days: [
          { label: 'Fri', startMinute: 0, endMinute: 1440, isWeekend: false },
          { label: 'Sat', startMinute: 1440, endMinute: 2880, isWeekend: true },
        ],
      },
      lanes: [
        {
          id: 'location-west',
          label: 'Ward West',
          mode: 'overview',
          items: [
            { id: 'visit-1', startMinute: 60, endMinute: 240, label: 'Visit 1', tone: 'slate' },
          ],
        },
      ],
    },
  });

  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-weekend-band').length, 2);
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-tick-label').length, 8);
});
