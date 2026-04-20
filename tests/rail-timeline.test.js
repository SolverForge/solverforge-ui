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

function dayMinute(dayIndex, hour, minute = 0) {
  return dayIndex * 1440 + hour * 60 + minute;
}

function buildDenseHospitalLikeModel() {
  const laneCount = 100;
  const totalItems = 1500;
  let itemCounter = 0;

  return {
    axis: buildAxis(28, { startMinute: 0, endMinute: 14 * 1440 }),
    lanes: Array.from({ length: laneCount }, (_, laneIndex) => {
      const overview = laneIndex < 40;
      const laneItems = [];
      const perLane = laneIndex < laneCount - 1
        ? Math.floor(totalItems / laneCount) + (laneIndex < totalItems % laneCount ? 1 : 0)
        : totalItems - itemCounter;

      for (let itemIndex = 0; itemIndex < perLane; itemIndex += 1) {
        const clusterOffset = itemIndex % 3;
        const dayIndex = overview
          ? (laneIndex * 3 + Math.floor(itemIndex / 3)) % 28
          : (laneIndex * 3 + itemIndex) % 28;
        const startHour = 6 + (overview ? Math.floor(itemIndex / 3) % 4 : (itemIndex + laneIndex) % 6);
        const startMinute = overview
          ? dayMinute(dayIndex, startHour, clusterOffset * 45)
          : dayMinute(dayIndex, startHour);
        const endMinute = overview
          ? startMinute + 300 + clusterOffset * 30
          : startMinute + 360 + ((itemIndex + laneIndex) % 3) * 60;
        const tone = ['blue', 'emerald', 'amber', 'violet'][itemIndex % 4];
        const itemId = `lane-${laneIndex}-item-${itemIndex}`;

        if (overview) {
          laneItems.push({
            id: itemId,
            clusterId: `cluster-${laneIndex}-${Math.floor(itemIndex / 3)}`,
            startMinute,
            endMinute,
            label: `Coverage ${itemIndex + 1}`,
            tone,
          });
        } else {
          laneItems.push({
            id: itemId,
            startMinute,
            endMinute,
            label: `Shift ${itemIndex + 1}`,
            meta: { zone: `Unit ${laneIndex % 8}` },
            tone,
          });
        }
        itemCounter += 1;
      }

      return {
        id: overview ? `location-${laneIndex}` : `employee-${laneIndex}`,
        label: overview ? `By location · Unit ${laneIndex + 1}` : `By employee · Clinician ${laneIndex + 1}`,
        mode: overview ? 'overview' : 'detailed',
        items: laneItems,
      };
    }),
  };
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

test('timeline overview summaries accept additive summary metadata and render count/open/tone composition', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(14, { startMinute: 0, endMinute: 7 * 1440 }),
      lanes: [
        {
          id: 'ward-surge',
          label: 'Ward surge',
          mode: 'overview',
          items: [
            {
              id: 'surge',
              startMinute: dayMinute(1, 6),
              endMinute: dayMinute(1, 18),
              label: 'Unused label',
              tone: 'blue',
              summary: {
                primaryLabel: 'Monday intake surge',
                secondaryLabel: 'ER + trauma + float pool',
                count: 12,
                openCount: 3,
                toneSegments: [
                  { tone: 'blue', count: 7 },
                  { tone: 'amber', count: 3 },
                  { tone: 'rose', count: 2 },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  const block = timeline.el.querySelector('.sf-rail-timeline-item--overview');
  const pills = timeline.el.querySelectorAll('.sf-rail-timeline-summary-pill').map((node) => node.textContent.trim());
  const toneSegments = timeline.el.querySelectorAll('.sf-rail-timeline-summary-tone-segment');

  assert.equal(block.textContent.includes('Monday intake surge'), true);
  assert.equal(block.textContent.includes('ER + trauma + float pool'), true);
  assert.deepEqual(pills, ['12 total', '3 open']);
  assert.equal(toneSegments.length, 3);
  assert.equal(block.attributes['aria-label'].includes('12 assignments'), true);
  assert.equal(block.attributes['aria-label'].includes('3 open'), true);
});

test('timeline overview lanes cluster tightly adjacent items into one aggregate block', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(7),
      lanes: [
        {
          id: 'ward-adjacent',
          label: 'Ward adjacent',
          mode: 'overview',
          items: [
            { id: 'adjacent-a', startMinute: 60, endMinute: 180, label: 'A', tone: 'blue' },
            { id: 'adjacent-b', startMinute: 195, endMinute: 300, label: 'B', tone: 'amber' },
          ],
        },
      ],
    },
  });

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

test('timeline updates viewport without rebuilding rows for simple pan changes', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(28, { startMinute: 0, endMinute: 14 * 1440 }),
      lanes: [
        {
          id: 'employee-pan',
          label: 'Employee Pan',
          mode: 'detailed',
          items: [
            { id: 'shift-1', startMinute: 120, endMinute: 360, label: 'Shift 1', tone: 'blue' },
            { id: 'shift-2', startMinute: 480, endMinute: 720, label: 'Shift 2', tone: 'amber' },
          ],
        },
      ],
    },
  });

  const originalRow = timeline.el.querySelector('.sf-rail-timeline-row');
  const originalBlock = timeline.el.querySelector('.sf-rail-timeline-item--detail');

  timeline.setViewport({ startMinute: 7 * 1440, endMinute: 21 * 1440 });

  assert.equal(timeline.el.querySelector('.sf-rail-timeline-row'), originalRow);
  assert.equal(timeline.el.querySelector('.sf-rail-timeline-item--detail'), originalBlock);
  assert.equal(Number(timeline.el.dataset.viewportStartMinute), 7 * 1440);
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

test('timeline renders after append when ResizeObserver is unavailable', async () => {
  const { SF, document } = loadSf(
    ['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js'],
    { ResizeObserver: undefined }
  );

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(28, { startMinute: 0, endMinute: 14 * 1440 }),
      lanes: [
        {
          id: 'employee-h',
          label: 'Employee H',
          mode: 'detailed',
          items: [
            { id: 'shift-1', startMinute: 60, endMinute: 240, label: 'Shift 1', tone: 'blue' },
          ],
        },
      ],
    },
  });

  const host = document.createElement('div');
  host.clientWidth = 1400;
  host.offsetWidth = 1400;
  document.body.appendChild(host);
  host.appendChild(timeline.el);

  const bodyViewport = timeline.el.querySelector('.sf-rail-timeline-body-viewport');
  bodyViewport.clientWidth = 1364;
  bodyViewport.offsetWidth = 1364;

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-row').length, 1);
  assert.equal(timeline.el.querySelector('.sf-rail-timeline-header-row').children.length, 2);
  assert.equal(bodyViewport.scrollWidth > bodyViewport.clientWidth, true);
});

