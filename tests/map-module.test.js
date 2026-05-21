import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

test('map fitBounds uses a Leaflet feature group with bounds support', (t) => {
  const { L, calls } = createLeafletStub();

  // Load sf-map.js which attaches SF.map
  const SF = {};
  globalThis.L = L;
  const mapModuleSource = fs.readFileSync(path.join(ROOT, 'static', 'sf', 'modules', 'sf-map.js'), 'utf8');
  new Function('SF', mapModuleSource).call(null, SF);

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

  t.after(() => {
    delete globalThis.L;
  });
});
