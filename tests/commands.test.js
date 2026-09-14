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

// The ponytail-debt scan pattern is duplicated across every host's copy of the
// command. It has to match block comments (#810: `/* ponytail: ... */` markers
// were silently missed) and stay identical everywhere.
const DEBT_PATTERN = "(#|//|/[*]) ?ponytail:";

test('every copy of the debt scan pattern matches all comment styles', () => {
  const copies = [
    'skills/ponytail-debt/SKILL.md',
    '.openclaw/skills/ponytail-debt/SKILL.md',
    'commands/ponytail-debt.toml',
    '.opencode/command/ponytail-debt.md',
  ];
  for (const rel of copies) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(text.includes(`grep -rnE '${DEBT_PATTERN}' .`), `${rel} has a drifted debt scan pattern`);
  }

  const re = new RegExp(DEBT_PATTERN);
  assert.ok(re.test('# ponytail: global lock, per-account locks if throughput matters'));
  assert.ok(re.test('  // ponytail: naive scan, index it when the list grows'));
  assert.ok(re.test('  /* ponytail: no upsell logic yet, read the merchant list later */'));
  // prose that merely mentions the convention stays out of the ledger
  assert.ok(!re.test('See the `ponytail:` convention for deliberate shortcuts.'));
});
