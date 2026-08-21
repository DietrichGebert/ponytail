// dsh-ponytail — Ponytail (lazy senior dev mode) adapter for DeepSeek Harness.
//
// Thin adapter in the upstream style: the per-turn system-prompt section and
// skill registry point at the SHARED upstream hooks (`hooks/ponytail-
// instructions.js` for the ruleset text, `hooks/ponytail-config.js` for mode
// persistence), exactly like pi-extension and the OpenCode plugin do. No rule
// text is copied here; `skills/` is the upstream directory.
//
//   - every-turn injection of the active intensity level's ruleset via
//     ctx.systemPrompt.section (dsh's stand-in for the upstream hosts'
//     per-turn transform),
//   - a `ponytail` tool to switch lite/full/ultra/review/off (dsh's stand-in
//     for the /ponytail slash command), persisting through the shared
//     writeDefaultMode so a resumed dsh session or another ponytail host sees
//     the same level,
//   - the six upstream ponytail skills registered via ctx.skills.register().
//
// AGENTS.md is not bundled: dsh's dsh-agent-instructions auto-loads a
// project's AGENTS.md (like CodeWhale/Amp/Jules), so a ponytail checkout works
// in dsh with zero setup; this adapter adds the always-on injection, level
// switching, and the skill catalog.
//
// Repo layout: this file lives at <repo>/dsh/src/index.js, so the shared
// hooks and skills are two levels up.

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

const require = createRequire(import.meta.url)
const REPO_ROOT = dirname(fileURLToPath(import.meta.url)) + '/../..'
const {
  DEFAULT_MODE,
  RUNTIME_MODES,
  getDefaultMode,
  normalizePersistedMode,
  writeDefaultMode,
} = require(join(REPO_ROOT, 'hooks/ponytail-config.js'))
const { getPonytailInstructions } = require(join(REPO_ROOT, 'hooks/ponytail-instructions.js'))

export const name = 'ponytail'
export const inject = ['tools', 'systemPrompt', 'skills']

// ---------------------------------------------------------------------------
// Config (Schemastery)
// ---------------------------------------------------------------------------

export const Config = Schema.object({
  mode: Schema.union(['off', 'lite', 'full', 'ultra', 'review'])
    .default(DEFAULT_MODE)
    .description('Ponytail intensity: lite (name the lazier option), full (ladder enforced, default), ultra (YAGNI extremist), review (session-only, behavior from the ponytail-review skill), off (inject nothing). Omit to resolve the shared default (PONYTAIL_DEFAULT_MODE env > config.json > full).'),
  order: Schema.number()
    .default(120)
    .description('System-prompt section order; tool guidance lives at 100-199, keep this inside that band'),
})

// ---------------------------------------------------------------------------
// Skills — the six upstream skills; descriptions come from their frontmatter
// description (first folded block); content is the SKILL.md body with
// frontmatter stripped (dsh renders content verbatim).
// ---------------------------------------------------------------------------

const SKILLS = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
]

function readSkillBody(name) {
  try {
    return readFileSync(join(REPO_ROOT, 'skills', name, 'SKILL.md'), 'utf8')
  } catch {
    return ''
  }
}

function stripFrontmatter(text) {
  return String(text || '').replace(/^---[\s\S]*?---\s*/, '')
}

function skillDescription(name) {
  const body = readSkillBody(name)
  const m = String(body).match(/^---[\s\S]*?^description:\s*>\s*\n((?:^  .*\n?)+)/m)
  if (m) {
    return m[1].split('\n').map((l) => l.trim()).join(' ').trim() || name
  }
  return name
}

// ---------------------------------------------------------------------------
// Plugin entry
// ---------------------------------------------------------------------------

export function apply(ctx, config = {}) {
  // Initial level: explicit plugin config wins; otherwise the shared ponytail
  // persistence (PONYTAIL_DEFAULT_MODE env > config.json defaultMode > full).
  const initialMode = normalizePersistedMode(config.mode) || getDefaultMode()

  // 1. Always-on per-turn injection of the active level's ruleset.
  ctx.systemPrompt.section({
    name: 'ponytail',
    order: config.order ?? 120,
    text: () => {
      const mode = normalizePersistedMode(config.mode) || initialMode
      return mode === 'off' ? '' : getPonytailInstructions(mode)
    },
  })

  // 2. Level-switch tool (dsh's stand-in for the /ponytail slash command).
  ctx.tools.register(
    defineTool({
      name: 'ponytail',
      description:
        'Set Ponytail intensity for this session: lite (build what is asked, name the lazier alternative), full (ladder enforced, default), ultra (YAGNI extremist), review (session-only, behavior from the ponytail-review skill), off (disable). No argument reports the current level.',
      parameters: {
        mode: { type: 'string', description: 'lite | full | ultra | review | off (optional; omit to report current)' },
      },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      async execute(args) {
        const requested = args?.mode
        const current = () => normalizePersistedMode(config.mode) || initialMode
        if (requested === undefined || requested === null || requested === '') {
          return `ponytail: ${current()}`
        }
        const next = normalizePersistedMode(requested)
        if (!next) {
          return `ponytail: unknown level — use lite, full, ultra, review, or off. Current: ${current()}`
        }
        config.mode = next
        // Persist so a resumed session (or another ponytail host) sees the
        // same level; review is session-only and is NOT persisted (upstream #377).
        if (next !== 'review') writeDefaultMode(next)
        return `ponytail: ${next}`
      },
    }),
  )

  // 3. Six skills (frontmatter-stripped bodies from the upstream skills/ dir).
  for (const name of SKILLS) {
    ctx.skills.register({
      name,
      description: skillDescription(name),
      content: stripFrontmatter(readSkillBody(name)),
    })
  }

  ctx.logger?.info?.('[dsh-ponytail] registered 1 tool + 6 skills; mode=' + (normalizePersistedMode(config.mode) || initialMode))
}

// Re-export for parity with pi-extension's test surface.
export { RUNTIME_MODES }
