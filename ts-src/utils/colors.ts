/* ============================================================================
   SolverForge UI — Color Factory
   Tango palette + project color assignment.
   ============================================================================ */

(function (sf) {
  'use strict';

  var SEQUENCE_1 = [0x8AE234, 0xFCE94F, 0x729FCF, 0xE9B96E, 0xAD7FA8];
  var SEQUENCE_2 = [0x73D216, 0xEDD400, 0x3465A4, 0xC17D11, 0x75507B];

  var colorMap = {};
  var nextColorCount = 0;

  function buildPercentageColor(floor, ceil, pct) {
    var red   = (floor & 0xFF0000) + Math.floor(pct * ((ceil & 0xFF0000) - (floor & 0xFF0000))) & 0xFF0000;
    var green = (floor & 0x00FF00) + Math.floor(pct * ((ceil & 0x00FF00) - (floor & 0x00FF00))) & 0x00FF00;
    var blue  = (floor & 0x0000FF) + Math.floor(pct * ((ceil & 0x0000FF) - (floor & 0x0000FF))) & 0x0000FF;
    return red | green | blue;
  }

  function nextColor() {
    var colorIndex = nextColorCount % SEQUENCE_1.length;
    var shadeIndex = Math.floor(nextColorCount / SEQUENCE_1.length);
    var color;
    if (shadeIndex === 0) {
      color = SEQUENCE_1[colorIndex];
    } else if (shadeIndex === 1) {
      color = SEQUENCE_2[colorIndex];
    } else {
      shadeIndex -= 3;
      var base = Math.floor((shadeIndex / 2) + 1);
      var divisor = 2;
      while (base >= divisor) divisor *= 2;
      base = (base * 2) - divisor + 1;
      color = buildPercentageColor(SEQUENCE_2[colorIndex], SEQUENCE_1[colorIndex], base / divisor);
    }
    nextColorCount++;
    return '#' + color.toString(16).padStart(6, '0');
  }

  sf.colors = {};

  sf.colors.pick = function (key) {
    if (colorMap[key] !== undefined) return colorMap[key];
    var c = nextColor();
    colorMap[key] = c;
    return c;
  };

  sf.colors.reset = function () {
    colorMap = {};
    nextColorCount = 0;
  };

  var PROJECT_COLORS = [
    { main: '#10b981', dark: '#047857', light: 'rgba(16,185,129,0.15)' },
    { main: '#3b82f6', dark: '#1d4ed8', light: 'rgba(59,130,246,0.15)' },
    { main: '#8b5cf6', dark: '#6d28d9', light: 'rgba(139,92,246,0.15)' },
    { main: '#f59e0b', dark: '#b45309', light: 'rgba(245,158,11,0.15)' },
    { main: '#ec4899', dark: '#be185d', light: 'rgba(236,72,153,0.15)' },
    { main: '#06b6d4', dark: '#0e7490', light: 'rgba(6,182,212,0.15)' },
    { main: '#f43f5e', dark: '#be123c', light: 'rgba(244,63,94,0.15)' },
    { main: '#84cc16', dark: '#4d7c0f', light: 'rgba(132,204,22,0.15)' },
  ];

  sf.colors.project = function (index) {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
  };

})(SF);
