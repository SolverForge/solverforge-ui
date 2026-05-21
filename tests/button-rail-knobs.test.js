import assert from 'node:assert/strict';
import test from 'node:test';
import { createButton, rail } from '../static/sf/sf.mjs';
import { createDom } from './support/fake-dom.js';
import { mockGlobals } from './support/mock-globals.js';

test('iconOnly buttons keep an accessible label without rendering text content', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const button = createButton({
    text: 'Settings',
    icon: 'fa-gear',
    iconOnly: true,
  });

  assert.equal(button.textContent, '');
  assert.equal(button.attributes['aria-label'], 'Settings');
});

test('rail card badges accept a single string badge and preserve heatmap alignment', (t) => {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const card = rail.createCard({
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
