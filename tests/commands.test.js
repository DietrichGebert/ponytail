#!/usr/bin/env node
// Every ponytail command the pi extension registers must also ship as a
// file-based command for the hosts that need one: Claude Code (commands/*.toml,
// which Gemini CLI reuses) and OpenCode (.opencode/command/*.md). /ponytail-help
// was advertised in the README and the help card but missing both files; this
// guards that drift -- a registered command with no adapter file fails here.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
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

// /ponytail-debt documents one grep for the whole tree, shipped in four copies.
// It missed C-style /* ponytail: */ block comments (#810), so the ledger silently
// skipped every C/Java/CSS marker. Feed each shipped expression to real grep
// rather than restating it here: a copied regex only tests the copy.
const debtCopies = [
  'skills/ponytail-debt/SKILL.md',
  '.openclaw/skills/ponytail-debt/SKILL.md',
  'commands/ponytail-debt.toml',
  '.opencode/command/ponytail-debt.md',
];
const debtSamples = [
  ['# ponytail: hash marker', true],
  ['#ponytail: hash marker, no space', true],
  ['// ponytail: slash marker', true],
  ['//ponytail: slash marker, no space', true],
  ['/* ponytail: block marker, closed here */', true],
  ['/*ponytail: block marker, no space */', true],
  ['/* ponytail: block opener, closed some lines below', true],
  ['prose that merely mentions ponytail: markers stays out of the ledger', false],
];

test('every ponytail-debt copy greps #, // and /* markers but not prose', (t) => {
  const input = debtSamples.map(([line]) => line).join('\n') + '\n';
  const expected = debtSamples.flatMap(([line, hit], i) => (hit ? [`${i + 1}:${line}`] : []));

  for (const rel of debtCopies) {
    const documented = fs.readFileSync(path.join(root, rel), 'utf8').match(/grep -rnE '([^']+)'/);
    assert.ok(documented, `${rel} no longer documents a grep -rnE '<pattern>'`);

    const result = spawnSync('grep', ['-nE', documented[1]], { input, encoding: 'utf8', timeout: 5000 });
    if (result.error) {
      if (result.error.code === 'ENOENT') return t.skip('grep not available on this platform');
      throw result.error;
    }
    assert.equal(result.status, 0, `grep failed for ${rel}: ${result.stderr}`);
    assert.deepEqual(result.stdout.split('\n').filter(Boolean), expected, `${rel} misses or over-matches markers`);
  }
});
