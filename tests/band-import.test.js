#!/usr/bin/env node
// Past sessions into the band's board: numbers per session, prices, the CSV the band reads.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const { CSV_HEADER, replyCost, sessionStats, csvRow, mergeRows, run } = require('../hooks/ponytail-band-import');

// The import writes the band's own columns.
const metrics = fs.readFileSync(path.join(root, 'hooks', 'band', 'metrics.ts'), 'utf8');
assert.equal(CSV_HEADER, /export const CSV_HEADER = '([^']+)'/.exec(metrics)[1], 'import and band must write the same CSV columns');

// Prices per reply: the official table, Haiku 5.5's long-prompt tier, unknown and fast replies left out.
assert.equal(replyCost('claude-opus-5-5', { input_tokens: 1e6, output_tokens: 1e6 }), 24);
assert.equal(replyCost('claude-opus-5-5', { cache_read_input_tokens: 1e6, cache_creation: { ephemeral_5m_input_tokens: 1e6, ephemeral_1h_input_tokens: 1e6 } }), 0.2 + 5 + 8);
assert.equal(replyCost('claude-haiku-4-5-20251001', { input_tokens: 1e6 }), 1, 'a dated model id is the same model');
assert.equal(replyCost('claude-haiku-5-5', { input_tokens: 100000 }), 0.01, 'up to 100,000 prompt tokens: the short price');
assert.equal(replyCost('claude-haiku-5-5', { input_tokens: 200000 }), 0.1, 'over 100,000 prompt tokens: the long price');
assert.equal(replyCost('claude-opus-5-5', { output_tokens: 0, server_tool_use: { web_search_requests: 3 } }), 0.03);
assert.equal(replyCost('claude-unknown-9', { input_tokens: 1 }), null);
assert.equal(replyCost('claude-opus-5-5', { input_tokens: 1, speed: 'fast' }), null);

// A session: two typed prompts, a reply repeated per content block, a tool round trip, a subagent.
const at = s => `2026-10-01T10:${s}Z`;
const prompt = (t, text) => ({ type: 'user', timestamp: at(t), origin: { kind: 'human' }, message: { content: text } });
const reply = (t, id, usage, model = 'claude-opus-5-5') => ({ type: 'assistant', timestamp: at(t), message: { id, model, usage } });
const tool = t => ({ type: 'user', timestamp: at(t), message: { content: [{ type: 'tool_result' }] } });
const u = (input, output) => ({ input_tokens: input, output_tokens: output });
const records = [
  { type: 'user', timestamp: at('00:00'), message: { content: '<command-name>/ponytail</command-name>' } },
  prompt('00:00', 'Fix the cart totals\nplease'),
  reply('00:10', 'm1', u(1000, 100)),
  reply('00:10', 'm1', u(1000, 100)),
  tool('00:20'),
  reply('01:00', 'm2', u(2000, 200)),
  prompt('10:00', 'and the tax'),
  reply('10:30', 'm3', u(3000, 300)),
  prompt('20:00', 'thanks, that is all'),
];
const sub = [reply('00:15', 's1', u(500, 50), 'claude-haiku-5-5'), reply('00:15', 's1', u(500, 50), 'claude-haiku-5-5')];
const s = sessionStats(records, sub, 'abcd1234-0000');
assert.equal(s.turns, 2, 'only prompts the model answered are turns');
assert.equal(s.agentMs, 60000 + 30000, 'agent time runs from each prompt to its last reply or tool result');
assert.equal(s.tokens, 1100 + 2200 + 3300 + 550, 'each message counts once, subagents included');
assert.equal(s.output, 650);
assert.equal(s.name, 'Fix the cart totals');
assert.equal(s.model, 'claude-opus-5-5');
const est = (6000 * 4 + 600 * 20) / 1e6 + (500 * 0.1 + 50 * 0.5) / 1e6;
assert.ok(Math.abs(s.cost - est) < 1e-9, 'without an own total the estimate is the cost');

// Claude Code's own total, when final, wins over a lower estimate; a stale $0 never does.
const owned = sessionStats([...records, { type: 'cost-state', sessionId: 'abcd1234-0000', totalCostUSD: 1.5 }], sub, 'abcd1234-0000');
assert.equal(owned.cost, 1.5);
const zero = sessionStats([...records, { type: 'cost-state', sessionId: 'abcd1234-0000', totalCostUSD: 0 }], sub, 'abcd1234-0000');
assert.ok(Math.abs(zero.cost - est) < 1e-9);
const early = sessionStats([records[1], { type: 'cost-state', sessionId: 'abcd1234-0000', totalCostUSD: 9 }, ...records.slice(2)], sub, 'abcd1234-0000');
assert.ok(Math.abs(early.cost - est) < 1e-9, 'a total written before later replies is not final');
assert.equal(sessionStats([...records, { type: 'custom-title', customTitle: 'Cart totals' }]).name, 'Cart totals', 'the sidebar name wins');

