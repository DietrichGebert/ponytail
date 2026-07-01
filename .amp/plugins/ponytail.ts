// @ts-ignore — @ampcode/plugin is types-only; Bun erases this import at runtime.
import type { PluginAPI } from '@ampcode/plugin'
import { fileURLToPath } from 'url'
import { dirname, resolve, delimiter, join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'

// When the plugin lives at .amp/plugins/ inside the repo, walking up from the
// plugin file finds skills/ponytail/SKILL.md. When copied to
// ~/.config/amp/plugins/ (system-wide install) there is no such directory —
// every lookup below falls back to inline defaults so the plugin still works.
const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Walk up from `startDir` looking for `skills/ponytail/SKILL.md`. This is more
 * robust than assuming a fixed "../.." depth, since it keeps working if the
 * plugin file is nested differently (e.g. `.amp/plugins/ponytail/index.ts`).
 */
function findRepoRoot(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'skills', 'ponytail', 'SKILL.md'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

const REPO_ROOT = findRepoRoot(__dirname) ?? resolve(__dirname, '../..')

// ── Config (inlined — no external require, works wherever the file is placed) ─
const DEFAULT_MODE = 'full'
const RUNTIME_MODES = ['off', 'lite', 'full', 'ultra']
const VALID_MODES = [...RUNTIME_MODES, 'review']
const CONFIG_KEY = 'ponytail.mode'

export function normalizeMode(m: unknown): string | null {
  if (typeof m !== 'string') return null
  const n = m.trim().toLowerCase()
  return RUNTIME_MODES.includes(n) ? n : null
}

export function getConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME
    ?? (process.platform === 'win32'
        ? (process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
        : join(homedir(), '.config'))
  return join(base, 'ponytail', 'config.json')
}

/** Synchronous, amp-independent read: env var > local file > built-in default.
 *  Used for the very first read before amp.configuration is available, and
 *  kept exported/pure so it stays unit-testable. */
export function getMode(): string {
  const env = process.env.PONYTAIL_DEFAULT_MODE
  if (env && VALID_MODES.includes(env.toLowerCase())) return env.toLowerCase()
  try {
    const cfg = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as Record<string, unknown>
    const m = String(cfg.defaultMode ?? '').toLowerCase()
    if (VALID_MODES.includes(m)) return m
  } catch { /* no config file yet */ }
  return DEFAULT_MODE
}

export function saveMode(mode: string): void {
  const p = getConfigPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify({ defaultMode: mode }, null, 2), 'utf8')
}

// ── Instructions ─────────────────────────────────────────────────────────────
// Inline fallback used whenever skills/ponytail/SKILL.md isn't reachable
// (system-wide install, or repo checked out without the skills/ directory).
const FALLBACK_RULES = `You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

## Persistence

ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode".

## The ladder

Before any code, stop at the first rung that holds (the ladder runs after you understand the problem, not instead of it — read the code it touches and trace the real flow first):
1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse what is already here, do not re-write it.
3. Does the standard library do this? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

Bug fix = root cause, not symptom: grep every caller of the function you touch and fix the shared function once (a smaller diff than one guard per caller); patching only the path the ticket names leaves a sibling caller broken.

## Rules

No abstractions that were not requested. No avoidable dependencies. No boilerplate nobody asked for. Deletion over addition. Boring over clever. Fewest files possible. Ship the lazy version and question the complex request in the same response — never stall. Between two same-size stdlib options, pick the one correct on edge cases. Mark intentional simplifications with a \`ponytail:\` comment — a shortcut with a known ceiling names the ceiling and the upgrade path in the comment.

## Output

Code first. Then at most three short lines: what was skipped, when to add it. If the explanation is longer than the code, delete the explanation. Explanation the user explicitly asked for is not debt, give it in full.

## When NOT to be lazy

Never simplify away: understanding the problem (read it fully and trace the real flow before picking a rung — a small diff you do not understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, the calibration real hardware needs (the platform is never the spec ideal), anything the user explicitly asked to keep. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind (assert-based demo/self-check or one small test file; no frameworks). Trivial one-liners need no test.

## Boundaries

Ponytail governs what you build, not how you talk. "stop ponytail" or "normal mode": revert. Level persists until changed or session end.`

export function filterBodyForMode(body: string, mode: string): string {
  return body.replace(/^---[\s\S]*?---\s*/, '').split(/\r?\n/).filter(line => {
    const tbl = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/)
    if (tbl && normalizeMode(tbl[1])) return tbl[1].trim().toLowerCase() === mode
    const ex = line.match(/^-\s*([^:]+):\s*/)
    if (ex && normalizeMode(ex[1])) return ex[1].trim().toLowerCase() === mode
    return true
  }).join('\n')
}

