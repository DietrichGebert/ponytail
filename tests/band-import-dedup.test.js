const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { csvRow, mergeRows, run } = require('../hooks/ponytail-band-import');

test('one import batch adds a repeated session only once', () => {
  const stats = {
    startedMs: Date.parse('2026-10-01T10:00:00Z'), name: 'Fix totals', cost: 1,
    turns: 1, agentMs: 1000, tokens: 100, output: 10, model: 'claude-opus-5-5',
  };
  const row = csvRow('abcd1234-0000', 'shop', stats);
  const other = csvRow('ffff0000-0000', 'shop', stats);
  const merged = mergeRows('', [row, row, other, row]);
  assert.equal(merged.added, 2);
  assert.deepEqual(merged.text.trimEnd().split('\n').slice(1), [row, other]);
});

test('copied transcripts in one or several projects do not double the first import', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-import-dedup-'));
  const previous = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  process.env.CLAUDE_CONFIG_DIR = path.join(temporary, 'claude');
  process.env.XDG_CONFIG_HOME = path.join(temporary, 'config');
  try {
    for (const [folder, project] of [['a', 'alpha'], ['b', 'alpha'], ['c', 'beta']]) {
      const directory = path.join(temporary, 'claude', 'projects', folder);
      fs.mkdirSync(directory, { recursive: true });
      const records = [
        { type: 'user', timestamp: '2026-10-01T10:00:00Z', origin: { kind: 'human' }, message: { content: 'Fix totals' } },
        { type: 'assistant', timestamp: '2026-10-01T10:00:01Z', message: { id: 'reply-1', model: 'claude-opus-5-5', usage: { input_tokens: 90, output_tokens: 10 } } },
      ].map(record => ({ ...record, cwd: `/real-projects/${project}` }));
      fs.writeFileSync(path.join(directory, 'abcd1234-0000.jsonl'), records.map(record => JSON.stringify(record)).join('\n') + '\n');
    }
    assert.deepEqual(run(), { sessions: 3, added: 1 });
    const ledger = path.join(temporary, 'config', 'ponytail', 'band');
    const files = fs.readdirSync(ledger).filter(file => file.endsWith('.csv'));
    const rows = files.flatMap(file => fs.readFileSync(path.join(ledger, file), 'utf8').trimEnd().split('\n').slice(1));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].split(',')[7], '100', 'the copied transcript contributes its tokens once');
    assert.deepEqual(run(), { sessions: 3, added: 0 });
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
