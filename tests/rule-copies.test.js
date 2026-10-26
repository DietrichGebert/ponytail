// scripts/check-rule-copies.js is a CI gate, so these tests run it against a
// disposable copy of the rule files and prove a dropped carve-out fails.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const RULE_FILES = [
  'AGENTS.md',
  'skills/ponytail/SKILL.md',
  '.cursor/rules/ponytail.mdc',
  '.windsurf/rules/ponytail.md',
  '.clinerules/ponytail.md',
  '.agents/rules/ponytail.md',
  '.qoder/rules/ponytail.md',
  '.github/copilot-instructions.md',
  '.kiro/steering/ponytail.md',
  'hooks/ponytail-instructions.js',
];
const NEVER_CUT = 'prevents data loss, security, accessibility';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-rules-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

function copy() {
  const dir = fs.mkdtempSync(path.join(temp, 'copy-'));
  for (const rel of ['scripts/check-rule-copies.js', ...RULE_FILES]) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(path.join(root, rel), path.join(dir, rel));
  }
  return dir;
}

function run(dir) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts', 'check-rule-copies.js')], { encoding: 'utf8' });
}

function dropNeverCut(dir, files) {
  for (const rel of files) {
    const file = path.join(dir, rel);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes(NEVER_CUT), `${rel} must contain the never-cut sentence`);
    fs.writeFileSync(file, text.replace(NEVER_CUT, 'prevents data loss, accessibility'));
  }
}

test('check passes on the committed copies', () => {
  const result = run(copy());
  assert.equal(result.status, 0, result.stderr);
});

test('check fails when security is dropped from the never-cut sentence everywhere', () => {
  const dir = copy();
  dropNeverCut(dir, RULE_FILES);
  const result = run(dir);
  assert.notEqual(result.status, 0, 'a dropped security carve-out must fail the check');
});

test('check fails when only the fallback instruction copy drops a carve-out', () => {
  const dir = copy();
  dropNeverCut(dir, ['hooks/ponytail-instructions.js']);
  const result = run(dir);
  assert.notEqual(result.status, 0, 'the fallback copy must be checked too');
});
