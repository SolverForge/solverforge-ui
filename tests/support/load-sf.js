import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createDom } from './fake-dom.js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const STATIC_DIR = path.resolve(ROOT, 'static', 'sf');
const SF_LIB = "sf.js";

function loadSf(files = [], overrides = {}) {
  const { document, window, Node } = createDom();
  const context = vm.createContext({
    console,
    document,
    window,
    Node,
    setTimeout,
    clearTimeout,
    Promise,
    ...overrides,
  });

  // inject sf.js
  const source = fs.readFileSync(path.join(STATIC_DIR, SF_LIB), 'utf8');
  vm.runInContext(source, context, { filename: SF_LIB });

  // additional files
  files.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });

  // SF is assigned as a local var in the IIFE bundle, get it from context global
  // In the IIFE: var SF = (() => { ... })();
  // This creates SF as a global in the VM context
  return { SF: context.SF || context.window.SF, context, document };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

export {
  loadSf,
  flush,
};
