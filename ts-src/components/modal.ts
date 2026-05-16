/* ============================================================================
   SolverForge UI — Modal Factory
   ============================================================================ */

import { assert, el, uid } from "../core";

export interface ModalBodyObject {
  unsafeBody?: string;
  unsafeHtml?: string;
}

export type ModalContent =
  | string
  | Node
  | ModalBodyObject
  | null
  | undefined;

export interface ModalConfig {
  title?: string;
  body?: ModalContent;
  unsafeBody?: string;
  footer?: Node[];
  width?: string;
  onClose?: () => void;
}

export interface ModalApi {
  el: HTMLDivElement;
  body: HTMLDivElement;
  open(): void;
  close(): void;
  setBody(content: ModalContent): void;
}

export const createModal = function (
  config: ModalConfig
): ModalApi {
  assert(config, 'createModal(config) requires a configuration object');
  assert(!config.footer || Array.isArray(config.footer), 'createModal(config.footer) must be an array');

  var overlay = el('div', { className: 'sf-modal-overlay' }) as HTMLDivElement;
  var dialogId = uid('sf-modal');
  var dialog = el('div', {
    className: 'sf-modal',
    id: dialogId,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': dialogId + '-title',
  }) as HTMLDivElement;
  var body = el('div', { className: 'sf-modal-body' }) as HTMLDivElement;

  // Header
  var header = el('div', { className: 'sf-modal-header' });
  var titleEl = el('div', { className: 'sf-modal-title', id: dialogId + '-title' }, config.title || '');
  header.appendChild(titleEl);

  var closeBtn = <HTMLButtonElement>el('button', {
    className: 'sf-modal-close',
    'aria-label': 'Close modal',
    onClick: function () { api.close(); },
  }, '×');
  header.appendChild(closeBtn);

  dialog.appendChild(header);

  // Body
  setBodyContent(body, config.body, config.unsafeBody);
  dialog.appendChild(body);

  // Footer
  if (config.footer) {
    var footer = el('div', { className: 'sf-modal-footer' });
    config.footer.forEach(function (child) {
      footer.appendChild(child);
    });
    dialog.appendChild(footer);
  }

  overlay.appendChild(dialog);

  var previousFocus = null;

  // Close on backdrop click
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) api.close();
  });

  // Close on Escape
  function onKeyDown(e) {
    if (e.key === 'Escape') api.close();
  }

  var api = { el: overlay, body: body } as ModalApi;

  api.open = function () {
    previousFocus = document.activeElement;
    document.body.appendChild(overlay);
    if (closeBtn.focus) closeBtn.focus();
    overlay.classList.add('open');
    document.addEventListener('keydown', onKeyDown);
  };

  api.close = function () {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKeyDown);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    if (config.onClose) config.onClose();
  };

  api.setBody = function (content) {
    setBodyContent(body, content);
  };

  if (config.width) {
    dialog.style.maxWidth = config.width;
  }

  return api;
};

function setBodyContent(target: HTMLElement, content: any, explicitUnsafeHtml?: string) {
  target.textContent = '';
  if (explicitUnsafeHtml != null) {
    target.innerHTML = explicitUnsafeHtml;
  } else if (typeof content === 'string') {
    target.textContent = content;
  } else if (content && content.unsafeBody) {
    target.innerHTML = content.unsafeBody;
  } else if (content && content.unsafeHtml) {
    target.innerHTML = content.unsafeHtml;
  } else if (content instanceof Node) {
    target.appendChild(content);
  }
}
