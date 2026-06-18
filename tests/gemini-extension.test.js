#!/usr/bin/env node
// Smoke test for the Gemini CLI adapter. The adapter is a single thin manifest
// (gemini-extension.json) that reuses the repo's existing files: AGENTS.md for
// always-on context, commands/*.toml for /ponytail + /ponytail-review, and
// skills/ for the agent skills. This test fails if the manifest is removed,
// loses its pinned version, or points contextFileName at a file that no longer
// carries the load-bearing rules — i.e. if the adapter stops wiring ponytail.

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
// The marketplace manifests for the three plugin ecosystems. Shapes differ per
// ecosystem, but all must parse, name the ponytail plugin, and — for the two
// that carry a shared plugin description — keep it identical, so a rename or
// copy-edit can't silently desync one marketplace listing from the others.
const MARKETPLACE_MANIFESTS = [
  '.claude-plugin/marketplace.json',
  '.github/plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];
// Gemini auto-discovers these by directory; the manifest is only useful if they exist.
const REUSED_COMMANDS = ['commands/ponytail.toml', 'commands/ponytail-review.toml'];
const REUSED_SKILLS = ['skills/ponytail/SKILL.md'];
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

test('the commands and skills the adapter reuses are present', () => {
  for (const rel of [...REUSED_COMMANDS, ...REUSED_SKILLS]) {
    assert.ok(fs.existsSync(path.join(root, rel)), `reused file missing: ${rel}`);
  }
});

test('every marketplace manifest parses and names the ponytail plugin', () => {
  for (const rel of MARKETPLACE_MANIFESTS) {
    assert.ok(fs.existsSync(path.join(root, rel)), `marketplace manifest missing: ${rel}`);
    const manifest = JSON.parse(read(rel));
    assert.equal(manifest.name, EXTENSION_NAME, `${rel}: top-level name must be ponytail`);
    assert.ok(Array.isArray(manifest.plugins) && manifest.plugins.length > 0, `${rel}: must list a plugin`);
    assert.equal(manifest.plugins[0].name, EXTENSION_NAME, `${rel}: plugins[0].name must be ponytail`);
  }
});

test('marketplace manifests that carry a plugin description keep it identical', () => {
  const descriptions = MARKETPLACE_MANIFESTS
    .map((rel) => JSON.parse(read(rel)).plugins[0].description)
    .filter(Boolean);
  assert.ok(descriptions.length >= 2, 'expected a shared plugin description in at least two marketplaces');
  for (const d of descriptions) {
    assert.equal(d, descriptions[0], 'a marketplace plugin description drifted from the others');
  }
});
