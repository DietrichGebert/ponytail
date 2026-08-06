#!/usr/bin/env node
// The ChatGPT adapter is generated from the canonical skills/. These tests
// catch stale copies, host-instruction leaks, package omissions, and archives
// that expose more than one SKILL.md entrypoint.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  CHATGPT_HOST,
  ENTRYPOINT,
  NAMES,
  OPENAI_YAML,
  OUT,
  outPath,
  renderFiles,
  sourceBody,
} = require('../scripts/build-chatgpt-skill');
const { findPython, packageSkill } = require('../scripts/package-chatgpt-skill');

const ROOT = path.join(__dirname, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('committed ChatGPT adapter matches the generator', () => {
  for (const [relativePath, expected] of renderFiles()) {
    const actual = fs.readFileSync(outPath(relativePath), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(actual, expected, `stale — run: npm run build:chatgpt (${relativePath})`);
  }
});

test('ChatGPT bundle exposes exactly one SKILL.md', () => {
  const skillFiles = walk(OUT).filter((file) => path.basename(file) === 'SKILL.md');
  assert.deepEqual(skillFiles.map((file) => path.relative(OUT, file).replace(/\\/g, '/')), ['SKILL.md']);
});

test('root entrypoint uses ChatGPT-compatible frontmatter', () => {
  const frontmatter = ENTRYPOINT.match(/^---\n([\s\S]*?)\n---/)[1];
  const keys = frontmatter.split('\n').filter((line) => /^[a-z][a-z-]*:/.test(line)).map((line) => line.split(':')[0]);
  assert.deepEqual(keys, ['name', 'description']);
  assert.match(frontmatter, /^name: ponytail$/m);
});

test('OpenAI UI metadata is present', () => {
  assert.match(OPENAI_YAML, /display_name: "Ponytail"/);
  assert.match(OPENAI_YAML, /short_description:/);
});

test('ChatGPT help overrides lifecycle-host behavior', () => {
  assert.match(CHATGPT_HOST, /conversation/);
  assert.match(CHATGPT_HOST, /Plugins → Skills/);
  assert.match(CHATGPT_HOST, /not registered ChatGPT slash-menu commands/);
  assert.match(ENTRYPOINT, /references\/chatgpt-host\.md/);
  assert.match(ENTRYPOINT, /ignore its host-specific install, update, persistence, and configuration sections/);
});

test('npm package ships and exposes the ChatGPT adapter', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.files.includes('.chatgpt/'));
  assert.ok(pkg.files.includes('scripts/build-chatgpt-skill.js'));
  assert.ok(pkg.files.includes('scripts/package-chatgpt-skill.js'));
  assert.equal(pkg.scripts['build:chatgpt'], 'node scripts/build-chatgpt-skill.js');
  assert.equal(pkg.scripts['pack:chatgpt'], 'node scripts/package-chatgpt-skill.js');
});

test('packaging creates one uploadable Skill ZIP', { timeout: 20_000 }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-chatgpt-'));
  const archive = packageSkill(path.join(temp, 'skill.zip'));
  const python = findPython();
  const result = spawnSync(
    python.command,
    [...python.prefix, '-m', 'zipfile', '-l', archive],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  const entries = result.stdout.split('\n').flatMap((line) => {
    const match = line.match(/^(.*?)\s{2,}\d{4}-\d{2}-\d{2}/);
    return match ? [match[1].trim()] : [];
  });
  assert.ok(entries.includes('ponytail/SKILL.md'));
  assert.ok(entries.includes('ponytail/agents/openai.yaml'));
  assert.ok(entries.includes('ponytail/references/chatgpt-host.md'));
  assert.equal(entries.filter((entry) => path.basename(entry) === 'SKILL.md').length, 1);
});

for (const name of NAMES) {
  test(`${name}: ChatGPT reference is the canonical skill body`, () => {
    const reference = fs.readFileSync(outPath(`references/${name}.md`), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(reference, sourceBody(name));
  });
}
