const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { createDom } = require('./fake-dom');

const ROOT = path.resolve(__dirname, '..', '..');
const STATIC_DIR = path.resolve(ROOT, 'static', 'sf');
const SF_LIB = "sf.js";

function createContext(overrides = {}) {
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

  return { context, document };
}

function runFiles(context, files) {
  files.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
}

function loadSf(files = [], overrides = {}) {
  const { context, document } = createContext(overrides);
  runFiles(context, files);

  return { SF: context.window.SF, context, document };
}

function loadSfBundle(overrides = {}, additionalFiles = []) {
  const { context, document } = createContext(overrides);
  const source = fs.readFileSync(path.join(STATIC_DIR, SF_LIB), 'utf8');
  vm.runInContext(source, context, { filename: SF_LIB });
  runFiles(context, additionalFiles);

  return { SF: context.window.SF, context, document };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

module.exports = {
  loadSf,
  loadSfBundle,
  flush,
};
