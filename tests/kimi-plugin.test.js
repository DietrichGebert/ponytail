#!/usr/bin/env node
// Smoke test for the Kimi Code adapter. The adapter is a self-contained
// plugin dir (.kimi-plugin/): the manifest (plugin.json, recognized by Kimi
// Code next to the root-level kimi.plugin.json form) wires the repo's shared
// files — AGENTS.md via systemPromptPath for always-on rules, skills/ for the
// six agent skills, sessionStart.skill to activate ponytail every session —
// and registers its own copy of the Markdown commands in .kimi-plugin/commands/
// as /ponytail:<command>. The command copies start out identical to
// .opencode/command/*.md and a test below keeps the two adapters from silently
// drifting apart. Kimi's hook payload differs from the Claude/Codex event
// shapes ponytail's lifecycle hooks emit, so the adapter declares no hooks.
// This test fails if the manifest is removed, drifts off the pinned version,
// points at files that no longer exist, or starts carrying fields Kimi Code
// would flag as diagnostics.
//
// Manifest spec: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const MANIFEST = path.join('.kimi-plugin', 'plugin.json');
// Floating refs are a supply-chain footgun; the manifest version must be pinned.
const PINNED_SEMVER = /^\d+\.\d+\.\d+$/;
// The name field doubles as the plugin id (and the /ponytail:<command> prefix).
const PLUGIN_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// Fields the manifest spec documents. Unsupported runtime fields (tools, apps,
// inject, configFile) only surface as diagnostics; anything else is a typo.
const SUPPORTED_FIELDS = new Set([
  'name', 'version', 'description', 'keywords', 'author', 'homepage', 'license',
  'interface', 'skills', 'agents', 'sessionStart', 'skillInstructions',
  'systemPrompt', 'systemPromptPath', 'mcpServers', 'hooks', 'commands',
]);
// systemPrompt and systemPromptPath are each capped at 32 KB; oversized
// content is silently ignored, so AGENTS.md must stay well under it.
const PROMPT_BUDGET = 32 * 1024;
const SIX_SKILLS = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'];
// Same load-bearing phrases asserted by scripts/check-rule-copies.js: the file
// systemPromptPath points at must actually carry the rules, not just exist.
const RULE_INVARIANTS = [
  'lazy senior',
  'input validation at trust boundaries',
  'naive heuristic',
];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

// Read inside each test (not at module scope) so a missing or malformed manifest
// surfaces as a clean per-test assertion failure, not a load-time crash.
function loadManifest() {
  assert.ok(fs.existsSync(path.join(root, MANIFEST)), `${MANIFEST} must exist`);
  return JSON.parse(read(MANIFEST));
}

// Every file reference in the manifest is a ./ path inside the plugin root.
function referencedPaths(manifest) {
  return [manifest.systemPromptPath]
    .concat(manifest.skills || [])
    .concat(manifest.commands || [])
    .filter(Boolean);
}

test('manifest names the ponytail plugin with a pinned version', () => {
  const manifest = loadManifest();
  assert.match(manifest.name, PLUGIN_ID);
  assert.equal(manifest.name, 'ponytail');
  assert.match(manifest.version, PINNED_SEMVER);
});

test('version stays aligned with the other plugin manifests', () => {
  const manifest = loadManifest();
  const reference = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.equal(manifest.version, reference.version);
});

test('manifest only uses fields Kimi Code supports', () => {
  const manifest = loadManifest();
  for (const field of Object.keys(manifest)) {
    assert.ok(SUPPORTED_FIELDS.has(field), `unsupported manifest field: ${field}`);
  }
});

test('every referenced ./ path stays inside the plugin root and exists', () => {
  const manifest = loadManifest();
  const refs = referencedPaths(manifest);
  assert.ok(refs.length > 0, 'manifest references no files — adapter wires nothing');
  for (const ref of refs) {
    assert.ok(ref.startsWith('./'), `manifest path must be relative to the plugin root: ${ref}`);
    const resolved = path.resolve(root, ref);
    assert.ok(resolved.startsWith(root + path.sep), `manifest path escapes the plugin root: ${ref}`);
    assert.ok(fs.existsSync(resolved), `referenced path missing: ${ref}`);
  }
});

