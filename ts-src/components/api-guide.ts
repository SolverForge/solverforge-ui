/* ============================================================================
   SolverForge UI — API Guide Panel
   Generates REST API documentation from endpoint definitions.
   ============================================================================ */
import {assert, el} from "../core";

export const createApiGuide = function (config) {
    assert(config, 'createApiGuide(config) requires a configuration object');
    assert(Array.isArray(config.endpoints), 'createApiGuide(config.endpoints) must be an array');

    var guide = el('div', { className: 'sf-api-guide' });
    var endpoints = config.endpoints;

    endpoints.forEach(function (ep) {
      var section = el('div', { className: 'sf-api-section' });
      section.appendChild(el('h3', null, (ep.method || 'GET') + ' ' + ep.path));
      if (ep.description) {
        section.appendChild(el('p', { style: { fontSize: '13px', color: 'var(--sf-gray-600)', marginBottom: '8px' } }, ep.description));
      }

      if (ep.curl) {
        var block = el('div', { className: 'sf-api-code-block' });
        block.appendChild(el('code', null, ep.curl));
        var copyBtn = el('button', {
          className: 'sf-copy-btn',
          'aria-label': 'Copy command',
          onClick: function () {
            navigator.clipboard.writeText(ep.curl).then(function () {
              copyBtn.textContent = 'Copied!';
              setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
            });
          },
        }, 'Copy');
        block.appendChild(copyBtn);
        section.appendChild(block);
      }

      guide.appendChild(section);
    });

    return guide;
  };
