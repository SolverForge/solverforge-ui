/* ============================================================================
   SolverForge UI — Core
   ============================================================================ */

const SF = (function () {
  'use strict';

  const sf = { version: '0.1.0' };

  /* ── Utilities ── */

  sf.escHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  if (typeof window !== 'undefined') window.SF = sf;
  return sf;
})();
