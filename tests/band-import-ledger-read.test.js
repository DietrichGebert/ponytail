const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CSV_HEADER, run } = require('../hooks/ponytail-band-import');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-ledger-read-'));
  const before = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  process.env.CLAUDE_CONFIG_DIR = path.join(dir, 'claude');
  process.env.XDG_CONFIG_HOME = path.join(dir, 'config');
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const projects = path.join(dir, 'claude', 'projects', '-work-shop');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'bbbb2222-0000.jsonl'), [
    { type: 'user', cwd: '/work/shop', timestamp: '2026-10-01T10:00:00Z', origin: { kind: 'human' }, message: { content: 'New session' } },
    { type: 'assistant', timestamp: '2026-10-01T10:00:10Z', message: { id: 'new', model: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: 10 } } },
  ].map(record => JSON.stringify(record)).join('\n'));
  const ledger = path.join(dir, 'config', 'ponytail', 'band', 'shop.csv');
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  const original = `${CSV_HEADER}\naaaa1111-1,2026-09-01 09:00,shop,Previous session,1.00,1,1.0,100,10,,,,,,full,claude-opus-5-5\n`;
  fs.writeFileSync(ledger, original);
  return { ledger, original };
}

test('import preserves a write-only ledger when its deduplication scan cannot read it', {
  skip: process.platform === 'win32' || (process.getuid && process.getuid() === 0),
}, t => {
  const { ledger, original } = fixture(t);
  fs.chmodSync(ledger, 0o200);
  let error;
  try { run(); } catch (e) { error = e; }
  finally { fs.chmodSync(ledger, 0o600); }
  assert.equal(fs.readFileSync(ledger, 'utf8'), original, 'an unreadable ledger must not be treated as an empty one');
  assert.equal(error && error.code, 'EACCES');
});

test('import preserves the ledger if its merge read fails after the deduplication scan', t => {
  const { ledger, original } = fixture(t);
  const read = fs.readFileSync;
  const failure = Object.assign(new Error('fixture ledger read failed'), { code: 'EIO' });
  let reads = 0;
  fs.readFileSync = function(file, ...args) {
    if (file === ledger && ++reads === 2) throw failure;
    return read.call(this, file, ...args);
  };
  let error;
  try { run(); } catch (e) { error = e; }
  finally { fs.readFileSync = read; }
  assert.equal(read(ledger, 'utf8'), original, 'the previous rows must survive a later read error');
  assert.equal(error, failure, 'the real filesystem failure must reach the caller');
});

test('a ledger removed between listing and reading still permits a new import', t => {
  const { ledger } = fixture(t);
  const read = fs.readFileSync;
  let removed = false;
  fs.readFileSync = function(file, ...args) {
    if (file === ledger && !removed) { removed = true; fs.unlinkSync(ledger); }
    return read.call(this, file, ...args);
  };
  try { assert.deepEqual(run(), { sessions: 1, added: 1 }); }
  finally { fs.readFileSync = read; }
  assert.ok(read(ledger, 'utf8').includes('bbbb2222-'));
});
