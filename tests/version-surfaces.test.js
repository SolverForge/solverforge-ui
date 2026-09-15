const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

function crateVersion() {
  const match = read('Cargo.toml').match(/^version = "([^"]+)"$/m);
  assert.ok(match, 'Cargo.toml must declare a crate version');
  return match[1];
}

test('all published version surfaces agree', () => {
  const version = crateVersion();
  const cargoLock = read('Cargo.lock');

  assert.match(cargoLock, new RegExp(`name = "solverforge-ui"\\nversion = "${version}"`));
  assert.match(read('js-src/00-core.js'), new RegExp(`version: '${version}'`));
  assert.match(read('static/sf/sf.js'), new RegExp(`version: '${version}'`));
  assert.match(read(`static/sf/sf.${version}.js`), new RegExp(`version: '${version}'`));
  assert.equal(fs.existsSync(path.join(repoRoot, 'static/sf', `sf.${version}.css`)), true);

  assert.ok(read('README.md').includes('Current crate version: `' + version + '`'));
  assert.ok(read('AGENTS.md').includes('Crate version: `' + version + '`'));
  assert.ok(read('WIREFRAME.md').includes('describes the `' + version + '`'));

  assert.equal(fs.existsSync(path.join(repoRoot, 'static/sf', 'sf.0.7.0.js')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'static/sf', 'sf.0.7.0.css')), false);
});
