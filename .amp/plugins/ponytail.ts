// @ts-ignore — @ampcode/plugin is types-only; Bun erases this import at runtime.
import type { PluginAPI } from '@ampcode/plugin'
import { fileURLToPath } from 'url'
import { dirname, resolve, delimiter, join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'

// When the plugin lives at .amp/plugins/ inside the repo, REPO_ROOT is the
// project root and skills/ is reachable. When copied to ~/.config/amp/plugins/,
// REPO_ROOT points nowhere useful — try/catch blocks fall back to inline
// defaults so the plugin works correctly either way.
const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')

// ── Config (inlined — no external require, works wherever the file is placed) ─
const DEFAULT_MODE = 'full'
const RUNTIME_MODES = ['off', 'lite', 'full', 'ultra']
const VALID_MODES = [...RUNTIME_MODES, 'review']

function normalizeMode(m: unknown): string | null {
  if (typeof m !== 'string') return null
  const n = m.trim().toLowerCase()
  return RUNTIME_MODES.includes(n) ? n : null
}

function getConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME
    ?? (process.platform === 'win32'
        ? (process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
        : join(homedir(), '.config'))
  return join(base, 'ponytail', 'config.json')
}

function getMode(): string {
  const env = process.env.PONYTAIL_DEFAULT_MODE
  if (env && VALID_MODES.includes(env.toLowerCase())) return env.toLowerCase()
  try {
    const cfg = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as Record<string, unknown>
    const m = String(cfg.defaultMode ?? '').toLowerCase()
    if (VALID_MODES.includes(m)) return m
  } catch { /* no config file yet */ }
  return DEFAULT_MODE
}

function saveMode(mode: string): void {
  const p = getConfigPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify({ defaultMode: mode }, null, 2), 'utf8')
}

// ── Instructions ─────────────────────────────────────────────────────────────
// Inline fallback used when skills/ponytail/SKILL.md isn't reachable (system-
// wide install). Kept in sync with getFallbackInstructions() in
// hooks/ponytail-instructions.js.
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

function filterBodyForMode(body: string, mode: string): string {
  return body.replace(/^---[\s\S]*?---\s*/, '').split(/\r?\n/).filter(line => {
    const tbl = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/)
    if (tbl && normalizeMode(tbl[1])) return tbl[1].trim().toLowerCase() === mode
    const ex = line.match(/^-\s*([^:]+):\s*/)
    if (ex && normalizeMode(ex[1])) return ex[1].trim().toLowerCase() === mode
    return true
  }).join('\n')
}

function getInstructions(mode: string): string {
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

function readSkillPrompt(name: string): string {
  try {
    return readFileSync(resolve(REPO_ROOT, 'skills', name, 'SKILL.md'), 'utf8')
      .replace(/^---[\s\S]*?---\s*/, '')
      .trim()
  } catch {
    return SKILL_FALLBACKS[name] ?? `Run ${name}.`
  }
}

function statusText(mode: string): string {
  const icon: Record<string, string> = { lite: '🌿', full: '⚡', ultra: '🔥' }
  return mode === 'off' ? '' : `🐴 ponytail: ${icon[mode] ?? ''} ${mode.toUpperCase()}`
}

// ── Plugin ───────────────────────────────────────────────────────────────────
export default async function (amp: PluginAPI) {
  let mode: string = getMode()

  // Register ponytail skills so `amp skills list` discovers them. Skipped when
  // skills/ isn't present (system-wide install without a repo checkout).
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

  const statusItem = amp.experimental?.createStatusItem({ text: statusText(mode) })

  amp.on('session.start', async (_event, ctx) => {
    mode = getMode()
    statusItem?.update({ text: statusText(mode) })
    if (mode !== 'off') {
      await ctx.ui.notify(`Ponytail active: ${mode}`)
    }
  })

  amp.on('agent.start', async (event, ctx) => {
    const text = event.message.trim()

    // /ponytail [lite|full|ultra|off] — mode switch
    const modeMatch = text.match(/^\/ponytail(?:\s+(\S+))?$/i)
    if (modeMatch) {
      const arg = (modeMatch[1] ?? '').toLowerCase()
      const next = arg ? normalizeMode(arg) : mode
      if (next) {
        mode = next
        saveMode(mode)
        statusItem?.update({ text: statusText(mode) })
        await ctx.ui.notify(`Ponytail mode: ${mode}`)
      }
      return
    }

    // /ponytail-review, /ponytail-audit, etc. — inject skill as hidden context
    const skillMatch = text.match(/^\/(ponytail-(?:review|audit|debt|gain|help))(?:\s|$)/i)
    if (skillMatch) {
      return { message: { content: readSkillPrompt(skillMatch[1].toLowerCase()), display: false } }
    }

    // Always-on instruction injection
    if (mode === 'off') return
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
    mode = choice
    saveMode(mode)
    statusItem?.update({ text: statusText(mode) })
    await ctx.ui.notify(`Ponytail mode: ${mode}`)
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
}
