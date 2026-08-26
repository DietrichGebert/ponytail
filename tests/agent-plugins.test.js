#!/usr/bin/env node
// Agent Plugins v1 conformance guard for the portable core.
//
// The portable core is exactly three things: root plugin.json, skills/, and an
// optional root mcp.json. Everything else in this repo (.claude-plugin/,
// .codex-plugin/, .github/plugin/, .qoder-plugin/, hooks/, commands/, rules)
// is a host adapter and is deliberately out of scope here.
//
// Two failure modes this catches, both of which have already bitten:
//   1. Copying an adapter manifest's component keys ("skills", "commands",
//      "hooks", "mcpServers") into root plugin.json. The v1 schema is closed and
//      component locations are fixed, so those keys are nonconforming.
//   2. A stray frontmatter key in a SKILL.md. Spec §7.1 says a client MUST *skip*
//      a skill that fails Agent Skills validation, so one extra key silently
//      removes the whole skill instead of erroring loudly. `argument-hint` did
//      exactly that to skills/ponytail before the v1 migration.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';

// Spec §5.2: the manifest schema is closed.
const MANIFEST_FIELDS = new Set([
  '$schema', 'name', 'version', 'description', 'author',
  'homepage', 'repository', 'license', 'keywords', 'extensions',
]);
// Agent Skills frontmatter is closed too; skills-ref rejects anything else.
const SKILL_FIELDS = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
]);
const PLUGIN_NAME = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const SKILL_NAME = /^(?!.*--)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');

// Top-level frontmatter keys only. Enough to catch a stray field without pulling
// in a YAML parser; this repo ships zero runtime dependencies. If the bodies ever
// grow nested structures worth validating, run skills-ref in CI instead.
function frontmatterKeys(text) {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  assert.ok(match, 'SKILL.md must open with YAML frontmatter');
  return match[1].split('\n')
    .map((line) => /^([A-Za-z][\w-]*):/.exec(line))
    .filter(Boolean)
    .map((m) => m[1]);
}

function frontmatterValue(text, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(text);
  return match ? match[1].trim() : undefined;
}

test('root plugin.json is a conforming Agent Plugins v1 manifest', () => {
  const manifest = JSON.parse(read('plugin.json'));

  assert.equal(manifest.$schema, PLUGIN_SCHEMA);
  assert.match(manifest.name, PLUGIN_NAME);
  assert.ok(manifest.name.length <= 64);

  const unknown = Object.keys(manifest).filter((key) => !MANIFEST_FIELDS.has(key));
  assert.deepEqual(unknown, [], `plugin.json has non-portable top-level fields: ${unknown}`);

  // Component locations are fixed (§6.1); the manifest cannot point at them.
  for (const key of ['skills', 'commands', 'hooks', 'mcpServers', 'rules', 'interface']) {
    assert.equal(manifest[key], undefined, `"${key}" belongs in a host adapter manifest, not plugin.json`);
  }

  if (manifest.author) {
    const badAuthor = Object.keys(manifest.author).filter((k) => !['name', 'email', 'url'].includes(k));
    assert.deepEqual(badAuthor, [], `author may only carry name/email/url, got: ${badAuthor}`);
  }
});

test('every skill in skills/ conforms to the Agent Skills spec', () => {
  const dirs = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.ok(dirs.length > 0, 'skills/ must contain at least one skill directory');

  for (const dir of dirs) {
    // §7.1: only immediate children with a regular SKILL.md are discovered.
    const skillPath = path.join(root, 'skills', dir, 'SKILL.md');
    assert.ok(fs.statSync(skillPath).isFile(), `skills/${dir}/SKILL.md must be a regular file`);

    const text = read(path.join('skills', dir, 'SKILL.md'));
    const keys = frontmatterKeys(text);

    const unknown = keys.filter((key) => !SKILL_FIELDS.has(key));
    assert.deepEqual(unknown, [], `skills/${dir} has unexpected frontmatter (client would skip it): ${unknown}`);

    const name = frontmatterValue(text, 'name');
    assert.equal(name, dir, `skills/${dir}: frontmatter name must match its directory`);
    assert.match(name, SKILL_NAME);
    assert.ok(keys.includes('description'), `skills/${dir}: description is required`);
  }
});

test('MCP config, if it ever ships, targets the matching spec version', () => {
  // Intentionally absent today: ponytail-mcp/ is a private, unbuilt workspace
  // package, so shipping it here would hand clients a server that cannot start.
  const mcpPath = path.join(root, 'mcp.json');
  if (!fs.existsSync(mcpPath)) return;

  const mcp = JSON.parse(read('mcp.json'));
  assert.equal(mcp.$schema, MCP_SCHEMA, 'mcp.json version must match plugin.json (§10.1)');
  assert.deepEqual(Object.keys(mcp).sort(), ['$schema', 'mcpServers']);
  for (const [name, server] of Object.entries(mcp.mcpServers)) {
    assert.ok(['stdio', 'streamable-http', 'sse'].includes(server.type), `${name}: unknown transport`);
    if (server.type === 'stdio') {
      assert.doesNotMatch(server.command, /\s/, `${name}: command must be one executable token`);
    }
  }
});
