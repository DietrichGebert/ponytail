import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { boardHtml, tasksFrom } from './board'
import type { Band } from './types'
import type { Col } from './metrics'
import {
  GREP_DEFS,
  NO_TOKENS,
  addTokens,
  addedLines,
  callsIn,
  defsIn,
  elapsed,
  fmtTokens,
  hits,
  inProject,
  isCode,
  isSource,
  isTestCommand,
  mainModel,
  markdown,
  metricsSvg,
  MODEL_PATTERN,
  parseDefs,
  percent,
  resume,
  snapshot,
  testCounts,
  sessionTitle,
  taskKey,
  testsLabel,
  TITLE_RECORD,
  totalTokens,
  upsertCsv,
  webhookRequest,
} from './metrics'

const LEVELS = ['off', 'lite', 'full', 'ultra']
const EMPTY: Band = {
  level: 'off',
  model: '',
  cost: 0,
  spent: 0,
  turns: 0,
  turnCosts: [],
  tokens: NO_TOKENS,
  busyMs: 0,
  name: '',
  project: '',
  session: '',
  transcript: '',
  reused: [],
  created: [],
  removed: [],
  openCallers: [],
  tests: { state: 'none' },
  details: false,
}
// The counters of one task: what a new session or /clear starts over.
const TASK = {
  spent: 0,
  turns: 0,
  turnCosts: [],
  tokens: NO_TOKENS,
  busyMs: 0,
  name: '',
  model: '',
  reused: [],
  created: [],
  removed: [],
  openCallers: [],
  tests: { state: 'none' as const },
}
const band = atom({ plugin: 'ponytail', key: 'band' } as const, EMPTY)
// State kept from an older version of the band lacks newer fields.
const load = async ($: EngineInterface): Promise<Band> => ({ ...EMPTY, ...(await read($, band)) })

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]
const base = (path: string) => path.replace(/\/+$/, '').split('/').pop() ?? path

