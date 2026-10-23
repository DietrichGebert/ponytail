// Pure helpers for the band: no `$`, so the tests call them directly.

import { duration, elapsed, fmtTokens, parseCsv } from './board'
import type { Band, Tokens } from './types'

export { duration, elapsed, fmtTokens }

// Same skip rules as ponytail-map.js: tests, vendored and generated code are not "reuse".
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|vendor|venv|\.venv|__pycache__|coverage|\.next|target|migrations|fixtures|tests?|__tests__|spec)(\/|$)/
const SKIP_FILE = /(^|\/)(test_[^/]*|[^/]*(_test|\.test|\.spec|\.gen|\.min|\.d)\.[a-z]+)$/

// Top-level definitions per language, close to ponytail-map.js, plus plain JS functions.
// shortcut: regex, not a parser; nested and dynamic definitions are missed. Use tree-sitter if it matters.
const DEFS: [RegExp, RegExp[]][] = [
  [/\.py$/, [/^(?:async\s+)?def\s+([A-Za-z]\w*)/gm, /^class\s+([A-Za-z]\w*)/gm]],
  [/\.[cm]?[jt]sx?$/, [
    /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/gm,
  ]],
  [/\.go$/, [/^func\s+(?:\([^)]*\)\s*)?([A-Za-z]\w*)/gm]],
  [/\.rs$/, [/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm]],
  [/\.rb$/, [/^\s*def\s+(?:self\.)?([A-Za-z]\w*[?!]?)/gm]],
]

// Lines worth a closer look; the per-language regexes above decide.
export const GREP_DEFS = '^[[:space:]]*(export|async|def|class|function|func|pub|fn)[[:space:]]'

// Names too generic to say anything about reuse.
const GENERIC = new Set(['main', 'init', 'run', 'get', 'set', 'test', 'setup', 'open', 'close', 'read', 'write', 'start', 'stop', 'load', 'save', 'update', 'create', 'delete', 'handle', 'render', 'index', 'new', 'call', 'apply'])

export const isCode = (file: string) => DEFS.some(([ext]) => ext.test(file))

export const isSource = (file: string) => isCode(file) && !SKIP_DIR.test(file) && !SKIP_FILE.test(file)

export function defsIn(file: string, text: string): string[] {
  const rules = DEFS.find(([ext]) => ext.test(file))?.[1] ?? []
  const names = new Set<string>()
  for (const re of rules) for (const m of text.matchAll(re)) if (m[1]) names.add(m[1])
  return [...names]
}

export type Hit = { file: string; line: string; text: string }

// `git grep -n` output, one "file:line:text" row each.
export const hits = (stdout: string): Hit[] =>
  stdout.split('\n').flatMap(row => {
    const m = /^(.+?):(\d+):(.*)$/.exec(row)
    return m ? [{ file: m[1] ?? '', line: m[2] ?? '', text: m[3] ?? '' }] : []
  })

// Existing definitions, name -> "file:line".
export function parseDefs(stdout: string): Map<string, string> {
  const known = new Map<string, string>()
  for (const hit of hits(stdout)) {
    if (!isSource(hit.file)) continue
    for (const name of defsIn(hit.file, hit.text.trimStart())) {
      if (!known.has(name)) known.set(name, `${hit.file}:${hit.line}`)
    }
  }
  return known
}

// Lines of `after` that `before` did not have: what an edit added.
export function addedLines(before: string, after: string): string {
  const old = new Set(before.split('\n'))
  return after.split('\n').filter(line => !old.has(line)).join('\n')
}

