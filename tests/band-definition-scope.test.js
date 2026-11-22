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

for (const [file, source, expected, calls] of [
  ['helpers.py', 'def invoice_total():\n    return 10\nclass Basket:\n    def nested_total(self):\n        return 1\ndef make_parser():\n    def parse_amount(value):\n        return value\n    return parse_amount\n',
    ['Basket', 'invoice_total', 'make_parser'], 'invoice_total()\nnested_total()\nparse_amount()'],
  ['helpers.js', 'export function invoice_total() { return 10; }\nfunction make_parser() {\n  function parse_amount(value) { return value; }\n  return parse_amount;\n}\n',
    ['invoice_total', 'make_parser'], 'invoice_total(); parse_amount();'],
]) {
  test('definition search preserves scope from ' + file, t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-definitions-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, file), source);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const grep = execFileSync('git', ['grep', '--untracked', '-nE', metrics.GREP_DEFS], { cwd: dir, encoding: 'utf8' });
    assert.match(grep, /parse_amount/);
    const known = metrics.parseDefs(grep);
    assert.deepEqual([...known.keys()].sort(), expected);
    assert.deepEqual(metrics.callsIn(calls, known, []), ['invoice_total']);
    assert.equal(known.get('invoice_total'), file + ':1');
  });
}
