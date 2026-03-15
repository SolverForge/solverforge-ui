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

  /* ── Map factory ── */
  sf.map.create = function (config) {
    var map = L.map(config.container, {
      doubleClickZoom: false,
    }).setView(config.center || [51.505, -0.09], config.zoom || 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    var markerGroup = L.layerGroup().addTo(map);
    var routeGroup = L.layerGroup().addTo(map);
    var stopGroup = L.layerGroup().addTo(map);

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

    ctrl.clearRoutes = function () {
      routeGroup.clearLayers();
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
