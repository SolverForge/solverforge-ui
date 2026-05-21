/* ============================================================================
   SolverForge UI — Core
   ============================================================================ */

export const version = '0.6.5';

let uidCounter = 0;

/* ── Utilities ── */

export const escHtml = function (str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

export const assert = function (cond, message) {
  if (!cond) throw new Error('[SolverForge] ' + message);
};

export const normalizeCreateJobId = function (raw) {
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

export const el = function (
  tag: string,
  attrs: Record<string, unknown> | null = {},
  ...children: (string | Node | null | undefined)[]
): HTMLElement {
  var el: HTMLElement = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (key === 'className') el.className = value as string;
      else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value as Partial<CSSStyleDeclaration>);
      }
      else if (key.indexOf('on') === 0) {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      }
      else if (key === 'dataset') Object.assign(el.dataset, value as Record<string, string>);
      else if (key === 'html') el.textContent = value as string;
      else if (key === 'unsafeHtml') el.innerHTML = value as string;
      else el.setAttribute(key, value as string);
    });
  }
  children.forEach(function (child) {
    if (child == null) return;
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  return el;
};

export const uid = function (prefix) {
  uidCounter += 1;
  return (prefix || 'sf') + '-' + uidCounter;
};

export const bindActivation = function (el, onActivate) {
  if (!el || typeof onActivate !== 'function') return;

  function handleActivate(e) {
    if (!e || e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    onActivate(e);
  }

  el.addEventListener('click', handleActivate);
  el.addEventListener('keydown', handleActivate);
};