// Windows sets USERPROFILE, not HOME.
const home = async ($: EngineInterface) => (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
const claudeDir = async ($: EngineInterface) => (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await home($)}/.claude`

// `/ponytail band` (the mode tracker) leaves "off" here to hide the band. Absent flag = shown.
async function bandHidden($: EngineInterface): Promise<boolean> {
  try {
    return (await $.fs.read(`${await claudeDir($)}/.ponytail-band`)).trim() === 'off'
  } catch {
    return false
  }
}

// The level ponytail's own hooks write. Absent flag = off.
// shortcut: the shared flag the statusline reads, so two sessions in different repos show the last switch; read the per-project flag if that matters.
async function readLevel($: EngineInterface): Promise<string> {
  const dir = await claudeDir($)
  try {
    const level = (await $.fs.read(`${dir}/.ponytail-active`)).trim()
    return LEVELS.includes(level) ? level : 'off'
  } catch {
    return 'off'
  }
}

// The same commands a person types, so ponytail's own skills and hooks stay the only logic.
const run = ($: EngineInterface, command: string, args = '') => $.command.run({ command, args })

type Options = { readonly [field: string]: unknown }

// The session's sidebar name. grep, because $.fs.read refuses files over 4 MiB and transcripts grow past that.
// shortcut: without grep (Windows) only a transcript under 4 MiB is read; findstr would lift that.
async function readTitle($: EngineInterface, transcript: string): Promise<string | undefined> {
  if (transcript === '') return undefined
  const grep = await $.process.run(['grep', '-F', TITLE_RECORD, transcript]).catch(() => undefined)
  const text = grep !== undefined && grep.exitCode <= 1 ? grep.stdout : await $.fs.read(transcript).catch(() => '')
  return sessionTitle(text)
}

// The model that wrote most of the session's replies, so the board can tell models apart.
async function readModel($: EngineInterface, transcript: string): Promise<string> {
  if (transcript === '') return ''
  const grep = await $.process.run(['grep', '-o', MODEL_PATTERN, transcript]).catch(() => undefined)
  return grep?.exitCode === 0 ? mainModel(grep.stdout) : ''
}

// Where Claude Code keeps the session's transcript: on managed, Team and Enterprise machines its cc-plugin-sec-default skips every classic.* hook, so no hook hands the path over.
// First the folder its rule names, then every project folder: it hashes names past 200 characters, and /cd, worktrees and /resume can put the file elsewhere.
// shortcut: with persistence off there is no file, so every turn checks every folder, read the path from the engine once it offers one.
async function findTranscript($: EngineInterface, session: string): Promise<string> {
  const projects = `${await claudeDir($)}/projects`
  const exists = (file: string) => $.fs.exists(file).catch(() => false)
  const root = await $.session.root().catch(() => '')
  const named = `${projects}/${root.replace(/[^a-zA-Z0-9]/g, '-')}/${session}.jsonl`
  if (root !== '' && (await exists(named))) return named
  const dirs = (await $.fs.list(projects).catch(() => [])).filter(d => d.kind === 'dir')
  // One at a time: thousands of checks in flight at once are slower than in turn.
  for (const dir of dirs) {
    const file = `${projects}/${dir.name}/${session}.jsonl`
    if (await exists(file)) return file
  }
  return ''
}

// Where the task ledgers and the board live.
// shortcut: ~/.config only (XDG respected); Windows would want %APPDATA%.
async function ledgerDir($: EngineInterface) {
  return `${(await $.env.get('XDG_CONFIG_HOME')) ?? `${await home($)}/.config`}/ponytail/band`
}

const ledgerFile = (dir: string, project: string) => `${dir}/${project.replace(/[^\w.-]/g, '_')}.csv`

// After every turn: the task's row in a CSV per project, and the same row to a webhook if one is set.
async function record($: EngineInterface, b: Band, options: Options) {
  const startedAt = (await $.session.usage()).startedAt
  const row = snapshot(b, startedAt)
  if (options.ledger !== false && b.project !== '') {
    const dir = await ledgerDir($)
    const file = ledgerFile(dir, b.project)
    const existing = await $.fs.read(file).catch(() => '')
    // $.fs.write creates the directory: no mkdir, which Windows does not have.
    await $.fs.write(file, upsertCsv(existing, row))
    // The board is a plain file a refresh rereads, so it is rebuilt with every row.
    await writeBoard($, dir)
  }
  const url = typeof options.webhookUrl === 'string' ? options.webhookUrl.trim() : ''
  if (url !== '') {
    const token = typeof options.webhookToken === 'string' ? options.webhookToken.trim() : ''
    const request = webhookRequest(url, token, options.sendNames !== false, row)
    if ('refused' in request) {
      $.ui.status(`ponytail band: ${request.refused}`)
      return
    }
    // Not awaited: a slow endpoint must never hold up the turn.
    void $.http
      .fetch(request.url, request.init)
      .then(r => $.ui.status(r.ok ? undefined : `ponytail band: webhook answered ${r.status}`))
      .catch(() => $.ui.status('ponytail band: webhook unreachable'))
  }
}

// Builds board.html from every project's ledger.
async function writeBoard($: EngineInterface, dir: string) {
  const entries = await $.fs.list(dir).catch(() => [])
  const texts = await Promise.all(entries.filter(f => f.kind === 'file' && f.name.endsWith('.csv')).map(f => $.fs.read(`${dir}/${f.name}`).catch(() => '')))
  const file = `${dir}/board.html`
  await $.fs.write(file, boardHtml(texts.flatMap(tasksFrom), await $.clock.now()))
  return file
}

// Builds the board fresh and opens it in the browser.
async function openBoard($: EngineInterface) {
  const file = await writeBoard($, await ledgerDir($))
  const windows = (await $.env.get('OS')) === 'Windows_NT'
  const mac = !windows && (await $.process.run(['uname'])).stdout.trim() === 'Darwin'
  await $.process.run(windows ? ['cmd', '/c', 'start', '', file] : [mac ? 'open' : 'xdg-open', file])
}

// Sets the band up for a session (level, project, task row, cost baseline); returns the definitions that exist now.
async function start($: EngineInterface): Promise<Map<string, string>> {
  const grep = await $.process.run(['git', 'grep', '--untracked', '-nE', GREP_DEFS]).catch(() => undefined)
  const level = await readLevel($)
  const details = (await $.store.get('details')) === true
  const repo = await $.session.repo().catch(() => null)
  const project = base(repo?.root ?? (await $.session.cwd()))
  const session = await $.session.id()
  // The cost so far is the baseline for the last turn's own cost.
  const usage = await $.session.usage().catch(() => undefined)
  const csv = usage ? await $.fs.read(ledgerFile(await ledgerDir($), project)).catch(() => '') : ''
  const key = usage ? taskKey(session, usage.startedAt) : ''
  await update($, band, b => resume({ ...EMPTY, ...b, level, details, project, session, cost: usage?.cost?.usd ?? b.cost }, csv, key))
  return grep?.exitCode === 0 ? parseDefs(grep.stdout) : new Map()
}

export const register: Register = (on, options) => {
  // Definitions that existed when the session started: what new code can reuse.
  let known = new Map<string, string>()

  on('session.start', async ($, e, next) => {
    known = await start($)
    return next(e)
  }).catch(($, e, next) => next(e))

  // /clear, /resume and /branch go on under another session id with an empty band and no session.start, so the band
  // showed "off" until the first turn ended. Set it up again once one of them has moved the session.
  // Only these commands: the engine labels a command's output with every plugin its hook chain ran through, so a hook on
  // every command printed "ponytail+<plugin>:" before other plugins' commands.
  // shortcut: after /clear, ponytail-activate.js may reset the flag to the default level after this, so a level switched
  // before /clear can show until the first turn ends; a session skips a plugin's classic.SessionStart hook, the one later point.
  on('command.run', { command: ['clear', 'resume', 'branch'] }, async ($, e, next) => {
    const session = await $.session.id()
    const result = await next(e)
    if ((await $.session.id()) !== session) known = await start($).catch(() => known)
    return result
  }).catch(($, e, next) => next(e))

  // /clear starts a new task: the counters start over, the cost baseline stays.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, band, b => ({ ...EMPTY, ...b, ...TASK }))
    return next(e)
  }).catch(($, e, next) => next(e))

  // The first prompt names the task until the session has a sidebar name.
  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim()
    if (e.origin.kind !== 'plugin' && text !== '' && !text.startsWith('/')) {
      const name = (text.split('\n')[0] ?? '').slice(0, 60)
      await update($, band, b => (b.name === '' ? { ...EMPTY, ...b, name } : b))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash') {
      const ran = await next(e)
      if (ran.deny === undefined && isTestCommand(e.command)) {
        const tests = { state: ran.isError ? ('fail' as const) : ('pass' as const), ...testCounts(ran.text ?? '') }
        await update($, band, b => ({ ...b, tests }))
      }
      return ran
    }

    if (e.tool !== 'Edit' && e.tool !== 'Write') return next(e)

    const file = e.file_path
    // A scratch script outside the project is never reused or called by it (#1300).
    const repo = await $.session.repo().catch(() => null)
    if (!inProject(file, repo?.root ?? (await $.session.cwd()))) return next(e)
    const before = e.tool === 'Write' ? await $.fs.read(file).catch(() => '') : e.old_string
    const after = e.tool === 'Write' ? e.content : e.new_string
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran

    const oldDefs = defsIn(file, before)
    const newDefs = defsIn(file, after)
    const created = isSource(file) ? newDefs.filter(n => !oldDefs.includes(n)) : []
    const removed = oldDefs.filter(n => !newDefs.includes(n))
    const reused = isSource(file) ? callsIn(addedLines(before, after), known, newDefs) : []

    await update($, band, b => ({
      ...b,
      reused: union(b.reused, reused),
      created: union(b.created, created),
      removed: union(b.removed, removed),
      tests: isCode(file) && b.tests.state !== 'none' ? { ...b.tests, state: 'stale' as const } : b.tests,
    }))

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const used = e.usage
    if (e.agentId !== undefined) {
      // A subagent's tokens count; its cost is already in the session cost the main turn reads.
      if (used) await update($, band, b => ({ ...EMPTY, ...b, tokens: addTokens(b.tokens ?? NO_TOKENS, used) }))
      return next(e)
    }

    const usage = await $.session.usage()
    const turns = await $.session.turns()
    const level = await readLevel($)
    const { removed, transcript: saved } = await load($)
    const session = await $.session.id()
    // Here, not at start: the first turn writes the file, and a new id (/clear, /resume) or a move (/cd, a worktree) changes it.
    const kept = base(saved) === `${session}.jsonl` && (await $.fs.exists(saved).catch(() => false))
    const transcript = kept ? saved : await findTranscript($, session)
    const title = await readTitle($, transcript)
    const model = await readModel($, transcript)

    // A removed or renamed definition that is not defined again but still called somewhere.
    // shortcut: name match with git grep, so a same-named call in another module counts too.
    const stillRemoved: string[] = []
    const open: string[] = []
    for (const name of removed) {
      const grep = await $.process.run(['git', 'grep', '--untracked', '-nw', '-e', name]).catch(() => undefined)
      const rows = hits(grep?.stdout ?? '')
      if (rows.some(r => defsIn(r.file, r.text.trimStart()).includes(name))) continue
      const call = new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}\\s*\\(`)
      const refs = rows.filter(r => call.test(r.text)).map(r => `${r.file}:${r.line}`)
      if (refs.length > 0) {
        stillRemoved.push(name)
        open.push(...refs)
      }
    }

    const b = await update($, band, x => {
      const b = { ...EMPTY, ...x }
      const cost = usage.cost?.usd ?? b.cost
      // A cost below the baseline means the engine started its ledger over.
      const turn = cost >= b.cost ? cost - b.cost : cost
      return {
        ...b,
        level,
        transcript,
        cost,
        // Cost and turns are the session's own totals, so a reload or a second band never starts them over.
        spent: usage.cost?.usd ?? b.spent + turn,
        turns,
        turnCosts: [...b.turnCosts, turn].slice(-20),
        tokens: used ? addTokens(b.tokens, used) : b.tokens,
        busyMs: b.busyMs + e.durationMs,
        name: title ?? b.name,
        model: model || b.model,
        removed: stillRemoved,
        openCallers: open,
      }
    })
    await record($, b, options).catch(() => $.ui.status('ponytail band: could not write the task ledger'))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await bandHidden($))) return next(e)
    // Other mods share this slot: draw theirs below ours instead of replacing it.
    // next(e) rejects only when nothing answers beneath (the test harness): the band still draws.
    const below = await next(e).catch(() => undefined)

    const b = await load($)
    const now = await $.clock.now()
    const startedAt = (await $.session.usage().catch(() => undefined))?.startedAt ?? now
    const reuse = percent(b.reused.length, b.created.length)
    const avg = b.turns > 0 ? b.spent / b.turns : 0
    const last = b.turnCosts[b.turnCosts.length - 1]

    const setLevel = async (level: string) => {
      await update($, band, x => ({ ...x, level }))
      await run($, 'ponytail:ponytail', level)
    }
    const toggle = async () => {
      await update($, band, x => ({ ...x, details: !x.details }))
      await $.store.set('details', !b.details)
    }
    const review = () => run($, 'ponytail:ponytail-review')
    const audit = () => run($, 'ponytail:ponytail-audit')
    const board = () => openBoard($).catch(() => $.ui.toast('ponytail band: could not open the board'))
    const copy = async () => {
      const done = await $.ui.copy({ text: markdown(snapshot(await load($), startedAt)), surface: e.surface })
      $.ui.toast(done.isCopied ? 'Task copied as Markdown' : `Copy failed: ${done.reason}`)
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    // bodyColumns counts terminal cells; a graphical surface draws Buttons wider than their cells, so a row sized to it wraps there.
    const width = e.surface === 'terminal' ? e.props.bodyColumns : undefined
    const stack =(mine: NonNullable<typeof below>) => (below ? <Box flexDirection="column">{mine}{below}</Box> : mine)

    const testsText =
      b.tests.state === 'pass'
        ? `✓ ${b.tests.passed ?? ''} tests`
        : b.tests.state === 'fail'
          ? `✗ ${b.tests.failed ?? ''} failed`
          : b.tests.state === 'stale'
            ? 'no test since change'
            : ''
    const testsColor = b.tests.state === 'pass' ? 'success' : b.tests.state === 'fail' ? 'error' : undefined
    const hasOpen = b.openCallers.length > 0

    if (!b.details) {
      return stack(
        <Box flexDirection="row" alignItems="center" gap={2} width={width}>
          {/* A click opens the four levels: one click, one turn, no stops on levels nobody wanted. */}
          <Button key="level" plain onPress={toggle}>
            <Text color={b.level === 'off' ? 'inactive' : 'suggestion'}>●</Text> {b.level}
          </Button>
          <Text>${b.spent.toFixed(2)}</Text>
          {last !== undefined && <Text dimColor>last ${last.toFixed(2)}</Text>}
          <Text dimColor>{elapsed(b.busyMs)}</Text>
          {reuse !== undefined && <Text>{reuse}% reuse</Text>}
          {hasOpen && <Text color="warning">⚠ {b.openCallers.length} callers open</Text>}
          {testsText !== '' && (
            <Text color={testsColor} dimColor={b.tests.state === 'stale'}>
              {testsText}
            </Text>
          )}
          <Box flexGrow={1} />
          <Button key="review" plain label="Review" onPress={review} />
          <Button key="audit" plain label="Audit" onPress={audit} />
          <Button key="board" plain label="Board" onPress={board} />
          <Button key="details" plain label="Details" onPress={toggle} />
        </Box>
      )
    }

    // Only columns that say something; callers and tests appear once there is something to report.
    const cols: Col[] = [
      { key: 'cost', label: 'cost', value: `$${b.spent.toFixed(2)}`, sub: last === undefined ? '' : `last $${last.toFixed(2)} · ⌀ $${avg.toFixed(2)}` },
      { key: 'tokens', label: 'tokens', value: fmtTokens(totalTokens(b.tokens)), sub: `${b.turns} ${b.turns === 1 ? 'turn' : 'turns'}` },
      { key: 'time', label: 'agent time', value: elapsed(b.busyMs), sub: b.turns > 0 ? `⌀ ${elapsed(b.busyMs / b.turns)} / turn` : '' },
    ]
    if (reuse !== undefined) cols.push({ key: 'reuse', label: 'reuse', value: `${reuse}%`, sub: '' })
    if (hasOpen) {
      cols.push({ key: 'callers', label: 'callers', value: `${b.openCallers.length} open`, sub: b.openCallers.slice(0, 2).join(', '), tone: 'warning' })
    }
    if (b.tests.state !== 'none') {
      cols.push({
        key: 'tests',
        label: 'tests',
        value: testsLabel(b.tests),
        sub: b.tests.state === 'pass' ? 'after last change' : b.tests.state === 'fail' ? 'last run' : 'code changed since',
        tone: b.tests.state === 'pass' ? 'success' : b.tests.state === 'fail' ? 'error' : undefined,
      })
    }

    let metrics = (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate-end">
          {'─'.repeat(e.props.bodyColumns)}
        </Text>
        <Box flexDirection="row" gap={2}>
          {cols.map(c => (
            // Off the terminal the columns share the row; a width in cells would leave most of it empty and cut the text.
            <Box key={c.key} flexDirection="column" {...(width === undefined ? { flexGrow: 1 } : { width: Math.max(10, Math.floor(width / cols.length) - 2) })}>
              <Text dimColor>{c.label}</Text>
              <Text bold color={c.tone}>
                {c.value}
              </Text>
              <Text dimColor wrap="truncate-end">
                {c.sub}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
    // Text glyphs make broken lines in the desktop's proportional font; an SVG draws real ones.
    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      metrics = <Svg source={metricsSvg(cols, b.turnCosts)} alt={cols.map(c => `${c.label} ${c.value}`).join(', ')} />
    }

    return stack(
      // The desktop's SVG draws its own line at the top, which would touch the buttons without the gap.
      <Box flexDirection="column" width={width} gap={e.surface === 'desktop' ? 1 : 0}>
        <Box flexDirection="row" alignItems="center" gap={1}>
          {LEVELS.map(level => (
            <Button
              key={`level-${level}`}
              label={level}
              {...(level === b.level ? { variant: 'primary' as const } : { plain: true as const, dimColor: true })}
              onPress={() => setLevel(level)}
            />
          ))}
          <Box flexGrow={1} />
          <Button key="copy" plain label="Copy" onPress={copy} />
          <Button key="review" plain label="Review" onPress={review} />
          <Button key="audit" plain label="Audit" onPress={audit} />
          <Button key="board" plain label="Board" onPress={board} />
          <Button key="details" plain label="Compact" onPress={toggle} />
        </Box>
        {metrics}
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
