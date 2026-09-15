const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solverforge-ui-installer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'scripts', 'install-skill'), path.join(root, 'scripts', 'install-skill'));
  fs.chmodSync(path.join(root, 'scripts', 'install-skill'), 0o755);
  fs.cpSync(path.join(repoRoot, 'skills', 'solverforge-ui'), path.join(root, 'skills', 'solverforge-ui'), {
    recursive: true,
  });
  return {
    root,
    script: path.join(root, 'scripts', 'install-skill'),
    skillsDir: path.join(root, 'target-skills'),
  };
}

function run(installer, args = []) {
  return spawnSync(installer.script, ['--dir', installer.skillsDir, ...args], {
    encoding: 'utf8',
  });
}

test('installer records ownership and updates only an unchanged managed copy', (t) => {
  const installer = fixture(t);
  const first = run(installer);
  assert.equal(first.status, 0, first.stderr);

  const destination = path.join(installer.skillsDir, 'solverforge-ui');
  const receipt = path.join(destination, '.solverforge-ui-install');
  assert.equal(fs.existsSync(receipt), true);

  const second = run(installer);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /up-to-date/);

  const sourceSkill = path.join(installer.root, 'skills', 'solverforge-ui', 'SKILL.md');
  fs.appendFileSync(sourceSkill, '\nUpdated fixture source.\n');
  const updated = run(installer);
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), /Updated fixture source/);
});

test('installer and uninstaller preserve unmanaged directories', (t) => {
  const installer = fixture(t);
  const destination = path.join(installer.skillsDir, 'solverforge-ui');
  const sentinel = path.join(destination, 'user-owned.txt');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(sentinel, 'keep me');

  for (const args of [[], ['--uninstall']]) {
    const result = run(installer, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no ownership receipt/);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep me');
  }
});

test('installer preserves files, symlinks, and directories with invalid receipts', (t) => {
  for (const kind of ['file', 'symlink', 'invalid-receipt']) {
    const installer = fixture(t);
    installer.skillsDir = path.join(installer.root, `${kind}-skills`);
    const destination = path.join(installer.skillsDir, 'solverforge-ui');
    fs.mkdirSync(installer.skillsDir, { recursive: true });
    if (kind === 'file') {
      fs.writeFileSync(destination, 'keep me');
    } else if (kind === 'symlink') {
      const target = path.join(installer.root, 'user-owned-target');
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'keep.txt'), 'keep me');
      fs.symlinkSync(target, destination);
    } else {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, '.solverforge-ui-install'), 'not a valid receipt\n');
      fs.writeFileSync(path.join(destination, 'keep.txt'), 'keep me');
    }

    const result = run(installer);
    assert.notEqual(result.status, 0, kind);
    assert.equal(fs.lstatSync(destination).isSymbolicLink(), kind === 'symlink');
    if (kind === 'file') assert.equal(fs.readFileSync(destination, 'utf8'), 'keep me');
    if (kind === 'invalid-receipt') {
      assert.equal(fs.readFileSync(path.join(destination, 'keep.txt'), 'utf8'), 'keep me');
    }
  }
});

test('installer and uninstaller preserve local changes to managed copies', (t) => {
  const installer = fixture(t);
  assert.equal(run(installer).status, 0);

  const customized = path.join(installer.skillsDir, 'solverforge-ui', 'SKILL.md');
  fs.appendFileSync(customized, '\nLocal customization.\n');

  for (const args of [[], ['--uninstall']]) {
    const result = run(installer, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /local changes were left untouched/);
    assert.match(fs.readFileSync(customized, 'utf8'), /Local customization/);
  }
});

test('installer preflights every destination before changing any destination', (t) => {
  const installer = fixture(t);
  const safeDir = path.join(installer.root, 'safe-skills');
  const conflictingDir = path.join(installer.root, 'conflicting-skills');
  const sentinel = path.join(conflictingDir, 'solverforge-ui', 'user-owned.txt');
  fs.mkdirSync(path.dirname(sentinel), { recursive: true });
  fs.writeFileSync(sentinel, 'keep me');

  const result = spawnSync(installer.script, [
    '--dir', safeDir,
    '--dir', conflictingDir,
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no destinations were changed/);
  assert.equal(fs.existsSync(path.join(safeDir, 'solverforge-ui')), false);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep me');
});

test('uninstaller removes only an unchanged managed copy', (t) => {
  const installer = fixture(t);
  assert.equal(run(installer).status, 0);

  const result = run(installer, ['--uninstall']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(installer.skillsDir, 'solverforge-ui')), false);
});
