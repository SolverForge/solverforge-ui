/* ============================================================================
   SolverForge UI — Core
   ============================================================================ */

const SF = (function () {
  'use strict';

  const sf = { version: '0.6.4' };
  var uidCounter = 0;

  /* ── Utilities ── */

  sf.escHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  sf.assert = function (cond, message) {
    if (!cond) throw new Error('[SolverForge] ' + message);
  };

  sf.normalizeCreateJobId = function (raw) {
    var value = raw;
    if (value && typeof value === 'object') {
      if (value.id != null) value = value.id;
      else if (value.jobId != null) value = value.jobId;
      else if (value.job_id != null) value = value.job_id;
      else if (value.data && typeof value.data === 'object' && value.data.id != null) value = value.data.id;
      else return '';
    }

    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim();
    return '';
  };

  sf.el = function (tag, attrs) {
    var children = Array.prototype.slice.call(arguments, 2);
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') el.className = attrs[key];
        else if (key === 'style' && typeof attrs[key] === 'object') {
          Object.assign(el.style, attrs[key]);
        }
        else if (key.indexOf('on') === 0) el.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
        else if (key === 'dataset') Object.assign(el.dataset, attrs[key]);
        else if (key === 'html') el.textContent = attrs[key];
        else if (key === 'unsafeHtml') el.innerHTML = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    children.forEach(function (child) {
      if (child == null) return;
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child instanceof Node) el.appendChild(child);
    });
    return el;
  };

  sf.uid = function (prefix) {
    uidCounter += 1;
    return (prefix || 'sf') + '-' + uidCounter;
  };

  sf.bindActivation = function (el, onActivate) {
    if (!el || typeof onActivate !== 'function') return;

    function handleActivate(e) {
      if (!e || e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      onActivate(e);
    }

    el.addEventListener('click', handleActivate);
    el.addEventListener('keydown', handleActivate);
  };

  if (typeof window !== 'undefined') window.SF = sf;
  return sf;
})();