export function getInstructions(mode: string): string {
  const m = normalizeMode(mode) ?? DEFAULT_MODE
  const header = `PONYTAIL MODE ACTIVE — level: ${m}\n\n`
  try {
    const body = readFileSync(resolve(REPO_ROOT, 'skills/ponytail/SKILL.md'), 'utf8')
    return header + filterBodyForMode(body, m)
  } catch {
    return header + FALLBACK_RULES
  }
}

// ── Skills ───────────────────────────────────────────────────────────────────
const SKILL_NAMES = ['ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']

// Inline fallbacks for system-wide installs where SKILL.md files aren't on disk.
const SKILL_FALLBACKS: Record<string, string> = {
  'ponytail-review': 'Review the current git diff for over-engineering. List only what can be deleted or replaced with stdlib/native equivalents. One line per finding: location, what to cut, what replaces it.',
  'ponytail-audit': 'Audit the entire repository for over-engineering. Scan all files and produce a ranked list of what to delete, simplify, or replace with stdlib/native equivalents.',
  'ponytail-debt': 'Find every `ponytail:` comment in the codebase and produce a debt ledger: file, line, comment, suggested next step.',
  'ponytail-gain': "Show ponytail's measured impact scoreboard: less code, less cost, more speed. Display the benchmark results concisely.",
  'ponytail-help': 'Show a quick-reference card for all ponytail modes, skills, and commands.',
}

export function readSkillPrompt(name: string): string {
  try {
    return readFileSync(resolve(REPO_ROOT, 'skills', name, 'SKILL.md'), 'utf8')
      .replace(/^---[\s\S]*?---\s*/, '')
      .trim()
  } catch {
    return SKILL_FALLBACKS[name] ?? `Run ${name}.`
  }
}

export function statusText(mode: string): string {
  const icon: Record<string, string> = { lite: '🌿', full: '⚡', ultra: '🔥' }
  return mode === 'off' ? '' : `🐴 ponytail: ${icon[mode] ?? ''} ${mode.toUpperCase()}`
}

// ── Plugin ───────────────────────────────────────────────────────────────────
/** Fire a notification without blocking the caller. Awaiting ctx.ui.notify()
 *  before returning a hook result delays that result for no benefit — and on
 *  a cold-started plugin that delay can be the difference between the first
 *  prompt of a session landing before or after Amp has already moved on. */
function notify(ctx: { ui: { notify: (text: string) => Promise<void> } }, text: string): void {
  ctx.ui.notify(text).catch(() => { /* best-effort */ })
}

