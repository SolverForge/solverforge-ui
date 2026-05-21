import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { createDom } from './fake-dom.js';
import { mockGlobals } from './mock-globals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SF_RUNTIME_PATH = path.join(ROOT, 'static/sf/sf.js');

export function loadSfGlobal(t) {
  const { document, window, Node } = createDom();
  mockGlobals(t, { document, window, Node });

  const source = fs.readFileSync(SF_RUNTIME_PATH, 'utf8');
  const wrapped = `(function(window, document, Node) { ${source}\n return window.SF; })`;
  const factory = vm.runInThisContext(wrapped, { filename: SF_RUNTIME_PATH });
  const SF = factory(window, document, Node);

  return { SF, document, window, Node };
}