test('timeline exposes keyboard-focus tooltip parity and keyboard expansion for overview blocks', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(14, { startMinute: 0, endMinute: 7 * 1440 }),
      lanes: [
        {
          id: 'location-focus',
          label: 'Location focus',
          mode: 'overview',
          items: [
            { id: 'early-a', clusterId: 'rush', startMinute: 120, endMinute: 300, label: 'Early A', tone: 'blue' },
            { id: 'early-b', clusterId: 'rush', startMinute: 180, endMinute: 360, label: 'Early B', tone: 'blue' },
          ],
        },
      ],
    },
  });

  const clusterBlock = timeline.el.querySelector('.sf-rail-timeline-item--cluster');
  const tooltip = timeline.el.querySelector('.sf-rail-timeline-tooltip');

  clusterBlock.dispatchEvent({ type: 'focus' });

  assert.equal(clusterBlock.tabIndex, 0);
  assert.equal(clusterBlock.attributes.role, 'button');
  assert.equal(clusterBlock.attributes['aria-describedby'], tooltip.id);
  assert.equal(tooltip.classList.contains('visible'), true);
  assert.equal(tooltip.attributes['aria-hidden'], 'false');

  clusterBlock.dispatchEvent({
    type: 'keydown',
    key: 'Enter',
    preventDefault() {},
  });

  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--detail').length, 2);

  clusterBlock.dispatchEvent({ type: 'blur' });

  assert.equal(tooltip.classList.contains('visible'), false);
  assert.equal(tooltip.attributes['aria-hidden'], 'true');
});

test('timeline assigns stable fallback labels and ordering for unlabeled items and detail items', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(7, { startMinute: 0, endMinute: 3 * 1440 }),
      lanes: [
        {
          id: 'detailed-lane',
          label: 'Detailed lane',
          mode: 'detailed',
          items: [
            { id: 'detail-a', startMinute: 60, endMinute: 180, tone: 'blue' },
            { id: 'detail-b', startMinute: 60, endMinute: 180, tone: 'amber' },
          ],
        },
        {
          id: 'overview-lane',
          label: 'Overview lane',
          mode: 'overview',
          items: [
            {
              id: 'cluster-root',
              clusterId: 'rush',
              startMinute: 240,
              endMinute: 420,
              tone: 'emerald',
              detailItems: [
                { id: 'rush-a', startMinute: 240, endMinute: 300, tone: 'emerald' },
                { id: 'rush-b', startMinute: 240, endMinute: 300, tone: 'rose' },
              ],
            },
            { id: 'later', startMinute: 600, endMinute: 720, label: 'Later', tone: 'cyan' },
          ],
        },
      ],
    },
  });

  const detailedLabels = timeline.el.querySelectorAll('.sf-rail-timeline-item--detail')
    .filter((node) => node.dataset.laneId === 'detailed-lane')
    .map((node) => node.textContent.trim());

  assert.deepEqual(detailedLabels, ['Item 1', 'Item 2']);

  timeline.expandCluster('overview-lane', 'rush');

  const expandedLabels = timeline.el.querySelectorAll('.sf-rail-timeline-item--detail')
    .filter((node) => node.dataset.laneId === 'overview-lane')
    .map((node) => node.textContent.trim());

  assert.equal(expandedLabels[0].startsWith('Item 1'), true);
  assert.equal(expandedLabels[1].startsWith('Item 2'), true);
});

