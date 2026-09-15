const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const skillDir = path.join(repoRoot, 'skills', 'solverforge-ui');
const skillFile = path.join(skillDir, 'SKILL.md');
const referencesDir = path.join(skillDir, 'references');

function readFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, 'SKILL.md must start with YAML frontmatter');
  const fields = {};
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (entry) fields[entry[1]] = entry[2].trim();
  }
  return fields;
}

function referencedReferences(source) {
  const found = new Set();
  const pattern = /references\/([a-z0-9-]+\.md)/g;
  let match = pattern.exec(source);
  while (match) {
    found.add(match[1]);
    match = pattern.exec(source);
  }
  return found;
}

test('skill frontmatter is valid and names the directory', () => {
  const source = fs.readFileSync(skillFile, 'utf8');
  const fields = readFrontmatter(source);

  assert.equal(fields.name, 'solverforge-ui');
  assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(fields.name, path.basename(skillDir), 'name must match the skill directory');
  assert.ok(fields.description.length >= 1 && fields.description.length <= 1024,
    'description must be 1-1024 characters');
});

test('every reference linked from SKILL.md exists and is non-empty', () => {
  const source = fs.readFileSync(skillFile, 'utf8');
  const linked = referencedReferences(source);
  assert.ok(linked.size > 0, 'SKILL.md should link to reference files');

  for (const name of linked) {
    const file = path.join(referencesDir, name);
    assert.ok(fs.existsSync(file), `missing reference referenced by SKILL.md: ${name}`);
    assert.ok(fs.statSync(file).size > 0, `empty reference: ${name}`);
  }
});

test('no orphan reference files are shipped', () => {
  const source = fs.readFileSync(skillFile, 'utf8');
  const linked = referencedReferences(source);
  const shipped = fs.readdirSync(referencesDir).filter((name) => name.endsWith('.md'));

  assert.ok(shipped.length > 0, 'skill should ship reference files');
  for (const name of shipped) {
    assert.ok(linked.has(name), `reference not linked from SKILL.md: ${name}`);
  }
});

test('installer exists, is executable, and copies rather than symlinks', () => {
  const installer = path.join(repoRoot, 'scripts', 'install-skill');
  assert.ok(fs.existsSync(installer), 'scripts/install-skill must exist');
  assert.ok((fs.statSync(installer).mode & 0o111) !== 0, 'scripts/install-skill must be executable');

  const script = fs.readFileSync(installer, 'utf8');
  assert.match(script, /\bcp -R\b/, 'installer must copy with cp -R');
  assert.doesNotMatch(script, /\bln -s/, 'installer must not create symlinks');
  for (const harness of ['opencode', 'claude', 'agents']) {
    assert.ok(script.includes(harness), `installer must know the ${harness} skills directory`);
  }
});

test('no skill symlink is committed into the repository', () => {
  const link = path.join(repoRoot, '.agents', 'skills', 'solverforge-ui');
  assert.equal(fs.existsSync(link), false, 'skills must be installed per harness, not committed as a symlink');
});
