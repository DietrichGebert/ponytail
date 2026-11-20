const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { pathToFileURL } = require('node:url');

let board, metrics;
test.before(async () => {
  const root = path.join(__dirname, '../hooks/band');
  const moduleUrl = (file, from, to) => 'data:text/javascript;base64,' + Buffer.from(
    stripTypeScriptTypes(fs.readFileSync(path.join(root, file), 'utf8').replace(from, JSON.stringify(to)))
  ).toString('base64');
  const url = moduleUrl('board.ts', "'./logo'", pathToFileURL(path.join(root, 'logo.ts')).href);
  board = await import(url);
  metrics = await import(moduleUrl('metrics.ts', "'./board'", url));
});

const header = 'key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,reuse_pct,reused,new,callers_open,tests,level,model';
const row = 'session-1,2026-11-20 12:00,project,"A\uFEFF title",1.25,2,1.5,300,50,,0,0,0,2 passed,full,claude-opus-5-5';

test('board reads a UTF-8 BOM ledger without losing sessions or embedded text', () => {
  const csv = `${header}\r\n${row}\r\n`;
  const expected = board.tasksFrom(csv);
  assert.equal(expected.length, 1);
  assert.equal(expected[0].name, 'A\uFEFF title');
  for (const first of [header, header.replace(/^key/, '"key"')]) {
    assert.deepEqual(board.tasksFrom(`\uFEFF${first}\r\n${row}\r\n`), expected);
  }
  assert.deepEqual(board.parseCsv('\uFEFF'), []);
});

test('a resumed band restores its existing row from a BOM ledger', () => {
  const fresh = { name: '', busyMs: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  const resumed = metrics.resume(fresh, `\uFEFF${header}\n${row}\n`, 'session-1');
  assert.equal(resumed.name, 'A\uFEFF title');
  assert.equal(resumed.busyMs, 90000);
  assert.deepEqual(resumed.tokens, { input: 250, output: 50, cacheRead: 0, cacheWrite: 0 });
  assert.deepEqual(fresh, { name: '', busyMs: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } });
});
