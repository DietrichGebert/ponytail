const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { readRecords, sessionStats } = require('../hooks/ponytail-band-import');

const prompt = { type: 'user', timestamp: '2026-10-01T10:00:00Z', origin: { kind: 'human' }, message: { content: 'Fix the totals' } };
const reply = (id, usage) => ({ type: 'assistant', timestamp: '2026-10-01T10:00:10Z', message: { id, model: 'claude-sonnet-4-6', usage } });

test('import uses complete recorded usage for main and subagent messages', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-usage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const main = { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 200, cache_creation_input_tokens: 30,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 30 } };
  const child = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 20, cache_creation_input_tokens: 3 };
  const records = [prompt,
    reply('main', { ...main, output_tokens: 1, cache_creation: { ephemeral_5m_input_tokens: 30, ephemeral_1h_input_tokens: 0 } }),
    reply('main', main), reply('main', main)];
  const sub = [reply('child', { ...child, output_tokens: 2 }), reply('child', child), reply('child', child)];
  const transcript = path.join(dir, 'session.jsonl');
  const subagent = path.join(dir, 'agent-1.jsonl');
  fs.writeFileSync(transcript, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(subagent, sub.map(r => JSON.stringify(r)).join('\n'));

  const stats = sessionStats(readRecords(transcript), readRecords(subagent));
  assert.equal(stats.output, 60, 'partial streamed records must not hide the recorded final output');
  assert.equal(stats.tokens, 423, 'each message still contributes exactly one usage snapshot');
  const expected = (110 * 3 + 220 * 0.3 + 30 * 6 + 3 * 3.75 + 60 * 15) / 1e6;
  assert.ok(Math.abs(stats.estimate - expected) < 1e-12, 'the selected cache TTL breakdown stays with its complete snapshot');
  assert.equal(stats.cost, stats.estimate);
});

for (const zeroFirst of [true, false]) test(`import retains usage when a zero replay is ${zeroFirst ? 'first' : 'last'}`, () => {
  const full = { input_tokens: 2, output_tokens: 5175, cache_read_input_tokens: 316685, cache_creation_input_tokens: 977,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 977 } };
  const zero = { ...full, input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const snapshots = zeroFirst ? [zero, full] : [full, zero];
  const stats = sessionStats([prompt, ...snapshots.map(usage => reply('replayed', usage))]);
  assert.equal(stats.tokens, 322839);
  assert.equal(stats.output, 5175);
  assert.equal(stats.estimate, (2 * 3 + 316685 * 0.3 + 977 * 6 + 5175 * 15) / 1e6);
});

test('tied usage snapshots keep the later pricing metadata', () => {
  const usage = { input_tokens: 100, output_tokens: 40 };
  const records = [prompt, reply('fast', usage), reply('fast', { ...usage, speed: 'fast' })];
  const stats = sessionStats(records);
  assert.equal(stats.tokens, 140);
  assert.equal(stats.output, 40);
  assert.equal(stats.estimate, null, 'fast-mode pricing must remain unknown');
  assert.equal(stats.cost, null);
  assert.equal(sessionStats([...records, { type: 'cost-state', totalCostUSD: 0.5 }]).cost, 0.5,
    'an authoritative final cost remains available when usage cannot be priced');
});
