#!/usr/bin/env node
// ponytail — imports past Claude Code sessions into the band's task ledger, so the board can
// compare them: cost, agent time, tokens, turns, name and model. Started in the background by
// `/ponytail band import`; also runs by hand. Sessions already in the ledger are left alone.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { StringDecoder } = require('string_decoder');
const { getClaudeDir } = require('./ponytail-config');

// The band's columns (CSV_HEADER in hooks/band/metrics.ts; a test keeps the two equal).
const CSV_HEADER = 'key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,reuse_pct,reused,new,callers_open,tests,level,model';

// USD per million tokens from https://platform.claude.com/docs/en/about-claude/pricing, checked
// 2026-10-17: [input, 5-minute cache write, 1-hour cache write, cache read, output]. Opus 5.5 and
// Fable 5.1 also match Claude Code's own totals in real transcripts. A model missing here, or a
// fast-mode reply, gets no estimate: an empty cost beats a guessed one.
const OPUS = [5, 6.25, 10, 0.5, 25];
const PRICES = {
  'claude-fable-5-1': [10, 12.5, 20, 0.25, 50],
  'claude-fable-5': [10, 12.5, 20, 1, 50],
  'claude-opus-5-5': [4, 5, 8, 0.2, 20],
  'claude-opus-5': OPUS,
  'claude-opus-4-8': OPUS,
  'claude-opus-4-7': OPUS,
  'claude-opus-4-6': OPUS,
  'claude-opus-4-5': OPUS,
  'claude-sonnet-5-5': [2, 2.5, 4, 0.1, 10],
  'claude-sonnet-5': [2, 2.5, 4, 0.2, 10],
  'claude-sonnet-4-6': [3, 3.75, 6, 0.3, 15],
  'claude-sonnet-4-5': [3, 3.75, 6, 0.3, 15],
  'claude-haiku-5-5': [0.1, 0.125, 0.2, 0.01, 0.5],
  'claude-haiku-4-5': [1, 1.25, 2, 0.1, 5],
};
// Haiku 5.5 bills a request whose prompt (input, cache reads and writes) is over 100,000 tokens higher.
const HAIKU_55_LONG = [0.5, 0.625, 1, 0.05, 2.5];
const WEB_SEARCH = 10 / 1000;
const IDLE_MS = 30 * 60000;
const modelId = m => m.replace(/\[.*\]$/, '').replace(/-\d{8}$/, '');

// One reply's price from its usage, or null when the price is not known.
function replyCost(model, u) {
  let p = PRICES[modelId(model)];
  if (!p || u.speed === 'fast') return null;
  const cc = u.cache_creation || {};
  const split = cc.ephemeral_5m_input_tokens !== undefined || cc.ephemeral_1h_input_tokens !== undefined;
  const w5 = split ? cc.ephemeral_5m_input_tokens || 0 : u.cache_creation_input_tokens || 0;
  const w1 = split ? cc.ephemeral_1h_input_tokens || 0 : 0;
  const input = u.input_tokens || 0;
  const read = u.cache_read_input_tokens || 0;
  if (modelId(model) === 'claude-haiku-5-5' && input + read + w5 + w1 > 100000) p = HAIKU_55_LONG;
  const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  return (input * p[0] + w5 * p[1] + w1 * p[2] + read * p[3] + (u.output_tokens || 0) * p[4]) / 1e6 + searches * WEB_SEARCH;
}

const human = r => r.type === 'user' && (r.turnOrigin === 'human' || (r.origin && r.origin.kind === 'human'));
const promptText = r => {
  const c = r.message && r.message.content;
  const t = typeof c === 'string' ? c : Array.isArray(c) ? (c.find(b => b && b.type === 'text') || {}).text || '' : '';
  return t.trim();
};
const ms = r => (r.timestamp ? Date.parse(r.timestamp) : NaN);
const toolResult = r => (r.toolResult !== undefined ? r.toolResult
  : Array.isArray(r.message && r.message.content) && r.message.content.some(b => b && b.type === 'tool_result'));

// Only what the numbers need from one record: a long session's transcript can pass 500 MB.
function slim(r) {
  const m = r.message || {};
  const c = human(r) ? m.content : undefined;
  const text = typeof c === 'string' ? c.slice(0, 500)
    : Array.isArray(c) ? c.filter(b => b && b.type === 'text').slice(0, 1).map(b => ({ type: 'text', text: String(b.text).slice(0, 500) })) : undefined;
  return {
    type: r.type, timestamp: r.timestamp, turnOrigin: r.turnOrigin, origin: r.origin && { kind: r.origin.kind },
    isMeta: r.isMeta, toolResult: toolResult(r),
    sessionId: r.sessionId, customTitle: r.customTitle, totalCostUSD: r.totalCostUSD,
    message: { id: m.id, model: m.model, usage: m.usage, content: text },
  };
}

