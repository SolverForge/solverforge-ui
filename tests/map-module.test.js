const assert = require('node:assert/strict');
const test = require('node:test');

const { loadSf } = require('./support/load-sf');

function createLeafletStub() {
  const calls = {
    fitBounds: [],
  };

  function createGroup(withBounds) {
    const layers = [];
    const group = {
      addTo() {
        return group;
      },
      addLayer(layer) {
        layers.push(layer);
      },
      clearLayers() {
        layers.length = 0;
      },
      eachLayer(callback) {
        layers.forEach(callback);
      },
    };

    if (withBounds) {
      group.getBounds = function () {
        return {
          isValid() {
            return layers.length > 0;
          },
        };
      };
    }

    return group;
  }

  const L = {
    map() {
      return {
        setView() {
          return this;
        },
        fitBounds(bounds, options) {
          calls.fitBounds.push({ bounds, options });
        },
      };
    },
    tileLayer() {
      return {
        addTo() {
          return this;
        },
      };
    },
    featureGroup() {
      return createGroup(true);
    },
    layerGroup() {
      return createGroup(false);
    },
    divIcon(options) {
      return options;
    },
    marker(latLng, options) {
      return { latLng, options };
    },
    polyline(points, options) {
      return {
        points,
        options,
        setStyle(style) {
          Object.assign(options, style);
        },
      };
    },
  };

  return { L, calls };
}

test('map fitBounds uses a Leaflet feature group with bounds support', () => {
  const { L, calls } = createLeafletStub();
  const { SF } = loadSf(['js-src/00-core.js', 'static/sf/modules/sf-map.js'], { L });

  const map = SF.map.create({
    container: 'map',
    center: [39.9526, -75.1652],
    zoom: 12,
  });
  map.addVehicleMarker({ lat: 39.9526, lng: -75.1652 });

  assert.doesNotThrow(() => map.fitBounds());
  assert.equal(calls.fitBounds.length, 1);
  assert.equal(calls.fitBounds[0].options.padding[0], 30);
  assert.equal(calls.fitBounds[0].options.padding[1], 30);
});

/* ── drawRouteLegs (composite route scenes) ──
   Node tests run against the fake DOM, which has no SVG geometry API. The path
   double below parses the `d` attribute and interpolates linearly so planner
   logic (shared-edge classification, global phase, culls, pass order,
   teardown) is testable here. Real SVG rendering is verified in Chromium by
   tests/demo-browser-check.js, never by this double. */

const { createDom } = require('./support/fake-dom');

function installPathDouble(document) {
  const original = document.createElementNS.bind(document);
  document.createElementNS = function (namespaceURI, tagName) {
    const element = original(namespaceURI, tagName);
    if (tagName !== 'path') return element;
    let segments = [];
    let parsed = '';
    function parse() {
      const d = element.attributes.d || '';
      if (d === parsed) return;
      parsed = d;
      segments = [];
      const commands = d.match(/[ML][^ML]*/g) || [];
      let from = null;
      commands.forEach((command) => {
        const numbers = command.slice(1).trim().split(/[\s,]+/).map(Number);
        const point = { x: numbers[0], y: numbers[1] };
        if (from !== null) {
          segments.push({
            from,
            to: point,
            length: Math.hypot(point.x - from.x, point.y - from.y),
          });
        }
        from = point;
      });
    }
    element.getTotalLength = function () {
      parse();
      return segments.reduce((total, segment) => total + segment.length, 0);
    };
    element.getPointAtLength = function (distance) {
      parse();
      const total = segments.reduce((sum, segment) => sum + segment.length, 0);
      let remaining = Math.max(0, Math.min(distance, total));
      for (const segment of segments) {
        if (remaining <= segment.length) {
          const ratio = segment.length === 0 ? 0 : remaining / segment.length;
          return {
            x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
            y: segment.from.y + (segment.to.y - segment.from.y) * ratio,
          };
        }
        remaining -= segment.length;
      }
      return segments.length ? segments[segments.length - 1].to : { x: 0, y: 0 };
    };
    return element;
  };
}