export default async function (amp: PluginAPI) {
  let mode: string = getMode()

  async function persistMode(next: string) {
    mode = next
    saveMode(next) // best-effort local file, kept for offline/system-wide installs
    try {
      await amp.configuration.update({ [CONFIG_KEY]: next }, 'workspace')
    } catch { /* non-fatal — file copy above still has it */ }
  }

  const statusItem = amp.experimental?.createStatusItem({ text: statusText(mode) })

  // ── Hooks & commands are registered FIRST, synchronously, before any
  // `await` below runs. Amp can dispatch the first session.start/agent.start
  // event as soon as the plugin module loads; if hook registration is stuck
  // behind awaited setup work (config reads, skills-path registration), that
  // first event can arrive before a handler is attached, or the handler can
  // resolve too slowly to have its returned message applied in time. That's
  // what caused "works from message 2 onward" — the plugin was still
  // finishing async init when the first prompt's agent.start fired.

  amp.on('session.start', async (_event, ctx) => {
    try {
      const cfg = await amp.configuration.get()
      mode = normalizeMode((cfg as Record<string, unknown>)[CONFIG_KEY]) ?? getMode()
    } catch {
      mode = getMode()
    }
    statusItem?.update({ text: statusText(mode) })
    if (mode !== 'off') notify(ctx, `Ponytail active: ${mode}`)
  })

  amp.on('agent.start', async (event, ctx) => {
    const text = event.message.trim()

    // /ponytail [lite|full|ultra|off] — mode switch
    const modeMatch = text.match(/^\/ponytail(?:\s+(\S+))?$/i)
    if (modeMatch) {
      const arg = (modeMatch[1] ?? '').toLowerCase()
      const next = arg ? normalizeMode(arg) : mode
      if (next) {
        await persistMode(next)
        statusItem?.update({ text: statusText(mode) })
        notify(ctx, `Ponytail mode: ${mode}`)
      }
      return
    }

    // /ponytail-review, /ponytail-audit, etc. — inject skill as hidden context
    const skillMatch = text.match(/^\/(ponytail-(?:review|audit|debt|gain|help))(?:\s|$)/i)
    if (skillMatch) {
      notify(ctx, `🐴 ponytail: running ${skillMatch[1]}`)
      return { message: { content: readSkillPrompt(skillMatch[1].toLowerCase()), display: false } }
    }

    // Always-on instruction injection, applied to every normal prompt.
    if (mode === 'off') return

    // The Plugin API only supports appending content after the user's typed
    // text (there is no "prepend" hook), so the closest supported way to
    // surface "ponytail is active on this prompt" every time the user hits
    // enter is a UI notification fired on every matching turn. Fired without
    // awaiting so it can never delay the returned instructions payload.
    notify(ctx, statusText(mode) || 'ponytail active')

    return { message: { content: getInstructions(mode), display: false } }
  })

  // ── Command palette ───────────────────────────────────────────────────────

  amp.registerCommand('ponytail-mode', {
    title: 'set mode',
    category: 'ponytail',
    description: 'Switch Ponytail intensity: lite, full, ultra, or off',
  }, async (ctx) => {
    const choice = await ctx.ui.select({
      title: 'Ponytail mode',
      message: `Current: ${mode}`,
      options: ['lite', 'full', 'ultra', 'off'],
      initialValue: mode,
    })
    if (!choice) return
    await persistMode(choice)
    statusItem?.update({ text: statusText(mode) })
    notify(ctx, `Ponytail mode: ${mode}`)
  })

  for (const skill of SKILL_NAMES) {
    const title = skill.replace('ponytail-', '')
    amp.registerCommand(skill, {
      title,
      category: 'ponytail',
    }, async (ctx) => {
      const content = readSkillPrompt(skill)
      const thread = ctx.thread ?? await amp.getBuiltinAgent('smart').createThread({ show: true })
      await thread.append([{ type: 'user-message', content }])
    })
  }

  amp.logger.log(`[ponytail] plugin initialized (repo root: ${REPO_ROOT})`)

  // ── Background init (non-blocking) ──────────────────────────────────────
  // Runs after hooks/commands are already wired up, so it can never delay or
  // race the first event. Pulls the persisted mode override from
  // amp.configuration (workspace-synced, survives ephemeral executors) and
  // registers skills/ so `amp skills list` discovers them. If this hasn't
  // resolved yet when the very first prompt arrives, that prompt just uses
  // the synchronous file/env/default mode from getMode() above — a safe,
  // reasonable value — rather than blocking or being skipped.
  void (async () => {
    try {
      const cfg = await amp.configuration.get()
      const cfgMode = normalizeMode((cfg as Record<string, unknown>)[CONFIG_KEY])
      if (cfgMode) {
        mode = cfgMode
        statusItem?.update({ text: statusText(mode) })
      }
    } catch { /* configuration API unavailable — fall back to file/env/default */ }

    try {
      const skillsDir = resolve(REPO_ROOT, 'skills')
      if (existsSync(skillsDir)) {
        const config = await amp.configuration.get()
        const existing = String((config as Record<string, unknown>)['amp.skills.path'] ?? '')
          .split(delimiter)
          .filter(Boolean)
        if (!existing.includes(skillsDir)) {
          await amp.configuration.update(
            { 'amp.skills.path': [...existing, skillsDir].join(delimiter) },
            'workspace',
          )
        }
      }
    } catch { /* skills path registration is best-effort */ }
  })()
}