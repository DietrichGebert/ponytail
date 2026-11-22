const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { pathToFileURL } = require('node:url');

let markdown;
test.before(async () => {
  const source = path.join(__dirname, '..', 'hooks', 'band');
  const moduleUrl = (file, from, to) => 'data:text/javascript;base64,' + Buffer.from(
    stripTypeScriptTypes(fs.readFileSync(path.join(source, file), 'utf8').replace(from, JSON.stringify(to)))
  ).toString('base64');
  const board = moduleUrl('board.ts', "'./logo'", pathToFileURL(path.join(source, 'logo.ts')).href);
  ({ markdown } = await import(moduleUrl('metrics.ts', "'./board'", board)));
});

const row = {
  name: 'Fix parser', project: 'shop', started: '2026-11-20 10:00', model: 'claude-opus-5-5',
  session: 'abcd1234-5678', cost: 1.5, lastTurn: 0.5, turns: 3, agentMs: 12000,
  tokens: { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 },
  reuse: 75, reused: 3, created: 1, callersOpen: 0, tests: '7 passed', level: 'full',
};

test('copies code-like task names as literal heading text', () => {
  const text = markdown({ ...row, name: 'Fix <Menu> &amp; **bold** `code` [x] \\ | ~~done~~ #' });
  assert.equal(text.split('\n')[0], '## Fix &#60;Menu&#62; &#38;amp; &#42;&#42;bold&#42;&#42; &#96;code&#96; &#91;x&#93; &#92; &#124; &#126;&#126;done&#126;&#126; &#35;');
});

test('keeps project and model punctuation literal inside table cells', () => {
  const text = markdown({ ...row, project: '_tools_\\helpers|<sdk>', model: '[custom](https://example.invalid)' });
  assert.ok(text.includes('| Project | &#95;tools&#95;&#92;helpers&#124;&#60;sdk&#62; |'));
  assert.ok(text.includes('| Model | &#91;custom&#93;(https://example.invalid) |'));
});

test('keeps metadata line breaks inside one heading or table row', () => {
  const text = markdown({ ...row, name: 'First\r\nSecond', project: 'One\rTwo\nThree' });
  assert.equal(text.split('\n')[0], '## First<br>Second');
  assert.ok(text.includes('| Project | One<br>Two<br>Three |'));
});

test('retains ordinary report values and intentional template formatting', () => {
  const text = markdown(row);
  assert.equal(text.split('\n')[0], '## Fix parser');
  assert.ok(text.includes('| Project | shop |'));
  assert.ok(text.includes('| Model | claude-opus-5-5 |'));
  assert.ok(text.includes('| Cost | $1.50 · last turn $0.50 · ⌀ $0.50 / turn |'));
  assert.ok(text.includes('| Session | `abcd1234-5678` |'));
});
