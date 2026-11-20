const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readRecords, sessionStats, run } = require('../hooks/ponytail-band-import');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-long-records-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('assembles long records and UTF-8 characters across read boundaries', t => {
  const dir = fixture(t), file = path.join(dir, 'records.jsonl');
  const prefix = '{"ignored":"', suffix = '","type":"custom-title","customTitle":"';
  const title = prefix + 'x'.repeat((1 << 20) - 1 - Buffer.byteLength(prefix + suffix)) + suffix + '\u{1f680}"}';
  const prompt = { type: 'user', turnOrigin: 'human', timestamp: '2026-11-20T00:00:00Z', message: { content: 'a'.repeat(2 << 20) } };
  const reply = { type: 'assistant', timestamp: '2026-11-20T00:00:01Z', message: { id: 'reply', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 20 } } };
  fs.writeFileSync(file, title + '\r\n' + JSON.stringify(prompt) + '\n\n' + JSON.stringify(reply));
  const records = readRecords(file);
  assert.equal(records.length, 3);
  assert.equal(records[0].customTitle, '\u{1f680}');
  assert.equal(records[1].message.content, 'a'.repeat(500));
  const stats = sessionStats(records);
  assert.equal(stats.tokens, 30);
  assert.equal(stats.turns, 1);
  assert.equal(stats.agentMs, 1000);
  assert.equal(stats.name, '\u{1f680}');
});

test('continues after an invalid multi-chunk record and closes the final line', t => {
  const file = path.join(fixture(t), 'records.jsonl');
  fs.writeFileSync(file, '{' + 'x'.repeat(2 << 20) + '\n' + JSON.stringify({ type: 'custom-title', customTitle: 'Kept' }));
  assert.deepEqual(readRecords(file).map(r => r.customTitle), ['Kept']);
});

test('imports a transcript with a long prompt through the production ledger writer', t => {
  const dir = fixture(t), claude = path.join(dir, 'claude'), config = path.join(dir, 'config');
  const projects = path.join(claude, 'projects', '-work-shop');
  fs.mkdirSync(projects, { recursive: true });
  const rows = [
    { cwd: '/work/shop', type: 'user', turnOrigin: 'human', timestamp: '2026-11-20T00:00:00Z', message: { content: 'Long report ' + 'x'.repeat(2 << 20) } },
    { type: 'assistant', timestamp: '2026-11-20T00:00:01Z', message: { id: 'reply', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 20 } } },
  ];
  fs.writeFileSync(path.join(projects, 'abcd1234-0000.jsonl'), rows.map(JSON.stringify).join('\n'));
  const old = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  process.env.CLAUDE_CONFIG_DIR = claude;
  process.env.XDG_CONFIG_HOME = config;
  try {
    assert.deepEqual(run(), { sessions: 1, added: 1 });
    const csv = fs.readFileSync(path.join(config, 'ponytail/band/shop.csv'), 'utf8');
    assert.match(csv, /Long report x+/);
    assert.match(csv, /,1,0\.0,30,20,/);
    assert.match(csv, /,import,claude-opus-5-5\n$/);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
