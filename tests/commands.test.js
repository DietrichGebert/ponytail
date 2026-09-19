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
const { spawnSync } = require('child_process');

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

// Gemini CLI loads commands/*.toml with a strict TOML parser, so one invalid
// escape (`\*` in a basic string) drops the command. Parse each file with
// Python's tomllib (3.11+); npm test already needs Python for the Hermes tests.
test('every commands/*.toml parses as TOML with a string prompt', () => {
  const py = ['python3', 'python'].find((cmd) => spawnSync(cmd, ['-c', 'import tomllib']).status === 0);
  assert.ok(py, 'need Python 3.11+ (tomllib) on PATH');
  const files = fs.readdirSync(path.join(root, 'commands')).filter((f) => f.endsWith('.toml'));
  const script = [
    'import sys, tomllib',
    'for f in sys.argv[1:]:',
    '    try: assert isinstance(tomllib.load(open(f, "rb"))["prompt"], str)',
    '    except Exception as e: print(f"commands/{f}: {e!r}")',
  ].join('\n');
  const result = spawnSync(py, ['-c', script, ...files], { cwd: path.join(root, 'commands'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '', 'invalid TOML command file(s)');
});

test('every registered command ships an OpenCode .opencode/command/*.md', () => {
  for (const name of commands) {
    assert.ok(
      fs.existsSync(path.join(root, '.opencode', 'command', `${name}.md`)),
      `missing .opencode/command/${name}.md`,
    );
  }
});
