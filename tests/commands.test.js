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

// #307: /ponytail-review must be able to review a whole branch, not only the
// unstaged changes. The target-resolution contract lives in three files (the
// skill plus both command adapters); pin the load-bearing words so a reword
// can't silently drop it from one of them.
test('review skill and both command files document branch-scoped review (#307)', () => {
  const files = [
    path.join('skills', 'ponytail-review', 'SKILL.md'),
    path.join('commands', 'ponytail-review.toml'),
    path.join('.opencode', 'command', 'ponytail-review.md'),
  ];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(text, /merge-base/, `${rel} must resolve a branch review from the merge-base`);
    assert.match(text, /git diff HEAD/, `${rel} must keep the working diff as the no-argument default`);
  }
});