test('timeline rejects non-numeric minute inputs instead of coercing them', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  assert.throws(() => {
    SF.rail.createTimeline({
      model: {
        axis: {
          startMinute: '2026-04-20T00:00:00Z',
          endMinute: 7 * 1440,
        },
        lanes: [],
      },
    });
  }, /createTimeline\(model\.axis\.startMinute\) must be a finite number/);

  assert.throws(() => {
    SF.rail.createTimeline({
      model: {
        axis: {
          ...buildAxis(7),
          initialViewport: {
            startMinute: '0',
            endMinute: 7 * 1440,
          },
        },
        lanes: [],
      },
    });
  }, /createTimeline\(model\.axis\.initialViewport\)\.startMinute must be a finite number/);

  assert.throws(() => {
    SF.rail.createTimeline({
      model: {
        axis: buildAxis(7),
        lanes: [
          {
            id: 'employee-e',
            label: 'Employee E',
            mode: 'detailed',
            items: [
              {
                id: 'shift-1',
                startMinute: '2026-04-20T08:00:00Z',
                endMinute: '2026-04-20T16:00:00Z',
                label: 'Shift 1',
                tone: 'amber',
              },
            ],
          },
        ],
      },
    });
  }, /createTimeline\(model\.lanes\[\]\.items\[\]\.startMinute\) must be a finite number/);

  assert.throws(() => {
    SF.rail.createTimeline({
      model: {
        axis: {
          ...buildAxis(7),
          ticks: [{ label: '06:00' }],
        },
        lanes: [],
      },
    });
  }, /createTimeline\(model\.axis\.ticks\[0\]\.minute\) is required/);

  assert.throws(() => {
    SF.rail.createTimeline({
      model: {
        axis: {
          ...buildAxis(7),
          ticks: [{ minute: '360', label: '06:00' }],
        },
        lanes: [],
      },
    });
  }, /createTimeline\(model\.axis\.ticks\[0\]\.minute\) must be a finite number/);

  assert.throws(() => {
    SF.rail.createTimeline({
      model: {
        axis: buildAxis(7),
        lanes: [
          {
            id: 'employee-f',
            label: 'Employee F',
            mode: 'detailed',
            overlays: [
              { startMinute: 60, label: 'Broken overlay', tone: 'red' },
            ],
            items: [
              { id: 'shift-1', startMinute: 60, endMinute: 180, label: 'Shift 1', tone: 'blue' },
            ],
          },
        ],
      },
    });
  }, /createTimeline\(model\.lanes\[\]\.overlays\[0\]\) requires startMinute\/endMinute or dayIndex\/dayCount/);

  assert.throws(() => {
    SF.rail.createTimeline({
      model: {
        axis: buildAxis(7),
        lanes: [
          {
            id: 'employee-f',
            label: 'Employee F',
            mode: 'detailed',
            overlays: [
              { dayIndex: '2', label: 'Unavailable', tone: 'red' },
            ],
            items: [
              { id: 'shift-1', startMinute: 60, endMinute: 180, label: 'Shift 1', tone: 'blue' },
            ],
          },
        ],
      },
    });
  }, /createTimeline\(model\.lanes\[\]\.overlays\[0\]\)\.dayIndex must be a finite number/);

  const timeline = SF.rail.createTimeline({
    model: {
      axis: buildAxis(7),
      lanes: [
        {
          id: 'employee-g',
          label: 'Employee G',
          mode: 'detailed',
          items: [
            { id: 'shift-1', startMinute: 120, endMinute: 300, label: 'Shift 1', tone: 'blue' },
          ],
        },
      ],
    },
  });

  assert.throws(() => {
    timeline.setViewport({
      startMinute: '0',
      endMinute: 1440,
    });
  }, /rail\.createTimeline\(\)\.setViewport\(viewport\)\.startMinute must be a finite number/);
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

test('timeline renders the repeatable dense hospital-like validation scenario', () => {
  const { SF } = loadSf(['js-src/00-core.js', 'js-src/13-rail.js', 'js-src/13a-rail-timeline.js']);

  const denseModel = buildDenseHospitalLikeModel();
  const timeline = SF.rail.createTimeline({ model: denseModel });

  assert.equal(denseModel.lanes.length, 100);
  assert.equal(denseModel.lanes.reduce((sum, lane) => sum + lane.items.length, 0), 1500);
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-row').length, 100);
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--cluster').length > 0, true);
  assert.equal(timeline.el.querySelectorAll('.sf-rail-timeline-item--detail').length > 0, true);
});
