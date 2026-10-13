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

test('native documentation qualification reaches the fallback and authoring commands', () => {
  const rule = fs.readFileSync(path.join(root, 'skills/ponytail/SKILL.md'), 'utf8')
    .split('\n').find((line) => line.startsWith('- A shortcut with a known limit'));
  const qualification = rule.slice(rule.indexOf('Use the project'));
  assert.ok(rule.includes('Use the project'), 'missing native documentation qualification');
  const { getFallbackInstructions } = require('../hooks/ponytail-instructions');
  for (const mode of ['lite', 'full', 'ultra']) {
    assert.ok(getFallbackInstructions(mode).includes(rule), `${mode} fallback dropped the shortcut rule`);
  }
  for (const rel of ['AGENTS.md', 'commands/ponytail.toml', '.opencode/command/ponytail.md']) {
    assert.ok(fs.readFileSync(path.join(root, rel), 'utf8').includes(qualification), `${rel} dropped native documentation guidance`);
  }
});

// Exercise the actual commands shipped to each host. Discovery admits candidates;
// the agent must inspect their context before including them in the ledger.
const debtCopies = [
  'skills/ponytail-debt/SKILL.md',
  '.openclaw/skills/ponytail-debt/SKILL.md',
  'commands/ponytail-debt.toml',
  '.opencode/command/ponytail-debt.md',
];
const debtSamples = [
  ...['shortcut', 'ponytail'].flatMap((marker) => [
    [`# ${marker}: hash marker`, true],
    [`#${marker}: hash marker, no space`, true],
    [`const n = 1; // ${marker}: inline marker`, true],
    [`//${marker}: slash marker, no space`, true],
    [`/* ${marker}: block marker, closed here */`, true],
    [`/*${marker}: block marker, no space */`, true],
    [`/** ${marker}: documentation opener`, true],
    [` * ${marker}: JSDoc, TSDoc or Javadoc continuation`, true],
    [`\t*\t${marker}: tab-indented continuation`, true],
    [`    """${marker}: double-quoted docstring opener`, true],
    [`    '''${marker}: single-quoted docstring opener`, true],
    [`\t${marker}: unprefixed docstring continuation`, true],
    ['    revisit when the input limit changes.', false],
    // These must be found too; behavioral evaluation proves their exclusion
    // from the ledger after reading enclosing source/documentation.
    [`prose that mentions ${marker}: markers is only a candidate`, true],
    [`const example = "${marker}: ordinary string data";`, true],
    [`// ${marker}: keyboard shortcut explanation, not a deferral`, true],
  ]),
  ['// no debt marker here', false],
];

for (const rel of debtCopies) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const instructions = rel.endsWith('.toml') ? JSON.parse(source.match(/^prompt = (".*")$/m)[1]) : source;
  const documented = instructions.match(/git grep --no-index --exclude-standard -n(?:E|F) (?:-e )?'[^']*'(?: -e '[^']*')?/);

  test(`${rel}: discovers native documentation and legacy candidates`, (t) => {
    assert.ok(documented, 'missing documented scan command');
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ponytail-debt-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'source.txt'), debtSamples.map(([line]) => line).join('\n') + '\n');
    const result = spawnSync('sh', ['-c', documented[0]], { cwd: dir, encoding: 'utf8', timeout: 5000 });
    if (result.error?.code === 'ENOENT' || result.status === 127) return t.skip('sh/git not available');
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    const expected = debtSamples.flatMap(([line, hit], i) => (hit ? [`source.txt:${i + 1}:${line}`] : []));
    assert.deepEqual(result.stdout.split('\n').filter(Boolean), expected);
  });

  // Preserve file selection in any stack (#948, #1100), including untracked source.
  test(`${rel}: skips .git and ignored files`, (t) => {
    assert.ok(documented, 'missing documented scan command');
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ponytail-debt-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const sub of ['src', '.git', 'node_modules/pkg', 'dist', 'build', '.next']) {
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
      fs.writeFileSync(path.join(dir, sub, 'a.js'), '// ponytail: marker\n');
    }
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ndist/\nbuild/\n.next/\n');
    const result = spawnSync('sh', ['-c', documented[0]], { cwd: dir, encoding: 'utf8', timeout: 5000 });
    if (result.error?.code === 'ENOENT' || result.status === 127) return t.skip('sh/git not available');
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.split('\n').filter(Boolean), ['src/a.js:1:// ponytail: marker']);
  });

  test(`${rel}: custom marker is literal data, not regex or shell code`, (t) => {
    const custom = instructions.match(/git grep --no-index --exclude-standard -nF -e "\$marker:"/);
    assert.ok(custom, 'missing fixed-string custom marker command');
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ponytail-debt-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const marker = '-TODO[1].*\'"$(touch executed)`touch executed`';
    fs.writeFileSync(path.join(dir, 'source.txt'), `${marker}: deliberate deferral\nTODO1: near match\nshortcut: default marker\n`);
    const result = spawnSync('sh', ['-c', custom[0]], { cwd: dir, env: { ...process.env, marker }, encoding: 'utf8', timeout: 5000 });
    if (result.error?.code === 'ENOENT' || result.status === 127) return t.skip('sh/git not available');
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `source.txt:1:${marker}: deliberate deferral\n`);
    assert.equal(fs.existsSync(path.join(dir, 'executed')), false);
  });

  test(`${rel}: no candidates has exit 1 and no output`, (t) => {
    assert.ok(documented, 'missing documented scan command');
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ponytail-debt-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'source.txt'), 'No markers in this source.\n');
    const result = spawnSync('sh', ['-c', documented[0]], { cwd: dir, encoding: 'utf8', timeout: 5000 });
    if (result.error?.code === 'ENOENT' || result.status === 127) return t.skip('sh/git not available');
    if (result.error) throw result.error;
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });
}
