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

// Every skill except the base one is also a slash command.
const commands = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name);

test('skills include the base command', () => {
  assert.ok(commands.includes('ponytail'), 'expected a ponytail skill');
});

test('every registered command ships a Claude commands/*.toml', () => {
  for (const name of commands) {
    assert.ok(
      fs.existsSync(path.join(root, 'commands', `${name}.toml`)),
      `missing commands/${name}.toml`,
    );
  }
});

// /ponytail-debt documents one grep for the whole tree, shipped in four copies.
// It missed C-style /* ponytail: */ block comments (#810), so the ledger silently
// skipped every C/Java/CSS marker. Feed each shipped expression to real grep
// rather than restating it here: a copied regex only tests the copy.
const debtCopies = [
  'skills/ponytail-debt/SKILL.md',
  'commands/ponytail-debt.toml',
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
    const documented = fs.readFileSync(path.join(root, rel), 'utf8').match(/grep -rnE[^']*'([^']+)'/);
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

// The full documented command must skip dependency and build dirs (#948).
test('the ponytail-debt scan skips .git, node_modules, dist and build', (t) => {
  const cmd = fs.readFileSync(path.join(root, 'skills/ponytail-debt/SKILL.md'), 'utf8').match(/`(grep -rnE [^`]+)`/)[1];
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ponytail-debt-'));
  for (const sub of ['src', '.git', 'node_modules/pkg', 'dist', 'build']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
    fs.writeFileSync(path.join(dir, sub, 'a.js'), '// ponytail: marker\n');
  }
  const result = spawnSync('sh', ['-c', cmd], { cwd: dir, encoding: 'utf8', timeout: 5000 });
  fs.rmSync(dir, { recursive: true, force: true });
  if (result.error) return t.skip(`sh/grep not available: ${result.error.code}`);
  assert.deepEqual(result.stdout.split('\n').filter(Boolean), ['./src/a.js:1:// ponytail: marker']);
});