// A JSONL file line by line, so no transcript is too big to read (one string stops at 512 MB).
function readRecords(file) {
  const out = [];
  const take = l => { if (l.startsWith('{')) try { out.push(slim(JSON.parse(l))); } catch (e) {} };
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  const dec = new StringDecoder('utf8');
  let rest = '';
  try {
    for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) {
      const parts = (rest + dec.write(buf.subarray(0, n))).split('\n');
      rest = parts.pop();
      parts.forEach(take);
    }
    take(rest + dec.end());
  } finally {
    fs.closeSync(fd);
  }
  return out;
}

// One session's numbers from its transcript records and its subagents' records. Null for a session
// nobody typed into (benchmarks, `claude -p`, scripts) or one without a model reply.
function sessionStats(records, subagentRecords = [], sessionId = '') {
  const prompts = records.filter(human);
  if (prompts.length === 0) return null;

  // Usage repeats on every record of one message: count each message id once, subagents included.
  const seen = new Set();
  const replies = {};
  let tokens = 0;
  let output = 0;
  let estimate = 0;
  const reply = r => r.type === 'assistant' && r.message && r.message.model && r.message.model !== '<synthetic>';
  for (const r of records) if (reply(r)) replies[r.message.model] = (replies[r.message.model] || 0) + 1;
  for (const r of [...records, ...subagentRecords]) {
    if (!reply(r)) continue;
    const { id, model, usage } = r.message;
    if (!usage || !id || seen.has(id)) continue;
    seen.add(id);
    tokens += (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    output += usage.output_tokens || 0;
    const c = replyCost(model, usage);
    estimate = estimate === null || c === null ? null : estimate + c;
  }
  const models = Object.keys(replies);
  if (models.length === 0) return null;

  // A turn starts with any new message: a typed prompt, a slash command (not marked as typed) or a
  // background notification. It lasts until the model's last reply or tool result before the next
  // one, so time waiting between messages, even days before a session is reopened, never counts.
  let turns = 0;
  let agentMs = 0;
  const starts = r => r.type === 'user' && !toolResult(r) && !r.isMeta;
  const at = records.map((r, i) => (starts(r) ? i : -1)).filter(i => i >= 0);
  for (let k = 0; k < at.length; k++) {
    const work = records.slice(at[k] + 1, k + 1 < at.length ? at[k + 1] : records.length)
      .filter(r => r.type === 'assistant' || (r.type === 'user' && toolResult(r)));
    if (!work.some(r => r.type === 'assistant')) continue;
    turns++;
    // A pause of over 30 minutes inside a turn is someone not answering a permission prompt, not work.
    // shortcut: a single tool run over 30 minutes counts as zero; raise IDLE_MS if long builds go missing.
    let prev = ms(records[at[k]]);
    for (const t of work.map(ms).filter(Number.isFinite)) {
      if (Number.isFinite(prev) && t > prev && t - prev <= IDLE_MS) agentMs += t - prev;
      prev = Math.max(Number.isFinite(prev) ? prev : t, t);
    }
  }
  if (turns === 0) return null;

  // Two sources, and each can only miss calls: Claude Code's own total covers just its last
  // process run (a reopened session can say $0), the estimate misses side calls the transcript
  // does not log (titles, compaction, internal Haiku). So the larger one wins.
  // shortcut: without an own total the estimate runs 0-15% low in real sessions; nothing better is logged.
  const last = (a, f) => { for (let i = a.length - 1; i >= 0; i--) if (f(a[i])) return i; return -1; };
  const costAt = last(records, r => r.type === 'cost-state' && (!sessionId || r.sessionId === sessionId));
  const own = costAt >= 0 && last(records, r => r.type === 'assistant') < costAt ? records[costAt].totalCostUSD : null;
  const known = [own, estimate].filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const cost = known.length ? Math.max(...known) : null;
  const titled = records.filter(r => r.type === 'custom-title' && typeof r.customTitle === 'string' && r.customTitle.trim());
  const first = prompts.map(promptText).find(t => t && !t.startsWith('<') && !t.startsWith('/')) || '';
  const started = records.map(ms).find(Number.isFinite);
  return {
    startedMs: started,
    name: (titled.length ? titled[titled.length - 1].customTitle.trim() : first.split('\n')[0]).slice(0, 60),
    model: models.sort((a, b) => replies[b] - replies[a])[0],
    cost,
    own,
    estimate,
    turns,
    agentMs,
    tokens,
    output,
  };
}

// Same stamp and quoting as the band (hooks/band/metrics.ts), so the board reads both alike.
const two = n => String(n).padStart(2, '0');
const stamp = t => { const d = new Date(t); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`; };
const field = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function csvRow(sessionId, project, s) {
  return [`${sessionId.slice(0, 8)}-${s.startedMs}`, stamp(s.startedMs), project, s.name, s.cost === null ? '' : s.cost.toFixed(2), s.turns,
    (s.agentMs / 60000).toFixed(1), s.tokens, s.output, '', '', '', '', '', 'import', s.model].map(field).join(',');
}

// New rows go in after the ledger's own: a newer header replaces an older one, and a session
// already recorded anywhere in the ledger (same session id prefix) is never imported twice.
const sessionOf = row => row.slice(0, 9);
function mergeRows(existing, rows, have = new Set()) {
  const kept = existing.split('\n').filter(l => l !== '' && !l.startsWith('key,'));
  const added = rows.filter(r => !have.has(sessionOf(r)) && !kept.some(l => sessionOf(l) === sessionOf(r)));
  return { text: [CSV_HEADER, ...kept, ...added].join('\n') + '\n', added: added.length };
}

const TEMP = [os.tmpdir(), '/tmp/', '/private/tmp/', '/var/folders/', '/private/var/folders/'];
// A worktree counts for its main repo: the desktop app's <repo>/.claude/worktrees/<name> even
// after it is gone, and any git worktree through its common .git dir.
function projectOf(cwd, cache) {
  if (!cache.has(cwd)) {
    let root = cwd.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0];
    if (fs.existsSync(root)) {
      const git = spawnSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
      if (git.status === 0 && /[\\/]\.git$/.test(git.stdout.trim())) root = path.dirname(git.stdout.trim());
    }
    cache.set(cwd, path.basename(root.replace(/[\\/]+$/, '')));
  }
  return cache.get(cwd);
}

function ledgerDir() {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'ponytail', 'band');
}

function run() {
  const root = path.join(getClaudeDir(), 'projects');
  const byProject = new Map();
  const roots = new Map();
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch (e) { return { sessions: 0, added: 0 }; }
  let sessions = 0;
  for (const dir of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.jsonl')); } catch (e) { continue; }
    for (const file of files) {
      const p = path.join(root, dir, file);
      // The working dir sits in the first records; scratch and temp dirs are never real projects.
      let head = '';
      try { const fd = fs.openSync(p, 'r'); const b = Buffer.alloc(65536); head = b.toString('utf8', 0, fs.readSync(fd, b, 0, b.length, 0)); fs.closeSync(fd); } catch (e) { continue; }
      const m = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(head);
      if (!m) continue;
      const cwd = JSON.parse(`"${m[1]}"`);
      if (TEMP.some(t => cwd.startsWith(t)) || cwd === '/tmp') continue;
      // A session's first prompt is typed by a person; automated runs (benchmarks, `claude -p`) never are.
      if (head.includes('"type":"user"') && !/"turnOrigin":"human"|"origin":\{"kind":"human"/.test(head)) continue;
      const id = file.slice(0, -'.jsonl'.length);
      let records;
      try { records = readRecords(p); } catch (e) { continue; }
      const sub = path.join(root, dir, id, 'subagents');
      let subRecords = [];
      try { subRecords = fs.readdirSync(sub).filter(f => /^agent-.*\.jsonl$/.test(f)).flatMap(f => readRecords(path.join(sub, f))); } catch (e) {}
      const stats = sessionStats(records, subRecords, id);
      if (!stats || !Number.isFinite(stats.startedMs)) continue;
      sessions++;
      const project = projectOf(cwd, roots);
      if (!byProject.has(project)) byProject.set(project, []);
      byProject.get(project).push(csvRow(id, project, stats));
    }
  }
  const dir = ledgerDir();
  fs.mkdirSync(dir, { recursive: true });
  const have = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.csv'))) {
    try { fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach(l => l && !l.startsWith('key,') && have.add(sessionOf(l))); } catch (e) {}
  }
  let added = 0;
  for (const [project, rows] of byProject) {
    const file = path.join(dir, `${project.replace(/[^\w.-]/g, '_')}.csv`);
    let existing = '';
    try { existing = fs.readFileSync(file, 'utf8'); } catch (e) {}
    const merged = mergeRows(existing, rows, have);
    if (merged.added > 0) fs.writeFileSync(file, merged.text);
    added += merged.added;
  }
  return { sessions, added };
}

if (require.main === module) {
  const { sessions, added } = run();
  process.stdout.write(`ponytail band import: ${sessions} past sessions found, ${added} new rows in the board.\n`);
}

module.exports = { CSV_HEADER, PRICES, replyCost, sessionStats, csvRow, mergeRows, readRecords, run };
