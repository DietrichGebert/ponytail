const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { stripTypeScriptTypes } = require('node:module');
const { pathToFileURL } = require('node:url');
const { sessionStats, run } = require('../hooks/ponytail-band-import');

const prompt = { type: 'user', timestamp: '2026-10-01T10:00:00Z', origin: { kind: 'human' }, message: { content: 'Fix the totals' } };
const reply = (id, model, second = 1) => ({ type: 'assistant', timestamp: `2026-10-01T10:00:0${second}Z`, message: { id, model, usage: { input_tokens: 100, output_tokens: 10 } } });
const opus = 'claude-opus-5-5';
const haiku = 'claude-haiku-5-5';
const unique = [prompt, reply('opus-1', opus), reply('opus-2', opus, 2), reply('haiku-1', haiku, 3)];
const streamed = [...unique, ...Array.from({ length: 7 }, () => reply('haiku-1', haiku, 3))];

test('model attribution counts main reply identities instead of streamed records', () => {
  const expected = sessionStats(unique);
  const actual = sessionStats(streamed);
  assert.equal(actual.model, opus);
  assert.deepEqual(actual, expected, 'repeated fragments change neither attribution nor usage and time totals');
});

test('model ties retain the first distinct reply in transcript order', () => {
  assert.equal(sessionStats([prompt, reply('first', haiku), reply('second', opus), reply('second', opus)]).model, haiku);
});

test('subagents do not vote for the main model and missing IDs retain their record counts', () => {
  assert.equal(sessionStats(unique, Array.from({ length: 8 }, (_, i) => reply(`sub-${i}`, haiku))).model, opus);
  assert.equal(sessionStats([prompt, reply(undefined, opus), reply(undefined, opus), reply('known', haiku)]).model, opus);
});

test('the real JSONL import and board retain the independently counted main model', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-model-'));
  const projects = path.join(temp, 'claude', 'projects', '-work-shop');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'session-123.jsonl'), streamed.map(r => JSON.stringify({ ...r, cwd: '/work/shop' })).join('\n'));
  const saved = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  process.env.CLAUDE_CONFIG_DIR = path.join(temp, 'claude');
  process.env.XDG_CONFIG_HOME = path.join(temp, 'config');
  try {
    assert.deepEqual(run(), { sessions: 1, added: 1 });
    const csv = fs.readFileSync(path.join(temp, 'config', 'ponytail', 'band', 'shop.csv'), 'utf8');
    const dir = path.join(__dirname, '..', 'hooks', 'band');
    const source = fs.readFileSync(path.join(dir, 'board.ts'), 'utf8')
      .replace("'./logo'", JSON.stringify(pathToFileURL(path.join(dir, 'logo.ts')).href));
    const { tasksFrom, boardHtml } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
    const tasks = tasksFrom(csv);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].model, opus);
    assert.equal(tasks[0].tokens, 330);
    const data = JSON.parse(boardHtml(tasks, Date.UTC(2026, 9, 2)).match(/<script type="application\/json" id="board-data">([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.tasks[0].model, opus);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
