const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { createDom } = require('./fake-dom');

const ROOT = path.resolve(__dirname, '..', '..');

function loadSf(files, overrides = {}) {
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

  files.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });

  return { SF: context.window.SF, context, document };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

module.exports = {
  loadSf,
  flush,
};