// Known names the added code calls, skipping its own new definitions.
export function callsIn(text: string, known: Map<string, string>, own: string[]): string[] {
  const names = new Set<string>()
  for (const m of text.matchAll(/(?<![\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1] ?? ''
    if (known.has(name) && !own.includes(name) && !GENERIC.has(name.toLowerCase())) names.add(name)
  }
  return [...names]
}

const norm = (name: string) => name.toLowerCase().replace(/[_-]/g, '')

// A new definition whose name an existing one already has, ignoring case and _ (format_price vs formatPrice).
// shortcut: names only; a helper rewritten under another name (parse_price vs to_cents) is not found.
export function duplicateOf(name: string, file: string, known: Map<string, string>): string | undefined {
  for (const [other, where] of known) {
    const at = where.slice(0, where.lastIndexOf(':'))
    const sameFile = file === at || file.endsWith(`/${at}`)
    if (norm(other) === norm(name) && !sameFile) return `${other} (${where})`
  }
  return undefined
}

const TEST_CMD = /\b(npm (run )?test|pnpm (run )?test|yarn test|bun test|npx (jest|vitest)|jest|vitest|pytest|python3? -m pytest|go test|cargo test|mvn test|gradle test|rspec|phpunit|dotnet test|node --test|deno test|make test)\b/

export const isTestCommand = (command: string) => TEST_CMD.test(command)

// Pass and fail counts from common runners: pytest, jest/vitest, cargo, node --test, TAP.
export function testCounts(output: string): { passed?: number; failed?: number } {
  const num = (re: RegExp) => {
    const m = re.exec(output)
    return m ? Number(m[1]) : undefined
  }
  return {
    passed: num(/(\d+) (?:passed|passing)\b/) ?? num(/(?:ℹ |# )pass (\d+)/),
    failed: num(/(\d+) (?:failed|failing)\b/) ?? num(/(?:ℹ |# )fail (\d+)/),
  }
}

export type Col = { key: string; label: string; value: string; sub: string; tone?: 'warning' | 'success' | 'error' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s)

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
// The image cannot read the app's theme, so it follows the system's.
// shortcut: an app theme that differs from the system theme gets the wrong text color; pass the theme in if that bites.
const STYLE = `.l,.s{fill:#87867f;font:12px ${FONT}}.v{fill:#1f1e1d;font:600 16px ${FONT}}.d{stroke:#1f1e1d;stroke-opacity:.12}.b{fill:#87867f}.warning{fill:#a86400}.success{fill:#2e7d32}.error{fill:#c62828}@media (prefers-color-scheme:dark){.v{fill:#ecebe6}.d{stroke:#fff;stroke-opacity:.14}.warning{fill:#e3a03d}.success{fill:#6abf69}.error{fill:#ef6a5a}}`

// The details row as one SVG for surfaces that draw it: real 1px dividers and exact columns.
export function metricsSvg(cols: Col[], turnCosts: number[], width = 720): string {
  const height = 64
  const colW = width / Math.max(1, cols.length)
  const max = Math.max(...turnCosts, 0)
  let body = `<line class="d" x1="0" y1="0.5" x2="${width}" y2="0.5"/>`
  cols.forEach((c, i) => {
    const x = i * colW + (i === 0 ? 0 : 12)
    const tone = c.tone ? ` ${c.tone}` : ''
    if (i > 0) body += `<line class="d" x1="${i * colW}" y1="14" x2="${i * colW}" y2="${height - 2}"/>`
    body += `<text class="l" x="${x}" y="24">${esc(c.label)}</text>`
    body += `<text class="v${tone}" x="${x}" y="44">${esc(fit(c.value, Math.floor((colW - 16) / 9)))}</text>`
    if (c.sub) body += `<text class="s${c.tone === 'warning' ? tone : ''}" x="${x}" y="61">${esc(fit(c.sub, Math.floor((colW - 16) / 6.2)))}</text>`
    if (c.key === 'cost' && turnCosts.length > 1 && max > 0) {
      const bars = turnCosts.slice(-10)
      const x0 = (i + 1) * colW - 16 - bars.length * 5
      bars.forEach((v, j) => {
        const h = Math.max(1, Math.round((v / max) * 16))
        body += `<rect class="b" x="${x0 + j * 5}" y="${44 - h}" width="3" height="${h}" rx="1"/>`
      })
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>${STYLE}</style>${body}</svg>`
}

export const NO_TOKENS: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

export const addTokens = (t: Tokens, u: Usage): Tokens => ({
  input: t.input + u.input_tokens,
  output: t.output + u.output_tokens,
  cacheRead: t.cacheRead + u.cache_read_input_tokens,
  cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
})

export const totalTokens = (t: Tokens) => t.input + t.output + t.cacheRead + t.cacheWrite

export const stamp = (ms: number) => {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
}

export const testsLabel = (t: Band['tests']) =>
  t.state === 'pass' ? `${t.passed ?? ''} passed`.trim() : t.state === 'fail' ? `${t.failed ?? ''} failed`.trim() : t.state === 'stale' ? 'stale' : 'not run'

// Claude Code writes the session's sidebar name into its transcript on every rename.
export const TITLE_RECORD = '"type":"custom-title"'
// grep -o pattern for the model of every reply in a transcript.
export const MODEL_PATTERN = '"model":"claude-[^"]*"'

// The model that wrote most replies, from grep -o lines like "model":"claude-opus-5-5". Empty when none.
export function mainModel(grepOut: string): string {
  const count = new Map<string, number>()
  for (const m of grepOut.matchAll(/"model":"(claude-[^"]+)"/g)) count.set(m[1], (count.get(m[1]) ?? 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

// The newest sidebar name in transcript lines, or undefined when the session has none.
export function sessionTitle(jsonl: string): string | undefined {
  for (const line of jsonl.split('\n').reverse()) {
    if (!line.includes(TITLE_RECORD)) continue
    try {
      const r = JSON.parse(line) as { type?: unknown; customTitle?: unknown }
      if (r.type !== 'custom-title') continue
      const title = typeof r.customTitle === 'string' ? r.customTitle.trim() : ''
      return title === '' ? undefined : title.slice(0, 60)
    } catch {
      continue
    }
  }
  return undefined
}

// One session (one task) as it is exported, copied and sent.
export type Snapshot = {
  key: string
  started: string
  project: string
  name: string
  session: string
  level: string
  model: string
  cost: number
  lastTurn: number | null
  turns: number
  agentMs: number
  tokens: Tokens
  reuse: number | null
  reused: number
  created: number
  callersOpen: number
  tests: string
}

// A task's row in the ledger: the session and when it started (a /clear starts a new one).
export const taskKey = (session: string, startedAt: number) => `${session.slice(0, 8)}-${startedAt}`

// A band that starts again mid-session (a reload, an update, a second copy) picks up the session's
// row, so what only the band counts (tokens, agent time, the name) goes on instead of starting at zero.
// shortcut: the ledger keeps only the token total and output, so a resumed band books the rest as input.
export function resume(b: Band, csv: string, key: string): Band {
  const [head, ...rows] = parseCsv(csv)
  const row = head ? rows.find(r => r[head.indexOf('key')] === key) : undefined
  if (!head || !row) return b
  const at = (col: string) => row[head.indexOf(col)] ?? ''
  const total = Number(at('tokens_total')) || 0
  const output = Number(at('tokens_output')) || 0
  return {
    ...b,
    name: b.name || at('name'),
    busyMs: Math.max(b.busyMs, (Number(at('agent_minutes')) || 0) * 60000),
    tokens: total > totalTokens(b.tokens) ? { input: total - output, output, cacheRead: 0, cacheWrite: 0 } : b.tokens,
  }
}

export function snapshot(b: Band, startedAt: number): Snapshot {
  return {
    key: taskKey(b.session, startedAt),
    started: stamp(startedAt),
    project: b.project,
    name: b.name,
    session: b.session,
    level: b.level,
    model: b.model,
    // The session's cost as /cost totals it, since its start or the last /clear.
    cost: +b.spent.toFixed(4),
    lastTurn: b.turnCosts[b.turnCosts.length - 1] ?? null,
    turns: b.turns,
    agentMs: b.busyMs,
    tokens: b.tokens,
    reuse: percent(b.reused.length, b.created.length) ?? null,
    reused: b.reused.length,
    created: b.created.length,
    callersOpen: b.openCallers.length,
    tests: testsLabel(b.tests),
  }
}

const per = (total: number, n: number) => (n > 0 ? total / n : 0)

export function markdown(s: Snapshot): string {
  const t = s.tokens
  const rows = [
    ['Project', s.project],
    ['Started', s.started],
    ['Model', s.model || '–'],
    ['Cost', `$${s.cost.toFixed(2)}${s.lastTurn === null ? '' : ` · last turn $${s.lastTurn.toFixed(2)}`} · ⌀ $${per(s.cost, s.turns).toFixed(2)} / turn`],
    ['Turns', `${s.turns}`],
    ['Agent time', `${elapsed(s.agentMs)} · ⌀ ${elapsed(per(s.agentMs, s.turns))} / turn`],
    ['Tokens', `${fmtTokens(totalTokens(t))} (input ${fmtTokens(t.input)}, output ${fmtTokens(t.output)}, cache read ${fmtTokens(t.cacheRead)}, cache write ${fmtTokens(t.cacheWrite)})`],
    ['Reuse', `${s.reuse === null ? '–' : `${s.reuse}%`} (${s.reused} used, ${s.created} new)`],
    ['Callers open', `${s.callersOpen}`],
    ['Tests', s.tests],
    ['ponytail level', s.level],
    ['Session', `\`${s.session}\``],
  ]
  const cell = (v: string) => v.replace(/\|/g, '\\|')
  return [`## ${cell(s.name || 'Untitled session')}`, '', '| | |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${cell(v ?? '')} |`)].join('\n')
}

export const CSV_HEADER = 'key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,reuse_pct,reused,new,callers_open,tests,level,model'

const csvField = (v: string | number | null) => {
  let s = v === null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const csvRow = (s: Snapshot) =>
  [s.key, s.started, s.project, s.name, s.cost.toFixed(2), s.turns, (s.agentMs / 60000).toFixed(1), totalTokens(s.tokens), s.tokens.output, s.reuse, s.reused, s.created, s.callersOpen, s.tests, s.level, s.model]
    .map(csvField)
    .join(',')

// One row per session, replaced on every turn, so the file stays a table of tasks.
export function upsertCsv(existing: string, s: Snapshot): string {
  const rows = existing.split('\n').filter(line => line !== '' && !line.startsWith('key,') && !line.startsWith(`${s.key},`))
  return [CSV_HEADER, ...rows, csvRow(s)].join('\n') + '\n'
}

// shortcut: no share below 3 functions, where one new helper would read as "0% reuse"; tune the 3 if it shows too late.
export const percent = (reused: number, created: number) =>
  reused + created < 3 ? undefined : Math.round((reused / (reused + created)) * 100)

export type WebhookRequest = { url: string; init: { method: 'POST'; headers: Record<string, string>; body: string } }

// The token travels only over HTTPS; plain http is allowed for a board on this machine.
export function webhookRequest(url: string, token: string, sendNames: boolean, row: Snapshot): WebhookRequest | { refused: string } {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return { refused: 'webhook URL is not a URL' }
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && local)) return { refused: 'webhook needs https' }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== '') headers.authorization = `Bearer ${token}`
  return { url: target.href, init: { method: 'POST', headers, body: JSON.stringify(sendNames ? row : { ...row, name: '' }) } }
}
