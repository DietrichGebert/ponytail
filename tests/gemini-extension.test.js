#!/usr/bin/env node
// Smoke test for the Gemini CLI adapter, which Qwen Code also consumes through
// its Gemini-extension compatibility. The adapter is a single thin manifest
// (gemini-extension.json) that reuses the repo's existing AGENTS.md, commands,
// and skills. This test fails if that shared surface stops wiring ponytail.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const MANIFEST = 'gemini-extension.json';
const EXTENSION_NAME = 'ponytail';
// Floating refs are a supply-chain footgun; the manifest version must be pinned.
const PINNED_SEMVER = /^\d+\.\d+\.\d+$/;
const VERSIONED_MANIFESTS = [
  'gemini-extension.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.github/plugin/plugin.json',
];
// Gemini and Qwen auto-discover these by directory; the manifest is only useful if they exist.
const ENTRY_POINTS = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];
const REUSED_COMMANDS = ENTRY_POINTS.map((name) => `commands/${name}.toml`);
const REUSED_SKILLS = ENTRY_POINTS.map((name) => `skills/${name}/SKILL.md`);
// Gemini CLI auto-loads this exact path for extension hooks. Ponytail's
// Claude/Codex hook map uses events Gemini does not support, so it must stay
// behind the host-specific plugin manifests instead.
const GEMINI_AUTO_HOOKS = 'hooks/hooks.json';
// Same load-bearing phrases asserted by scripts/check-rule-copies.js: the file
// contextFileName points at must actually carry the rules, not just exist.
const RULE_INVARIANTS = [
  'lazy senior',
  'input validation at trust boundaries',
  'naive heuristic',
];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

// Read inside each test (not at module scope) so a missing or malformed manifest
// surfaces as a clean per-test assertion failure, not a load-time crash that
// collapses every case into one unreadable stack trace.
function loadManifest() {
  assert.ok(fs.existsSync(path.join(root, MANIFEST)), `${MANIFEST} must exist`);
  return JSON.parse(read(MANIFEST));
}

test('manifest names the ponytail extension with a pinned version', () => {
  const manifest = loadManifest();
  assert.equal(manifest.name, EXTENSION_NAME);
  assert.match(manifest.version, PINNED_SEMVER);
});

test('version stays aligned with the other plugin manifests', () => {
  const versions = VERSIONED_MANIFESTS.map((rel) => {
    const manifest = JSON.parse(read(rel));
    assert.match(manifest.version, PINNED_SEMVER, `${rel} version must be pinned semver`);
    return manifest.version;
  });
  const [sharedVersion, ...rest] = versions;
  for (const version of rest) {
    assert.equal(version, sharedVersion);
  }
});

test('contextFileName resolves to a file carrying the ponytail rules', () => {
  const manifest = loadManifest();
  assert.ok(manifest.contextFileName, 'contextFileName must be set so rules load every session');
  const context = read(manifest.contextFileName);
  for (const phrase of RULE_INVARIANTS) {
    assert.ok(context.includes(phrase), `context file missing rule invariant: "${phrase}"`);
  }
});

test('the commands and Qwen-compatible skill metadata are present', () => {
  for (const rel of REUSED_COMMANDS) {
    assert.ok(fs.existsSync(path.join(root, rel)), `reused file missing: ${rel}`);
  }
  for (const [index, rel] of REUSED_SKILLS.entries()) {
    assert.ok(fs.existsSync(path.join(root, rel)), `reused file missing: ${rel}`);
    const frontmatter = read(rel).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatter, `skill frontmatter missing: ${rel}`);
    assert.match(frontmatter[1], new RegExp(`^name: ${ENTRY_POINTS[index]}$`, 'm'));
    assert.match(frontmatter[1], /^description:\s*(?:>|.+)$/m);
  }
});

test('Gemini cannot auto-discover Claude/Codex hook events', () => {
  assert.equal(
    fs.existsSync(path.join(root, GEMINI_AUTO_HOOKS)),
    false,
    `${GEMINI_AUTO_HOOKS} is auto-loaded by Gemini CLI; keep Claude/Codex hooks on manifest paths`,
  );
});