function createPaintStub() {
  const { document, window } = createDom();
  installPathDouble(document);
  const pane = document.createElement('div');
  const panes = { overlayPane: pane };
  const listeners = new Map();
  const groups = [];

  function createGroup() {
    const layers = [];
    return {
      addTo() { return this; },
      addLayer(layer) { layers.push(layer); },
      clearLayers() { layers.length = 0; },
      eachLayer(callback) { layers.slice().forEach(callback); },
      getLayers() { return layers.slice(); },
      getBounds() {
        return { isValid() { return layers.length > 0; } };
      },
    };
  }

  const L = {
    DomUtil: {
      setPosition(element, point) {
        element.style.left = point.x;
        element.style.top = point.y;
      },
    },
    featureGroup() { return createGroup(); },
    layerGroup() { return createGroup(); },
    divIcon(options) { return options; },
    marker(latLng, options) {
      const normalized = { lat: latLng[0], lng: latLng[1] };
      return { latLng: normalized, options, getLatLng() { return normalized; } };
    },
    polyline(points, options) {
      return {
        points,
        options,
        setStyle(style) { Object.assign(options, style); },
      };
    },
    tileLayer() { return { addTo() { return this; } }; },
    map() {
      return {
        setView() { return this; },
        fitBounds() {},
        getPanes() { return panes; },
        getSize() { return { x: 1000, y: 700 }; },
        containerPointToLayerPoint(point) { return { x: point[0], y: point[1] }; },
        latLngToLayerPoint(point) {
          return { x: 500 + (point[1] - 9) * 2000, y: 500 - (point[0] - 45) * 2000 };
        },
        on(types, handler) {
          String(types).split(/\s+/).forEach((type) => {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(handler);
          });
        },
        off(types, handler) {
          String(types).split(/\s+/).forEach((type) => {
            if (listeners.has(type)) listeners.get(type).delete(handler);
          });
        },
        fire(type) {
          const handlers = listeners.get(type);
          if (handlers) [...handlers].forEach((handler) => handler({ type }));
        },
      };
    },
  };
  return {
    L, document, window, pane, groups,
    projected(points) {
      return points.map(([lat, lng]) => ({
        x: 500 + (lng - 9) * 2000,
        y: 500 - (lat - 45) * 2000,
      }));
    },
    dString(points) {
      return this.projected(points)
        .map((p, index) => (index ? 'L' : 'M') + p.x + ' ' + p.y)
        .join(' ');
    },
  };
}

function loadMapWithPaint(stub) {
  const map = loadSf(['js-src/00-core.js', 'static/sf/modules/sf-map.js'], {
    L: stub.L, document: stub.document, window: stub.window,
  }).SF.map.create({ container: 'map', center: [45.06, 9.19], zoom: 15 });
  return { map, leaflet: map.map };
}

// Five collinear stops, ~28.3px projected edges with this stub projection.
const FIXTURE_POINTS = [
  [45.06, 9.19], [45.07, 9.20], [45.08, 9.21], [45.09, 9.22], [45.10, 9.23],
];

function arrowElements(pane) {
  const arrows = pane.children[0].children[3]; // definitions, casings, bodies, arrows
  const legs = arrows.children;
  const collected = [];
  for (const leg of legs) {
    for (const glyph of leg.children) collected.push({ leg: leg.attributes['data-leg'], glyph });
  }
  return collected;
}

test('drawRouteLegs draws one shared path per leg in casing, body, mask and sampler', () => {
  const stub = createPaintStub();
  const { map } = loadMapWithPaint(stub);
  const route = map.drawRouteLegs({ legs: [{ points: FIXTURE_POINTS, color: '#1d4f9c' }] });

  assert.ok(route.remove);
  const root = stub.pane.children[0];
  assert.equal(root.tagName, 'SVG');
  assert.equal(root.classList.contains('sf-map-paint'), true);
  assert.deepEqual(
    root.children.filter((child) => child.attributes['data-pass']).map((child) => child.attributes['data-pass']),
    ['all-casings', 'all-bodies', 'all-arrows'],
  );
  const defs = root.children[0];
  const mask = defs.children[0];
  const casing = root.children[1].children[0];
  const body = root.children[2].children[0];
  const expected = stub.dString(FIXTURE_POINTS);
  assert.equal(mask.children[0].attributes.d, expected);
  assert.equal(casing.attributes.d, expected);
  assert.equal(body.attributes.d, expected);
  assert.equal(casing.attributes['stroke-width'], '18');
  assert.equal(body.attributes['stroke-width'], '14');
  assert.equal(mask.children[0].attributes['stroke-width'], '13');
  // The sampler is a hidden path off the document body, never the rendered one.
  assert.equal(stub.document.body.children[0].children[0].attributes.d, expected);
});

test('drawRouteLegs spaces arrows with one global phase per leg', () => {
  const stub = createPaintStub();
  const { map } = loadMapWithPaint(stub);
  map.drawRouteLegs({ legs: [{ points: FIXTURE_POINTS, color: '#1d4f9c' }] });
  const collected = arrowElements(stub.pane);
  // Length 4 edges * ~28.3px = ~113px; arcs 28 and 88 (88 < length - 20), so 2.
  assert.equal(collected.length, 2);
  assert.equal(collected[0].glyph.attributes['data-shared'], 'false');
  assert.equal(collected[0].glyph.attributes['data-width'], '5.2');
  assert.equal(collected[0].glyph.attributes['data-length'], '12');
});

