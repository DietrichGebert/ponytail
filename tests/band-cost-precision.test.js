const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const importer = require('../hooks/ponytail-band-import');

const root = path.join(__dirname, '..');
function moduleUrl(file, replacements = []) {
  let source = stripTypeScriptTypes(fs.readFileSync(path.join(root, 'hooks/band', file), 'utf8'));
  for (const [from, to] of replacements) source = source.replace(from, JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const boardUrl = moduleUrl('board.ts', [["'./logo'", moduleUrl('logo.ts')]]);
const modules = Promise.all([import(boardUrl), import(moduleUrl('metrics.ts', [["'./board'", boardUrl]]))]);
const at = Date.UTC(2026, 9, 15, 12);
const band = {
  project: 'shop', name: 'Small task', level: 'full', model: 'claude-haiku-5-5',
  turnCosts: [], turns: 1, busyMs: 1000, tokens: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
  reused: [], created: [], openCallers: [], tests: { state: 'none' },
};

test('live snapshots and CSV round-trip every recorded cost without cent rounding', async () => {
  const [board, metrics] = await modules;
  const costs = [0.000014, 0.0049, 0, 1.23, 42.123456789];
  let csv = '';
  costs.forEach((cost, index) => {
    const row = metrics.snapshot({ ...band, spent: cost, session: String(index).padStart(8, '0') }, at + index);
    assert.equal(row.cost, cost);
    csv = metrics.upsertCsv(csv, row);
  });
  assert.deepEqual(board.tasksFrom(csv).map(task => task.cost), costs);
  assert.equal(board.tasksFrom(csv).reduce((sum, task) => sum + task.cost, 0), costs.reduce((sum, cost) => sum + cost, 0));
});

test('real history import preserves sub-cent session costs for board totals', async () => {
  const [board] = await modules;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-cost-precision-'));
  try {
    const projects = path.join(temp, 'claude', 'projects', 'shop');
    fs.mkdirSync(projects, { recursive: true });
    for (let index = 0; index < 10; index++) {
      const id = `${String(index).padStart(8, '0')}-session`;
      const records = [
        { type: 'user', timestamp: '2026-10-15T12:00:00Z', origin: { kind: 'human' }, message: { content: 'Small task' } },
        { type: 'assistant', timestamp: '2026-10-15T12:00:01Z', message: { id: `message-${index}`, model: 'claude-haiku-5-5', usage: { input_tokens: 1, output_tokens: 1 } } },
        { type: 'cost-state', timestamp: '2026-10-15T12:00:02Z', sessionId: id, totalCostUSD: 0.0049 },
      ].map(record => ({ ...record, cwd: path.join(root, 'cost-precision-shop') }));
      fs.writeFileSync(path.join(projects, `${id}.jsonl`), records.map(record => JSON.stringify(record)).join('\n'));
    }
    const result = spawnSync(process.execPath, [path.join(root, 'hooks/ponytail-band-import.js')], {
      encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(temp, 'claude'), XDG_CONFIG_HOME: path.join(temp, 'config') },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /10 past sessions found, 10 new rows/u);
    const csv = fs.readFileSync(path.join(temp, 'config/ponytail/band/cost-precision-shop.csv'), 'utf8');
    const tasks = board.tasksFrom(csv);
    assert.equal(tasks.length, 10);
    assert.ok(tasks.every(task => task.cost === 0.0049));
    assert.ok(Math.abs(tasks.reduce((sum, task) => sum + task.cost, 0) - 0.049) < 1e-12);
    const html = board.boardHtml(tasks, at);
    const data = JSON.parse(/<script type="application\/json" id="board-data">([^<]*)<\/script>/.exec(html)[1]);
    assert.deepEqual(data.tasks.map(task => task.cost), tasks.map(task => task.cost));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('old cent-valued ledgers and zero or unknown imported costs remain readable', async () => {
  const [board, metrics] = await modules;
  const stats = { startedMs: at, name: 'Legacy', cost: 0, turns: 1, agentMs: 1000, tokens: 2, output: 1, model: 'claude-haiku-5-5' };
  const zero = importer.csvRow('00000000-session', 'shop', stats);
  const unknown = importer.csvRow('11111111-session', 'shop', { ...stats, cost: null });
  const legacy = `${metrics.CSV_HEADER}\nold-1,2026-10-15 12:00,shop,Legacy,1.20,1,0.1,2,1,,0,0,0,not run,full,\n`;
  assert.equal(board.tasksFrom(legacy)[0].cost, 1.2);
  assert.equal(Number(board.parseCsv(zero)[0][4]), 0);
  assert.equal(board.parseCsv(unknown)[0][4], '');
  assert.match(metrics.markdown(metrics.snapshot({ ...band, spent: 1.2, session: '00000000-session' }, at)), /\$1\.20/);
});
