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

// The command prompts and the help card restate skill rules by hand and drifted:
// a 5-rung ladder without reuse (#217) or installed deps, ultra "challenges
// before building", and review/audit whose delete: could target the one smoke
// test the main skill requires. Pin the load-bearing words in every copy.
test('command prompts and help card keep the rules they restate', () => {
  const pins = [
    [['reuse', 'installed dep'], ['commands/ponytail.toml', '.opencode/command/ponytail.md',
      'skills/ponytail-help/SKILL.md', 'commands/ponytail-help.toml', '.opencode/command/ponytail-help.md']],
    [['same breath'], ['skills/ponytail-help/SKILL.md', 'commands/ponytail-help.toml', '.opencode/command/ponytail-help.md']],
    [['never flag it for deletion'], ['skills/ponytail-audit/SKILL.md', 'commands/ponytail-audit.toml',
      '.opencode/command/ponytail-audit.md', 'commands/ponytail-review.toml', '.opencode/command/ponytail-review.md']],
  ];
  for (const [phrases, files] of pins) {
    for (const rel of files) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8');
      for (const phrase of phrases) assert.ok(text.includes(phrase), `${rel} lost "${phrase}"`);
    }
  }
});