test('drawRouteLegs classifies reverse-shared edges by exact endpoint identity', () => {
  const stub = createPaintStub();
  const { map } = loadMapWithPaint(stub);
  map.drawRouteLegs({
    legs: [
      { points: FIXTURE_POINTS, color: '#1d4f9c' },
      { points: [...FIXTURE_POINTS].reverse(), color: '#2e7cc4' },
    ],
  });
  const collected = arrowElements(stub.pane);
  assert.equal(collected.length, 4);
  for (const entry of collected) {
    assert.equal(entry.glyph.attributes['data-shared'], 'true');
    assert.equal(entry.glyph.attributes['data-width'], '3.3');
  }
  const leg0 = collected.filter((entry) => entry.leg === '0');
  const leg1 = collected.filter((entry) => entry.leg === '1');
  assert.equal(leg0.length, 2);
  assert.equal(leg1.length, 2);
  // The two traversals face opposite directions.
  const leg0Angles = leg0.map((entry) => Number(/rotate\((-?\d+(?:\.\d+)?)\)/.exec(entry.glyph.attributes.transform)[1]));
  const leg1Angles = leg1.map((entry) => Number(/rotate\((-?\d+(?:\.\d+)?)\)/.exec(entry.glyph.attributes.transform)[1]));
  for (let i = 0; i < 2; i++) {
    const difference = Math.abs(leg0Angles[i] - leg1Angles[i]) % 360;
    assert.ok(Math.abs(difference - 180) < 1, `angles ${leg0Angles[i]} vs ${leg1Angles[i]}`);
  }
});

test('drawRouteLegs keeps paint clear of stop markers', () => {
  const stub = createPaintStub();
  const { map } = loadMapWithPaint(stub);
  // The arc-28 sample lands at ~(899.8, 360.2); this marker sits ~5px away.
  map.addStopNumber({ lat: 45.071, lng: 9.202, number: 1, color: '#3b82f6' });
  map.drawRouteLegs({ legs: [{ points: FIXTURE_POINTS, color: '#1d4f9c' }] });
  assert.equal(arrowElements(stub.pane).length, 1);
});

test('drawRouteLegs redraws on map events and hides paint during zoom', async () => {
  const stub = createPaintStub();
  const { map, leaflet } = loadMapWithPaint(stub);
  map.drawRouteLegs({ legs: [{ points: FIXTURE_POINTS, color: '#1d4f9c' }] });
  leaflet.fire('zoomstart');
  assert.equal(stub.pane.children[0].style.visibility, 'hidden');
  leaflet.fire('zoomend');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(stub.pane.children[0].style.visibility, 'visible');
  const before = stub.pane.children[0].children[2].children[0].children.length;
  leaflet.fire('moveend');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(stub.pane.children[0].children[2].children[0].children.length, before);
});

test('drawRouteLegs remove() detaches the scene from the map and its listeners', () => {
  const stub = createPaintStub();
  const { map, leaflet } = loadMapWithPaint(stub);
  const route = map.drawRouteLegs({ legs: [{ points: FIXTURE_POINTS, color: '#1d4f9c' }] });
  assert.equal(stub.pane.children.length, 1);
  route.remove();
  assert.equal(stub.pane.children.length, 0);
  assert.equal(stub.document.body.children.length, 0);
  leaflet.fire('moveend');
  leaflet.fire('zoomstart');
  assert.equal(stub.pane.children.length, 0);
});

test('clearRoutes and clearAll also remove composite route scenes', () => {
  const stub = createPaintStub();
  const { map, leaflet } = loadMapWithPaint(stub);
  map.drawRouteLegs({ legs: [{ points: FIXTURE_POINTS, color: '#1d4f9c' }] });
  map.clearRoutes();
  assert.equal(stub.pane.children.length, 0);
  leaflet.fire('moveend');
  assert.equal(stub.pane.children.length, 0);

  map.drawRouteLegs({ legs: [{ points: FIXTURE_POINTS, color: '#1d4f9c' }] });
  map.clearAll();
  assert.equal(stub.pane.children.length, 0);
  leaflet.fire('resize');
  assert.equal(stub.pane.children.length, 0);
});

test('drawRouteLegs rejects malformed input without drawing', () => {
  const stub = createPaintStub();
  const { map } = loadMapWithPaint(stub);
  assert.throws(() => map.drawRouteLegs({}));
  assert.throws(() => map.drawRouteLegs({ legs: [{}] }));
  assert.throws(() => map.drawRouteLegs({ legs: [{ points: [[45.06, 'x'], [45.07, 9.2]] }] }));
  assert.throws(() => map.drawRouteLegs({ legs: [{ points: [[45.06, 9.19]] }] }));
  assert.equal(stub.pane.children.length, 0);
});