// A session reopened a day later with a slash command: a new turn, and the day between is not work.
const later = sessionStats([...records,
  { type: 'user', timestamp: '2026-10-02T10:00:00Z', message: { content: '<command-name>/ponytail</command-name>' } },
  { type: 'user', timestamp: '2026-10-02T10:00:00Z', isMeta: true, message: { content: [{ type: 'text', text: 'skill body' }] } },
  { type: 'assistant', timestamp: '2026-10-02T10:00:05Z', message: { id: 'm9', model: 'claude-opus-5-5', usage: u(10, 1) } },
]);
assert.equal(later.turns, 3, 'the slash command the model answered is a turn');
assert.equal(later.agentMs, 60000 + 30000 + 5000, 'only the 5 seconds of work count, not the day before');

// A permission prompt left open for hours inside a turn is not work either.
const waited = sessionStats([prompt('00:00', 'deploy it'), reply('00:10', 'w1', u(1, 1)),
  { ...tool('00:20'), timestamp: '2026-10-01T15:00:20Z' }, { ...reply('00:00', 'w2', u(1, 1)), timestamp: '2026-10-01T15:00:30Z' }]);
assert.equal(waited.agentMs, 10000 + 10000, 'the five hours waiting for approval drop out');

// Nobody typed into it: a benchmark or `claude -p` run is not imported.
assert.equal(sessionStats(records.filter(r => !r.origin)), null);

// CSV: the band's format, an older header replaced, a recorded session never imported twice.
const row = csvRow('abcd1234-0000', 'shop', s);
assert.ok(row.startsWith(`abcd1234-${s.startedMs},`) && row.endsWith(',import,claude-opus-5-5'));
const formulaRow = csvRow('abcd1234-0000', 'shop', { ...s, name: '=2+2' });
assert.equal(formulaRow.split(',')[3], "'=2+2", 'a name starting with = is written as text, not a spreadsheet formula');
const old = 'key,started,project,name\nabcd1234-1,2026-10-01 10:00,shop,Live\n';
const merged = mergeRows(old, [row, csvRow('ffff0000-0000', 'shop', s)]);
assert.equal(merged.added, 1);
assert.equal(merged.text.split('\n')[0], CSV_HEADER);
assert.equal(mergeRows('', [row], new Set(['abcd1234-'])).added, 0, 'a session in another project file is not imported again');

// End to end: transcripts under CLAUDE_CONFIG_DIR, the ledger under XDG_CONFIG_HOME.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-import-'));
const projects = path.join(temp, 'claude', 'projects', '-work-shop');
fs.mkdirSync(path.join(projects, 'abcd1234-0000', 'subagents'), { recursive: true });
const withCwd = r => ({ ...r, cwd: '/work/shop/.claude/worktrees/brave-otter' });
fs.writeFileSync(path.join(projects, 'abcd1234-0000.jsonl'), records.map(withCwd).map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(projects, 'abcd1234-0000', 'subagents', 'agent-1.jsonl'), sub.map(r => JSON.stringify(r)).join('\n'));
fs.writeFileSync(path.join(projects, 'beef0000-1111.jsonl'), records.filter(r => !r.origin).map(withCwd).map(r => JSON.stringify(r)).join('\n'));
const env = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
process.env.CLAUDE_CONFIG_DIR = path.join(temp, 'claude');
process.env.XDG_CONFIG_HOME = path.join(temp, 'config');
try {
  assert.deepEqual(run(), { sessions: 1, added: 1 }, 'the typed session is imported, the automated one is not');
  const csv = fs.readFileSync(path.join(temp, 'config', 'ponytail', 'band', 'shop.csv'), 'utf8');
  assert.equal(csv.split('\n')[0], CSV_HEADER, 'a desktop worktree counts for its repo');
  assert.ok(csv.includes(',shop,Fix the cart totals,'));
  assert.deepEqual(run(), { sessions: 1, added: 0 }, 'a second import adds nothing');
} finally {
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('band import checks passed');
