const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const importer = path.join(root, 'hooks', 'ponytail-band-import.js');
const firstID = 'abcd1234-1111-4111-8111-111111111111';
const secondID = 'abcd1234-2222-4222-8222-222222222222';
const started = Date.UTC(2026, 9, 1, 10);
let board, metrics;

test.before(async () => {
  const source = path.join(root, 'hooks', 'band');
  const moduleUrl = (file, from, to) => 'data:text/javascript;base64,' + Buffer.from(
    stripTypeScriptTypes(fs.readFileSync(path.join(source, file), 'utf8').replace(from, JSON.stringify(to)))
  ).toString('base64');
  const url = moduleUrl('board.ts', "'./logo'", pathToFileURL(path.join(source, 'logo.ts')).href);
  board = await import(url);
  metrics = await import(moduleUrl('metrics.ts', "'./board'", url));
});

function setup(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-session-id-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const claude = path.join(temp, 'claude');
  const config = path.join(temp, 'config');
  const project = path.join(claude, 'projects', '-work-shop');
  const ledger = path.join(config, 'ponytail', 'band', 'shop.csv');
  fs.mkdirSync(project, { recursive: true });
  const write = (id, offset, name) => {
    const cwd = '/work/shop';
    fs.writeFileSync(path.join(project, id + '.jsonl'), [
      { type: 'user', cwd, timestamp: new Date(started + offset).toISOString(), origin: { kind: 'human' }, message: { content: name } },
      { type: 'assistant', cwd, timestamp: new Date(started + offset + 5000).toISOString(), message: { id: 'message-' + id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 } } },
    ].map(r => JSON.stringify(r)).join('\n') + '\n');
  };
  const run = () => {
    const result = spawnSync(process.execPath, [importer], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: claude, XDG_CONFIG_HOME: config },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  return { write, run, ledger };
}

test('history import keeps different UUIDs that share their first eight characters', (t) => {
  const { write, run, ledger } = setup(t);
  write(firstID, 0, 'First task');
  assert.match(run(), /1 past sessions found, 1 new rows/);
  write(secondID, 60000, 'Second task');
  assert.match(run(), /2 past sessions found, 1 new rows/);
  const csv = fs.readFileSync(ledger, 'utf8');
  const rows = board.parseCsv(csv).slice(1);
  assert.deepEqual(rows.map(r => r[0]), [`${firstID}-${started}`, `${secondID}-${started + 60000}`]);
  assert.deepEqual(board.tasksFrom(csv).map(t => t.name), ['First task', 'Second task']);
  assert.match(run(), /2 past sessions found, 0 new rows/);
  assert.equal(fs.readFileSync(ledger, 'utf8'), csv);
});

function state(session, name = 'Live task') {
  return {
    session, name, project: 'shop', level: 'full', model: 'claude-opus-5-5',
    spent: 0.5, turnCosts: [0.5], turns: 1, busyMs: 5000,
    tokens: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 },
    reused: [], created: [], openCallers: [], tests: { state: 'none' },
  };
}

test('live ledger updates keep distinct full session IDs even with the same start time', () => {
  assert.equal(metrics.taskKey(firstID, started), `${firstID}-${started}`);
  const first = metrics.snapshot(state(firstID, 'First task'), started);
  const second = metrics.snapshot(state(secondID, 'Second task'), started);
  const csv = metrics.upsertCsv(metrics.upsertCsv('', first), second);
  assert.deepEqual(board.tasksFrom(csv).map(t => t.name), ['First task', 'Second task']);
  assert.equal(metrics.upsertCsv(csv, second), csv);
});

test('resuming and updating a legacy short-key row preserves its accumulated work', () => {
  const legacy = { ...metrics.snapshot(state(firstID), started), key: `abcd1234-${started}` };
  const csv = metrics.CSV_HEADER + '\n' + metrics.csvRow(legacy) + '\n';
  const fresh = { ...state(firstID, ''), busyMs: 0, tokens: metrics.NO_TOKENS };
  const restored = metrics.resume(fresh, csv, `${firstID}-${started}`);
  assert.equal(restored.name, 'Live task');
  assert.equal(restored.busyMs, 6000);
  assert.equal(metrics.totalTokens(restored.tokens), 15);
  assert.equal(restored.tokens.output, 5);
  const updated = metrics.upsertCsv(csv, metrics.snapshot(restored, started));
  assert.equal(board.tasksFrom(updated).length, 1);
  assert.equal(board.parseCsv(updated)[1][0], `${firstID}-${started}`);
  assert.equal(metrics.resume(fresh, updated, `${firstID}-${started}`).name, 'Live task');
});

test('a legacy import marker still prevents duplicate history without guessing its full UUID', (t) => {
  const { write, run, ledger } = setup(t);
  const legacy = { ...metrics.snapshot(state(firstID), started), key: `abcd1234-${started}` };
  const csv = metrics.CSV_HEADER + '\n' + metrics.csvRow(legacy) + '\n';
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.writeFileSync(ledger, csv);
  write(firstID, 0, 'First task');
  write(secondID, 60000, 'Second task');
  assert.match(run(), /2 past sessions found, 0 new rows/);
  assert.equal(fs.readFileSync(ledger, 'utf8'), csv);
});