test('systemPromptPath carries the ponytail rules within the 32 KB budget', () => {
  const manifest = loadManifest();
  assert.ok(manifest.systemPromptPath, 'systemPromptPath must be set so rules load every session');
  const context = read(manifest.systemPromptPath);
  for (const phrase of RULE_INVARIANTS) {
    assert.ok(context.includes(phrase), `system prompt file missing rule invariant: "${phrase}"`);
  }
  assert.ok(Buffer.byteLength(context, 'utf8') < PROMPT_BUDGET, 'system prompt file exceeds the 32 KB budget');
});

test('sessionStart.skill resolves to a shipped skill', () => {
  const manifest = loadManifest();
  const skill = manifest.sessionStart && manifest.sessionStart.skill;
  assert.ok(skill, 'sessionStart.skill must activate ponytail every session');
  const skillsDirs = [].concat(manifest.skills || []);
  const found = skillsDirs.some((dir) =>
    fs.existsSync(path.join(root, dir, skill, 'SKILL.md')));
  assert.ok(found, `sessionStart.skill "${skill}" has no SKILL.md under the declared skills path`);
});

test('the declared skills dir ships the six ponytail skills', () => {
  const manifest = loadManifest();
  for (const skill of SIX_SKILLS) {
    const rel = path.join([].concat(manifest.skills)[0], skill, 'SKILL.md');
    assert.ok(fs.existsSync(path.join(root, rel)), `missing skill: ${rel}`);
  }
});

// The command set is canonical in pi-extension; tests/commands.test.js already
// pins one file per registered command. Kimi Code must find the same set in
// the directory its manifest points at, as parseable Markdown commands.
test('every registered command resolves in the declared commands dir', () => {
  const manifest = loadManifest();
  const commandsDir = [].concat(manifest.commands)[0];
  const piSource = fs.readFileSync(path.join(root, 'pi-extension', 'index.js'), 'utf8');
  const commands = [...piSource.matchAll(/registerCommand\(["']([\w-]+)["']/g)].map((m) => m[1]);
  assert.ok(commands.length > 0, 'expected pi to register at least one command');
  for (const name of commands) {
    const rel = path.join(commandsDir, `${name}.md`);
    assert.ok(fs.existsSync(path.join(root, rel)), `missing command file: ${rel}`);
    const body = read(rel);
    // Kimi Code parses frontmatter for name/description; the rest is the prompt.
    assert.match(body, /^---\r?\n[\s\S]*?description:.+?\r?\n---\r?\n/, `${rel} lost its frontmatter description`);
    assert.ok(body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim().length > 0, `${rel} has an empty prompt body`);
  }
});

// The Kimi adapter keeps its own copy of the command files so the two adapters
// can evolve independently — but the copies start out identical, and a change
// to one almost always applies to the other. Byte-compare against the OpenCode
// set so a one-sided edit fails loudly instead of drifting (same convention as
// scripts/check-rule-copies.js). If a divergence is ever deliberate, this is
// the reminder to say so in the test.
test('command files stay in sync with the OpenCode set', () => {
  const manifest = loadManifest();
  const kimiDir = [].concat(manifest.commands)[0];
  const opencodeDir = path.join('.opencode', 'command');
  const kimiFiles = fs.readdirSync(path.join(root, kimiDir)).filter((f) => f.endsWith('.md')).sort();
  const opencodeFiles = fs.readdirSync(path.join(root, opencodeDir)).filter((f) => f.endsWith('.md')).sort();
  assert.deepEqual(kimiFiles, opencodeFiles, 'the two command dirs ship different command sets');
  for (const file of kimiFiles) {
    const kimiBody = read(path.join(kimiDir, file)).replace(/\r\n/g, '\n');
    const opencodeBody = read(path.join(opencodeDir, file)).replace(/\r\n/g, '\n');
    assert.equal(kimiBody, opencodeBody, `${file} drifted from .opencode/command/${file}`);
  }
});
