#!/usr/bin/env node
// Every ponytail command the pi extension registers must also ship as a
// file-based command for the hosts that need one: Claude Code (commands/*.toml,
// which Gemini CLI reuses) and OpenCode (.opencode/command/*.md). /ponytail-help
// was advertised in the README and the help card but missing both files; this
// guards that drift -- a registered command with no adapter file fails here.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// pi-extension registers the canonical command set.
const piSource = fs.readFileSync(path.join(root, 'pi-extension', 'index.js'), 'utf8');
const commands = [...piSource.matchAll(/registerCommand\(["']([\w-]+)["']/g)].map((m) => m[1]);

test('pi registers at least the base command', () => {
  assert.ok(commands.includes('ponytail'), 'expected pi to register a ponytail command');
});

test('every registered command ships a Claude commands/*.toml', () => {
  for (const name of commands) {
    assert.ok(
      fs.existsSync(path.join(root, 'commands', `${name}.toml`)),
      `missing commands/${name}.toml`,
    );
  }
});

test('every registered command ships an OpenCode .opencode/command/*.md', () => {
  for (const name of commands) {
    assert.ok(
      fs.existsSync(path.join(root, '.opencode', 'command', `${name}.md`)),
      `missing .opencode/command/${name}.md`,
    );
  }
});

test('ponytail-help qualifies session auto-activation for Copilot CLI', () => {
  const helpCard = fs.readFileSync(path.join(root, 'skills', 'ponytail-help', 'SKILL.md'), 'utf8');

  assert.doesNotMatch(helpCard, /Default mode = `full`, auto-active every session/);
  assert.match(helpCard, /hook-capable hosts such as Claude Code, Codex, and OpenCode/);
  assert.match(helpCard, /GitHub Copilot CLI's instruction-file fallback is instruction-tier only/);
  assert.match(helpCard, /\/ponytail:ponytail/);
  assert.match(helpCard, /~\/\.copilot\/copilot-instructions\.md/);

  for (const relPath of ['commands/ponytail-help.toml', '.opencode/command/ponytail-help.md']) {
    const text = fs.readFileSync(path.join(root, relPath), 'utf8');
    assert.match(text, /GitHub Copilot CLI's instruction-file fallback is instruction-tier only/);
    assert.match(text, /\/ponytail:ponytail/);
  }
});
