const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { readRecords, sessionStats, csvRow } = require('../hooks/ponytail-band-import');
const session = 'abcd1234-1111-2222-3333-444444444444';
const at = second => `2026-10-01T10:00:${second}Z`;

function readFixture(t, records) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-records-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'session.jsonl');
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n'));
  return readRecords(file);
}

test('progress history does not grow retained records or change the resulting ledger row', t => {
  const prompt = { type: 'user', timestamp: at('00'), turnOrigin: 'human', message: { content: 'Keep the full totals' } };
  const reply = (id, second, input, output) => ({ type: 'assistant', timestamp: at(second),
    message: { id, model: 'claude-opus-5-5', usage: { input_tokens: input, output_tokens: output } } });
  const noise = Array.from({ length: 2500 }, (_, i) => ({ type: i % 2 ? 'progress' : 'file-history-snapshot',
    timestamp: at('01'), data: { text: 'A tool progress update', sequence: i } }));
  const reference = [
    { type: 'queue-operation', timestamp: '2026-10-01T09:59:58Z' },
    prompt,
    reply('m1', '06', 100, 10),
    { type: 'user', timestamp: at('08'), message: { content: [{ type: 'tool_result' }] } },
    reply('m2', '12', 50, 5),
    { type: 'cost-state', sessionId: session, totalCostUSD: 1.25 },
    { type: 'custom-title', customTitle: 'Final sidebar title' },
  ];
  const main = readFixture(t, [reference[0], ...noise, ...reference.slice(1), ...noise]);
  const subReference = [reply('sub-1', '09', 20, 2)];
  const sub = readFixture(t, [...noise, ...subReference, ...noise]);
  const expected = sessionStats(reference, subReference, session);
  const actual = sessionStats(main, sub, session);
  assert.deepEqual(actual, expected);
  assert.equal(actual.startedMs, Date.parse('2026-10-01T09:59:58Z'));
  assert.equal(actual.agentMs, 12000);
  assert.equal(actual.tokens, 187);
  assert.equal(actual.cost, 1.25);
  assert.equal(actual.name, 'Final sidebar title');
  assert.equal(csvRow(session, 'shop', actual), csvRow(session, 'shop', expected));
  assert.ok(main.length <= 8, `retained ${main.length} main records for one turn`);
  assert.ok(sub.length <= 2, `retained ${sub.length} subagent records for one reply`);
});

test('the first valid timestamp is retained even when it is on a later metadata record', t => {
  const records = [
    { type: 'progress', timestamp: 'invalid' },
    { type: 'user', turnOrigin: 'human', message: { content: 'Continue the work' } },
    { type: 'file-history-snapshot', timestamp: at('03') },
    { type: 'assistant', timestamp: at('06'), message: {
      id: 'm1', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 1 },
    } },
    { type: 'progress', timestamp: at('09') },
  ];
  const retained = readFixture(t, records);
  assert.deepEqual(sessionStats(retained), sessionStats(records));
  assert.equal(sessionStats(retained).startedMs, Date.parse(at('03')));
  assert.equal(retained.length, 3);
});
