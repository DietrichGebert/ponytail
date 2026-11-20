const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CSV_HEADER, run } = require('../hooks/ponytail-band-import');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-import-write-'));
  const saved = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  process.env.CLAUDE_CONFIG_DIR = path.join(dir, 'claude');
  process.env.XDG_CONFIG_HOME = path.join(dir, 'config');
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const projects = path.join(dir, 'claude', 'projects', '-work-shop');
  fs.mkdirSync(projects, { recursive: true });
  const records = [
    { type: 'user', cwd: '/work/shop', timestamp: '2026-10-01T10:00:00Z', origin: { kind: 'human' }, message: { content: 'New imported task' } },
    { type: 'assistant', timestamp: '2026-10-01T10:00:05Z', message: { id: 'reply-1', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 2 } } },
  ];
  fs.writeFileSync(path.join(projects, 'abcd1234-0000.jsonl'), records.map(r => JSON.stringify(r)).join('\n'));
  const ledgerDir = path.join(dir, 'config', 'ponytail', 'band');
  fs.mkdirSync(ledgerDir, { recursive: true });
  const file = path.join(ledgerDir, 'shop.csv');
  const original = `${CSV_HEADER}\nfeed0000-1,2026-09-30 10:00,shop,Existing task,1.25,2,3.0,400,50,,,,,full,claude-opus-5-5\n`;
  fs.writeFileSync(file, original, { mode: 0o600 });
  return { file, ledgerDir, original };
}

function recover({ file, ledgerDir, original }) {
  assert.deepEqual(run(), { sessions: 1, added: 1 });
  const csv = fs.readFileSync(file, 'utf8');
  assert.ok(csv.startsWith(original), 'the original ledger survives a successful retry');
  assert.ok(csv.includes(',New imported task,'));
  assert.deepEqual(run(), { sessions: 1, added: 0 });
  assert.deepEqual(fs.readdirSync(ledgerDir), ['shop.csv']);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
}

test('a partial import write keeps the previous ledger and permits a clean retry', t => {
  const state = fixture(t);
  const write = fs.writeFileSync;
  const failure = Object.assign(new Error('no space left for ledger'), { code: 'ENOSPC' });
  const stub = t.mock.method(fs, 'writeFileSync', (file, data, options) => {
    write(file, String(data).slice(0, 23), options);
    throw failure;
  });
  assert.throws(run, error => error === failure);
  stub.mock.restore();
  assert.equal(fs.readFileSync(state.file, 'utf8'), state.original);
  assert.deepEqual(fs.readdirSync(state.ledgerDir), ['shop.csv']);
  recover(state);
});

test('failed import publication keeps the previous ledger and removes its temporary file', t => {
  const state = fixture(t);
  const rename = fs.renameSync;
  const failure = Object.assign(new Error('ledger replacement denied'), { code: 'EACCES' });
  const stub = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === state.file) throw failure;
    return rename(from, to);
  });
  assert.throws(run, error => error === failure);
  stub.mock.restore();
  assert.equal(fs.readFileSync(state.file, 'utf8'), state.original);
  assert.deepEqual(fs.readdirSync(state.ledgerDir), ['shop.csv']);
  recover(state);
});
