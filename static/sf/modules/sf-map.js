/* ============================================================================
   SolverForge UI — Map Module
   Leaflet wrapper for vehicle routing and location-based scheduling.
   Requires: Leaflet loaded globally (L).
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.map = {};

  /* ── Polyline decoder (Google Encoded Polyline Algorithm) ── */
  sf.map.decodePolyline = function (encoded) {
    var points = [];
    var index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      var b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);

      shift = 0; result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  };

  /* ── Road paint (direction arrows along routed road geometry) ──
     Screen-space paint over an owned Leaflet overlay. Every drawn element
     (casing, body, paint mask, arrow sampler) reuses one path string per leg,
     so paint can never drift off the road geometry. Opposing flows on the
     same graph edge are classified by exact endpoint identity and painted in
     opposite interior half-lanes of the same centered ribbon. */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var routeSceneCounter = 0;

  var ROUTE_PAINT_DEFAULTS = {
    weight: 14,            // body stroke width, screen pixels
    spacing: 60,           // arc distance between arrow centers, per leg
    length: 12,            // arrow glyph length, screen pixels
    sharedOffset: 3.6,     // travel-right half-lane offset on reverse-shared edges
    sharedWidth: 3.3,      // arrow width on reverse-shared edges
    arrowWidth: 5.2,       // arrow width on unshared edges
    markerClearance: 26,   // keep paint away from stop markers
    casingColor: '#f6f8fa'
  };

  function paintElement(tag, attrs, parent) {
    var element = document.createElementNS(SVG_NS, tag);
    for (var name in attrs) element.setAttribute(name, String(attrs[name]));
    if (parent) parent.appendChild(element);
    return element;
  }

  function paintKey(point) {
    return point[0] + ',' + point[1];
  }

  function paintEdgeKey(a, b) {
    var first = paintKey(a), second = paintKey(b);
    return first < second ? first + '|' + second : second + '|' + first;
  }

  function paintRectsOverlap(a, b) {
    var polygons = [a, b];
    for (var polyIndex = 0; polyIndex < polygons.length; polyIndex++) {
      var poly = polygons[polyIndex];
      for (var i = 0; i < 4; i++) {
        var corner = poly[i], next = poly[(i + 1) % 4];
        var axis = { x: -(next.y - corner.y), y: next.x - corner.x };
        var aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity, j;
        for (j = 0; j < 4; j++) {
          var projection = poly[j].x * axis.x + poly[j].y * axis.y;
          if (projection < aMin) aMin = projection;
          if (projection > aMax) aMax = projection;
        }
        for (j = 0; j < 4; j++) {
          var other = polygons[(polyIndex + 1) % 2][j];
          var otherProjection = other.x * axis.x + other.y * axis.y;
          if (otherProjection < bMin) bMin = otherProjection;
          if (otherProjection > bMax) bMax = otherProjection;
        }
        if (aMax < bMin || bMax < aMin) return false;
      }
    }
    return true;
  }

  /* ── Map factory ── */
  sf.map.create = function (config) {
    var map = L.map(config.container, {
      doubleClickZoom: false,
    }).setView(config.center || [51.505, -0.09], config.zoom || 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    var markerGroup = L.featureGroup().addTo(map);
    var routeGroup = L.layerGroup().addTo(map);
    var stopGroup = L.layerGroup().addTo(map);
    var routeScenes = [];
    var measureRoot = null;

    var ctrl = {};

    ctrl.map = map;

    ctrl.addVehicleMarker = function (opts) {
      var color = opts.color || '#10b981';
      var icon = L.divIcon({
        className: '',
        html: '<div class="sf-marker-vehicle" style="background:' + color + '"><i class="fa-solid fa-truck"></i></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      var m = L.marker([opts.lat, opts.lng], { icon: icon });
      markerGroup.addLayer(m);
      return m;
    };

    ctrl.addVisitMarker = function (opts) {
      var color = opts.color || '#10b981';
      var faIcon = opts.icon || 'fa-location-dot';
      var assigned = opts.assigned !== false;
      var cls = 'sf-marker-visit' + (assigned ? ' assigned' : ' unassigned');
      var borderColor = assigned ? color : '#9ca3af';
      var textColor = assigned ? color : '#9ca3af';
      var icon = L.divIcon({
        className: '',
        html: '<div class="' + cls + '" style="border-color:' + borderColor + ';color:' + textColor + '"><i class="fa-solid ' + faIcon + '"></i></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      var m = L.marker([opts.lat, opts.lng], { icon: icon });
      markerGroup.addLayer(m);
      return m;
    };

    ctrl.addStopNumber = function (opts) {
      var color = opts.color || '#10b981';
      var icon = L.divIcon({
        className: '',
        html: '<div class="sf-marker-stop" style="border-color:' + color + ';color:' + color + '">' + opts.number + '</div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      var m = L.marker([opts.lat, opts.lng], { icon: icon });
      stopGroup.addLayer(m);
      return m;
    };

    ctrl.drawRoute = function (opts) {
      var points = opts.points;
      var color = opts.color || '#10b981';
      var weight = opts.weight || 3;
      var opacity = opts.opacity || 0.8;
      var line = L.polyline(points, { color: color, weight: weight, opacity: opacity });
      routeGroup.addLayer(line);
      return line;
    };

    ctrl.drawEncodedRoute = function (opts) {
      var points = sf.map.decodePolyline(opts.encoded);
      return ctrl.drawRoute({
        points: points,
        color: opts.color,
        weight: opts.weight,
        opacity: opts.opacity,
      });
    };

    /* Draws ordered road legs as one composite scene: a shared casing pass, one
       centered body per leg, and travel-direction arrow paint inside each
       body's own mask. Shared classification and all paint geometry stay
       private to this module; callers pass ordered legs and options only.
       Returns an opaque handle with remove(). */
    ctrl.drawRouteLegs = function (opts) {
      if (!opts || !Array.isArray(opts.legs)) throw new Error('drawRouteLegs requires a legs array');
      var sceneLegs = [];
      opts.legs.forEach(function (leg) {
        if (!leg || !Array.isArray(leg.points)) throw new Error('drawRouteLegs requires legs[].points arrays');
        var points = [];
        leg.points.forEach(function (point) {
          if (!Array.isArray(point) || point.length < 2 || !isFinite(point[0]) || !isFinite(point[1])) {
            throw new Error('drawRouteLegs requires finite [lat, lng] pairs in legs[].points');
          }
          points.push([point[0], point[1]]);
        });
        if (points.length < 2) throw new Error('drawRouteLegs requires at least two points per leg');
        sceneLegs.push({ points: points, color: leg.color || '#10b981' });
      });
      if (!sceneLegs.length) throw new Error('drawRouteLegs requires at least one leg');
      return createRouteScene(sceneLegs, opts);
    };

    function createRouteScene(legs, opts) {
      var defaults = ROUTE_PAINT_DEFAULTS;
      var weight = typeof opts.weight === 'number' && isFinite(opts.weight) && opts.weight > 0
        ? opts.weight : defaults.weight;
      var paintOptions = opts.directionPaint || {};
      function numberOption(name, fallback) {
        var value = paintOptions[name];
        return typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;
      }
      var paint = {
        enabled: paintOptions.enabled !== false,
        spacing: numberOption('spacing', defaults.spacing),
        length: numberOption('length', defaults.length),
        sharedOffset: paintOptions.sharedOffset !== undefined ? paintOptions.sharedOffset : defaults.sharedOffset,
        sharedWidth: paintOptions.sharedWidth !== undefined ? paintOptions.sharedWidth : defaults.sharedWidth,
        arrowWidth: paintOptions.arrowWidth !== undefined ? paintOptions.arrowWidth : defaults.arrowWidth,
        markerClearance: paintOptions.markerClearance !== undefined ? paintOptions.markerClearance : defaults.markerClearance
      };
      var sampleSpan = paint.length * 0.75;
      var startInset = paint.length + 16;
      var endInset = 20;
      var headShaftInset = paint.length / 12;

      var scene = { removed: false, raf: null, api: null };
      var sceneId = ++routeSceneCounter;
      var root = paintElement('svg', { class: 'sf-map-paint' }, map.getPanes().overlayPane);
      root.style.visibility = 'hidden';

      function ensureMeasure() {
        if (!measureRoot) {
          measureRoot = paintElement('svg', { width: 0, height: 0, style: 'position:absolute;visibility:hidden' },
            document.body || document.documentElement);
        }
        return measureRoot;
      }

      function clearChildren(element) {
        while (element.firstChild) element.removeChild(element.firstChild);
      }

      function requestFrame(callback) {
        if (typeof window !== 'undefined' && window.requestAnimationFrame) return window.requestAnimationFrame(callback);
        return setTimeout(callback, 0);
      }

      function cancelFrame(handle) {
        if (typeof window !== 'undefined' && window.cancelAnimationFrame) window.cancelAnimationFrame(handle);
        else clearTimeout(handle);
      }

      function hideDuringZoom() {
        root.style.visibility = 'hidden';
      }

      function scheduleDraw() {
        if (scene.removed || scene.raf !== null) return;
        scene.raf = requestFrame(function () {
          if (scene.removed) return;
          scene.raf = null;
          draw();
        });
      }

      function draw() {
        if (scene.removed) return;
        if (scene.raf !== null) { cancelFrame(scene.raf); scene.raf = null; }

        var topLeft = map.containerPointToLayerPoint([0, 0]);
        var size = map.getSize();
        L.DomUtil.setPosition(root, topLeft);
        root.setAttribute('width', size.x);
        root.setAttribute('height', size.y);
        root.setAttribute('viewBox', topLeft.x + ' ' + topLeft.y + ' ' + size.x + ' ' + size.y);
        clearChildren(root);

        var measure = ensureMeasure();
        clearChildren(measure);

        function edgeIndexAt(cumulative, distance) {
          var low = 1, high = cumulative.length - 1;
          while (low < high) {
            var mid = (low + high) >> 1;
            if (cumulative[mid] < distance) low = mid + 1; else high = mid;
          }
          return low - 1;
        }

        var defs = paintElement('defs', {}, root);
        var casings = paintElement('g', { 'data-pass': 'all-casings' }, root);
        var bodies = paintElement('g', { 'data-pass': 'all-bodies' }, root);
        var arrowsGroup = paintElement('g', { 'data-pass': 'all-arrows' }, root);

        // Traversed twice in opposite directions? Exact endpoint identity only:
        // no rounding, no proximity joins, no invented correspondences.
        var edgeDirections = new Map();
        legs.forEach(function (leg) {
          for (var i = 1; i < leg.points.length; i++) {
            var a = leg.points[i - 1], b = leg.points[i];
            if (paintKey(a) === paintKey(b)) continue;
            var key = paintEdgeKey(a, b);
            var directions = edgeDirections.get(key);
            if (!directions) { directions = new Set(); edgeDirections.set(key, directions); }
            directions.add(paintKey(a) < paintKey(b) ? '0' : '1');
          }
        });
        var shared = new Set();
        edgeDirections.forEach(function (directions, key) {
          if (directions.size === 2) shared.add(key);
        });

        // Registered stop markers define the no-paint clearance zone.
        var markerPoints = [];
        stopGroup.getLayers().forEach(function (layer) {
          if (layer && layer.getLatLng) {
            var latLng = layer.getLatLng();
            markerPoints.push(map.latLngToLayerPoint([latLng.lat, latLng.lng]));
          }
        });

        var occupied = [];
        legs.forEach(function (leg, legIndex) {
          var points = leg.points.map(function (point) { return map.latLngToLayerPoint(point); });
          var d = points.map(function (p, index) { return (index ? 'L' : 'M') + p.x + ' ' + p.y; }).join(' ');
          var cumulative = [0];
          for (var i = 1; i < points.length; i++) {
            var dx = points[i].x - points[i - 1].x;
            var dy = points[i].y - points[i - 1].y;
            cumulative.push(cumulative[cumulative.length - 1] + Math.sqrt(dx * dx + dy * dy));
          }

          // The sampler lives on a hidden twin so nothing can drift between
          // what is measured and what is drawn.
          var measurePath = paintElement('path', { d: d }, measure);
          var length = measurePath.getTotalLength();
          var maskId = 'sf-map-route-' + sceneId + '-leg-' + legIndex;
          var mask = paintElement('mask', {
            id: maskId,
            maskUnits: 'userSpaceOnUse',
            x: topLeft.x,
            y: topLeft.y,
            width: size.x,
            height: size.y,
          }, defs);
          paintElement('path', {
            d: d,
            fill: 'none',
            stroke: 'white',
            'stroke-width': Math.max(weight - 1, 1),
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          }, mask);
          paintElement('path', {
            d: d,
            fill: 'none',
            stroke: defaults.casingColor,
            'stroke-width': weight + 4,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          }, casings);
          paintElement('path', {
            d: d,
            fill: 'none',
            stroke: leg.color,
            'stroke-width': weight,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          }, bodies);
          // A stroked path cannot clip; the mask keeps every glyph on its road.
          var legArrows = paint.enabled
            ? paintElement('g', { mask: 'url(#' + maskId + ')', 'data-leg': legIndex }, arrowsGroup)
            : null;

          function isSharedAt(distance) {
            var index = edgeIndexAt(cumulative, distance);
            return shared.has(paintEdgeKey(leg.points[index], leg.points[index + 1]));
          }

          // One global phase per leg. Viewport culling only decides which slots
          // are worth sampling; accepted positions never move.
          // Never restart on a graph vertex — that is where bunching was born.
          var slots = [];
          for (var segment = 1; segment < points.length; segment++) {
            var start = points[segment - 1], end = points[segment];
            if (Math.max(start.x, end.x) < topLeft.x - endInset || Math.min(start.x, end.x) > topLeft.x + size.x + endInset ||
                Math.max(start.y, end.y) < topLeft.y - endInset || Math.min(start.y, end.y) > topLeft.y + size.y + endInset) continue;
            var firstSlot = Math.max(0, Math.ceil((cumulative[segment - 1] - startInset) / paint.spacing));
            var lastSlot = Math.floor((cumulative[segment] - startInset) / paint.spacing);
            for (var slot = firstSlot; slot <= lastSlot; slot++) {
              if (slots.indexOf(slot) === -1) slots.push(slot);
            }
          }
          slots.sort(function (a, b) { return a - b; });

          for (var step = 0; step < slots.length; step++) {
            var arc = startInset + slots[step] * paint.spacing;
            if (arc >= length - endInset) continue;
            var point = measurePath.getPointAtLength(arc);
            if (point.x < topLeft.x - endInset || point.x > topLeft.x + size.x + endInset ||
                point.y < topLeft.y - endInset || point.y > topLeft.y + size.y + endInset) continue;

            var back = measurePath.getPointAtLength(Math.max(0, arc - sampleSpan));
            var forward = measurePath.getPointAtLength(Math.min(length, arc + sampleSpan));
            var approach = { x: point.x - back.x, y: point.y - back.y };
            var departure = { x: forward.x - point.x, y: forward.y - point.y };
            var approachLength = Math.sqrt(approach.x * approach.x + approach.y * approach.y);
            var departureLength = Math.sqrt(departure.x * departure.x + departure.y * departure.y);
            if (approachLength < sampleSpan * 0.86 || departureLength < sampleSpan * 0.86) continue;
            if ((approach.x * departure.x + approach.y * departure.y) / (approachLength * departureLength)
                < Math.cos(18 * Math.PI / 180)) continue;   // turn too sharp to keep one glyph
            var sharedHere = isSharedAt(arc);
            if (isSharedAt(Math.max(0, arc - sampleSpan)) !== sharedHere ||
                isSharedAt(Math.min(length, arc + sampleSpan)) !== sharedHere) continue;   // seam: each side paints on its own pass

            var before = measurePath.getPointAtLength(Math.max(0, arc - paint.length / 3));
            var after = measurePath.getPointAtLength(Math.min(length, arc + paint.length / 3));
            var headingX = after.x - before.x, headingY = after.y - before.y;
            var headingLength = Math.sqrt(headingX * headingX + headingY * headingY);
            if (headingLength < 1) continue;   // zero-length tangent after a seam guard
            var ux = headingX / headingLength, uy = headingY / headingLength;
            var nx = -uy, ny = ux;

            // Paint shifts into the travel-right interior half-lane on shared
            // edges only. The road geometry itself is never offset.
            var offset = sharedHere ? paint.sharedOffset : 0;
            var arrowWidth = sharedHere ? paint.sharedWidth : paint.arrowWidth;
            var center = { x: point.x + nx * offset, y: point.y + ny * offset };

            var blocked = false;
            for (var m = 0; m < markerPoints.length; m++) {
              if (Math.hypot(markerPoints[m].x - center.x, markerPoints[m].y - center.y) < paint.markerClearance) {
                blocked = true;
                break;
              }
            }
            if (blocked) continue;
            var rectHalfLength = paint.length / 2 + 3;
            var pad = arrowWidth / 2 + 1.1;
            var rect = [
              [-rectHalfLength, -pad],
              [rectHalfLength, -pad],
              [rectHalfLength, pad],
              [-rectHalfLength, pad],
            ].map(function (extent) {
              return {
                x: center.x + ux * extent[0] + nx * extent[1],
                y: center.y + uy * extent[0] + ny * extent[1],
              };
            });
            for (var r = 0; r < occupied.length; r++) {
              if (paintRectsOverlap(occupied[r], rect)) { blocked = true; break; }
            }
            if (blocked) continue;
            occupied.push(rect);

            var angle = Math.atan2(headingY, headingX) * 180 / Math.PI;
            var halfLength = paint.length / 2;
            var stem = arrowWidth * 0.22;
            var glyph = 'M ' + (-halfLength) + ' ' + (-stem) +
              ' L ' + headShaftInset + ' ' + (-stem) +
              ' L ' + headShaftInset + ' ' + (-arrowWidth / 2) +
              ' L ' + halfLength + ' 0' +
              ' L ' + headShaftInset + ' ' + (arrowWidth / 2) +
              ' L ' + headShaftInset + ' ' + stem +
              ' L ' + (-halfLength) + ' ' + stem + ' Z';
            var fill = sharedHere ? (legIndex % 2 ? '#ffd982' : '#ffffff') : '#ffffff';
            paintElement('path', {
              d: glyph,
              fill: fill,
              transform: 'translate(' + center.x + ' ' + center.y + ') rotate(' + angle + ')',
              'data-shared': sharedHere,
              'data-length': paint.length,
              'data-width': arrowWidth,
            }, legArrows);
          }
        });

        root.style.visibility = 'visible';
      }

      map.on('zoomstart', hideDuringZoom);
      map.on('moveend zoomend resize', scheduleDraw);

      function teardown() {
        if (scene.removed) return;
        scene.removed = true;
        map.off('zoomstart', hideDuringZoom);
        map.off('moveend zoomend resize', scheduleDraw);
        if (scene.raf !== null) { cancelFrame(scene.raf); scene.raf = null; }
        if (root.parentNode) root.parentNode.removeChild(root);
        var sceneIndex = routeScenes.indexOf(scene);
        if (sceneIndex !== -1) routeScenes.splice(sceneIndex, 1);
        if (measureRoot && !routeScenes.length && measureRoot.parentNode) {
          measureRoot.parentNode.removeChild(measureRoot);
          measureRoot = null;
        }
      }

      scene.api = { remove: teardown, draw: draw };
      routeScenes.push(scene);
      draw();
      return scene.api;
    };

    ctrl.clearRoutes = function () {
      routeGroup.clearLayers();
      routeScenes.slice().forEach(function (scene) { scene.api.remove(); });
    };

    ctrl.clearStops = function () {
      stopGroup.clearLayers();
    };

    ctrl.clearMarkers = function () {
      markerGroup.clearLayers();
    };

    ctrl.clearAll = function () {
      markerGroup.clearLayers();
      routeGroup.clearLayers();
      stopGroup.clearLayers();
      routeScenes.slice().forEach(function (scene) { scene.api.remove(); });
    };

    ctrl.fitBounds = function () {
      var bounds = markerGroup.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    };

    ctrl.highlight = function (vehicleColor) {
      routeGroup.eachLayer(function (layer) {
        if (layer.options && layer.options.color === vehicleColor) {
          layer.setStyle({ weight: 5, opacity: 1 });
        } else {
          layer.setStyle({ weight: 2, opacity: 0.2 });
        }
      });
    };

    ctrl.clearHighlight = function () {
      routeGroup.eachLayer(function (layer) {
        if (layer.setStyle) {
          layer.setStyle({ weight: 3, opacity: 0.8 });
        }
      });
    };

    return ctrl;
  };

})(SF);

/* Changes to this module are synchronized across README.md, WIREFRAME.md,
   the solverforge-cli skill, tests, and demos. */
