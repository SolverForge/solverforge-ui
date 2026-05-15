const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { createDom } = require('./fake-dom');

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

module.exports = {
  loadSf,
  flush,
};
