const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

let metrics;
test.before(async () => {
  const source = path.join(__dirname, '..', 'hooks', 'band');
  const moduleUrl = (file, from, to) => 'data:text/javascript;base64,' + Buffer.from(
    stripTypeScriptTypes(fs.readFileSync(path.join(source, file), 'utf8').replace(from, JSON.stringify(to)))
  ).toString('base64');
  const board = moduleUrl('board.ts', "'./logo'", pathToFileURL(path.join(source, 'logo.ts')).href);
  metrics = await import(moduleUrl('metrics.ts', "'./board'", board));
});

for (const [label, files, posixOnly] of [
  ['Unicode', ['caf\u00e9.py', 'rocket-\u{1f680}.py'], false],
  ['record delimiters', ['colon:7:helpers.py', 'line\nbreak.py'], true],
  ['quoted paths', ['quote"name.py', 'back\\slash.py', 'tab\tname.py'], true],
]) {
  test('definition and reference searches preserve ' + label, { skip: posixOnly && process.platform === 'win32' }, t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-search-paths-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    files.forEach((file, i) => fs.writeFileSync(path.join(dir, file), `def calculate_price_${i}():\n    return 1\ncalculate_price_${i}()\n`));
    const grep = args => execFileSync('git', ['-c', 'core.quotePath=true', 'grep', '--untracked', '-z', ...args], { cwd: dir, encoding: 'utf8' });
    const definitions = grep(['-nE', metrics.GREP_DEFS]);
    const known = metrics.parseDefs(definitions);
    assert.equal(known.size, files.length);
    files.forEach((file, i) => {
      const name = `calculate_price_${i}`;
      assert.equal(known.get(name), file + ':1');
      assert.deepEqual(metrics.hits(grep(['-nw', '-e', name])), [
        { file, line: '1', text: `def ${name}():` },
        { file, line: '3', text: `${name}()` },
      ]);
      assert.deepEqual(metrics.callsIn(`${name}()`, known, []), [name]);
    });
  });
}

test('keeps ordinary colon-delimited helper output compatible', () => {
  assert.deepEqual(metrics.hits('plain.py:2:    calculate_price(1:2)\n'), [
    { file: 'plain.py', line: '2', text: '    calculate_price(1:2)' },
  ]);
  assert.equal(metrics.parseDefs('plain.py:1:def calculate_price():\n').get('calculate_price'), 'plain.py:1');
});
