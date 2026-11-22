/**
 * Ponytail for DeepSeek Harness — the repo's own skills and hooks, mounted natively.
 *
 * ROOT FACTS (verified 2026-10-23 against DSH 0.2.1-rc.2, live Host inspection):
 *   - Ponytail upstream is a prompt package, not a runtime: six SKILL.md files, six
 *     prompt templates, and an instruction builder that filters the ruleset to the
 *     active level. The builder is vendored UNMODIFIED at the pinned commit
 *     (vendor/UPSTREAM_COMMIT) and called here, so the text the model sees is
 *     upstream's own output — not a reimplementation that can drift.
 *   - DSH already turns a registered skill into a native `/name` invocation
 *     (@deepseek-ai/dsh-client-ui-skill: "type `/name` directly ... the host loads
 *     the skill"), and "a name shared with a host command still resolves to the
 *     command". So five of the six ponytail commands need NO command row: the
 *     skills ARE the slash commands. Only `/ponytail` itself needs a command,
 *     because switching the always-on level is state the plugin owns. Registering
 *     all six as commands would SHADOW the skills and make them unreachable.
 *   - `systemPrompt.assemble()` keeps sections whose text renders empty
 *     (dsh-system-prompt/lib/index.js:380-393 filters only at render time), so a
 *     mode of `off` must DISPOSE the registration to be a real gate. A text
 *     function returning '' would leave the section in every assembly.
 *   - Per-agent registration belongs on `agent.ctx` from an `agent/created`
 *     listener (plugin practices); a scoped section shadows a global one, so the
 *     same section name is safe across agents.
 *
 * NEVER-THROW: activation, the section text function, the pre-step listener, and
 * logging are each guarded. A prompt plugin must never be able to fail an
 * assembly or a turn (same discipline as @local/dsh-session-auto-resume).
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

// This adapter ships inside the repo, so it reads the repo's own files: the
// skills it registers and the instruction builder it calls are the same ones
// every other host uses. There is no vendored copy to drift.
const config = require('../hooks/ponytail-config.js')
const instructions = require('../hooks/ponytail-instructions.js')

export const name = 'ponytail'

/** All three are hard requirements for the delivered surfaces. */
export const inject = ['skills', 'commands', 'systemPrompt']

const SKILL_NAMES = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
]

/** Placement: after the deployment persona prefix (0), before plan policy (500). */
const SECTION_ORDER = 10

/** `off` is the only mode that removes the section; the rest are level variants. */
const RUNTIME_MODES = new Set(['off', 'lite', 'full', 'ultra'])

// ---------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------

function repoPath(...parts) {
  return fileURLToPath(new URL(`../${parts.join('/')}`, import.meta.url))
}

/** Log path precedence: config > $DSH_PONYTAIL_LOG > $DSH_HOME/logs > ~/.dsh/logs. */
export function resolveLogPath(settings = {}) {
  if (settings.logPath) return settings.logPath
  if (process.env.DSH_PONYTAIL_LOG) return process.env.DSH_PONYTAIL_LOG
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'logs', 'ponytail.log')
}

/** One append-only log line: ISO ts + event + k=v fields (undefined dropped). */
export function logLine(event, fields = {}) {
  const tail = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  return `${new Date().toISOString()} ${event}${tail ? ` ${tail}` : ''}`
}

/** Append one line, creating the dir if missing. NEVER throws. */
export function writeLog(logPath, line) {
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, `${line}\n`)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// skill discovery (vendored files are the source of truth)
// ---------------------------------------------------------------------------

/**
 * Parse the YAML frontmatter DSH needs from one SKILL.md: `name`, `description`
 * (plain, quoted, or `>` folded), and `argument-hint`. Only these three fields
 * are read; everything else stays untouched in the body.
 */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (match === null) return { fields: {}, body: text }
  const lines = match[1].split(/\r?\n/)
  const fields = {}
  let key = null
  for (const line of lines) {
    const folded = /^\s+(\S.*)$/.exec(line)
    if (key !== null && folded !== null) {
      fields[key] = `${fields[key]} ${folded[1].trim()}`.trim()
      continue
    }
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (pair === null) {
      key = null
      continue
    }
    key = pair[1]
    fields[key] = pair[2].trim().replace(/^[>|][+-]?$/, '').trim()
  }
  // A folded block is joined on one line; a quoted scalar keeps its inner text.
  for (const [k, v] of Object.entries(fields)) {
    const quoted = /^(['"])([\s\S]*)\1$/.exec(v)
    if (quoted !== null) fields[k] = quoted[2]
  }
  return { fields, body: text.slice(match[0].length) }
}

/** Build the six registrations from the vendored tree. Throws only at activation. */
export function loadSkills() {
  return SKILL_NAMES.map((skillName) => {
    const dir = repoPath('skills', skillName)
    const { fields, body } = parseFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8'))
    const resolved = fields.name ?? skillName
    if (resolved !== skillName) {
      throw new Error(`vendored skill "${skillName}" declares name "${resolved}"; the catalog would be ambiguous`)
    }
    if (typeof fields.description !== 'string' || fields.description.length === 0) {
      throw new Error(`vendored skill "${skillName}" has no description; DSH would not list it`)
    }
    return {
      name: skillName,
      description: fields.description,
      content: body.trimStart(),
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'custom',
      resourceBase: { kind: 'directory', path: dir },
    }
  })
}

/** The always-on text for one level, produced by upstream's own builder. */
export function rulesetFor(mode) {
  return instructions.getPonytailInstructions(mode)
}

// ---------------------------------------------------------------------------
// mode state
// ---------------------------------------------------------------------------

/** Normalize any accepted spelling to a runtime mode, or undefined. */
export function normalizeRuntimeMode(value) {
  const normalized = config.normalizeMode(value)
  if (typeof normalized === 'string' && RUNTIME_MODES.has(normalized)) return normalized
  const persisted = config.normalizePersistedMode(value)
  return typeof persisted === 'string' && RUNTIME_MODES.has(persisted) ? persisted : undefined
}

/**
 * Resolve the configured default exactly as upstream does: explicit config,
 * then PONYTAIL_DEFAULT_MODE / ~/.config/ponytail/config.json, then 'full'.
 */
export function resolveDefaultMode(settings = {}) {
  if (typeof settings.defaultMode === 'string') {
    const explicit = normalizeRuntimeMode(settings.defaultMode)
    if (explicit !== undefined) return explicit
  }
  const upstream = normalizeRuntimeMode(config.getDefaultMode())
  return upstream ?? config.DEFAULT_MODE
}

/** Extract plain text from a DSH message content block list (defensive). */
export function messageText(message) {
  if (message === null || typeof message !== 'object') return ''
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

// ---------------------------------------------------------------------------
// plugin
// ---------------------------------------------------------------------------

export function apply(ctx, settings = {}) {
  const logPath = resolveLogPath(settings)
  const defaultMode = resolveDefaultMode(settings)
  const log = (event, fields) => writeLog(logPath, logLine(event, fields))

  /** sessionId -> mode; absent means "follow the configured default". */
  const modes = new Map()
  /** sessionId -> { disposeSection } — the live registration per agent. */
  const agents = new Map()
  /** `${sessionId}:${mode}:${hash}` of assemblies already recorded. */
  const recorded = new Set()
  let closed = false

  const modeOf = (sessionId) => modes.get(sessionId) ?? defaultMode

  // --- skills: these are also the native `/name` slash invocations ----------
  let skills = []
  try {
    skills = loadSkills()
  } catch (error) {
    log('skills-unavailable', { error: String(error && error.message ? error.message : error) })
  }
  for (const skill of skills) {
    try {
      ctx.skills.register(skill)
    } catch (error) {
      log('skill-register-failed', { skill: skill.name, error: String(error && error.message ? error.message : error) })
    }
  }

  // --- the one command that must exist: level switching --------------------
  try {
    ctx.commands.register({
      name: 'ponytail',
      description: 'Set or show the ponytail level (lite | full | ultra | off)',
      input: { hint: '[lite|full|ultra|off]' },
      handler: (invocation) => {
        const sessionId = invocation.agent && invocation.agent.id
        const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput.trim() : ''
        if (raw.length === 0) {
          const current = modeOf(sessionId)
          return {
            kind: 'success',
            text: [
              `Ponytail: ${current}${current === 'off' ? ' (inactive)' : ' (active)'}`,
              `Default: ${defaultMode}`,
              'Set: /ponytail lite | full | ultra | off',
            ].join('\n'),
          }
        }
        const requested = normalizeRuntimeMode(raw)
        if (requested === undefined) {
          return {
            kind: 'error',
            text: `Ponytail: unknown level "${raw}". Use lite, full, ultra, or off.`,
          }
        }
        const applied = setMode(invocation.agent, requested)
        return {
          kind: 'success',
          text: applied
            ? `Ponytail: ${requested}${requested === 'off' ? ' (inactive)' : ' (active)'}`
            : `Ponytail: ${requested} recorded, but this session cannot carry a prompt section.`,
        }
      },
    })
  } catch (error) {
    log('command-register-failed', { error: String(error && error.message ? error.message : error) })
  }

  /** (Re)install the per-agent prompt section for the current mode. */
  function installSection(agent) {
    const sessionId = agent && agent.id
    const entry = agents.get(sessionId)
    if (entry === undefined || closed) return false
    // Dispose first: the same section name in one scope throws on duplicate.
    if (entry.disposeSection !== null) {
      try {
        entry.disposeSection()
      } catch {
        /* a failed disposal must not block the replacement */
      }
      entry.disposeSection = null
    }
    const mode = modeOf(sessionId)
    if (mode === 'off') return true
    const scope = entry.ctx
    if (scope === undefined || typeof scope.systemPrompt?.section !== 'function') {
      // Loud, not silent: a missing scope means "always on" would be a lie for
      // this session, and the log line is the only way that becomes visible.
      log('scope-unavailable', { session: sessionId, hasCtx: scope !== undefined })
      return false
    }
    try {
      entry.disposeSection = scope.systemPrompt.section({
        name: 'ponytail',
        order: SECTION_ORDER,
        // The function form is what makes `off` a real gate: with the section
        // registered it is always part of the assembly, so removal is disposal.
        text: () => {
          try {
            const text = rulesetFor(mode)
            // The injected text is a pure function of the mode, so one line per
            // (session, mode) is enough evidence without per-step log spam.
            const key = `${sessionId}:${mode}`
            if (!recorded.has(key)) {
              recorded.add(key)
              log('assembled', { session: sessionId, mode, chars: text.length })
            }
            return text
          } catch (error) {
            log('assemble-failed', { session: sessionId, error: String(error && error.message ? error.message : error) })
            return ''
          }
        },
      })
      log('section-installed', { session: sessionId, mode })
      return true
    } catch (error) {
      log('section-failed', { session: sessionId, mode, error: String(error && error.message ? error.message : error) })
      return false
    }
  }

  /** Switch one session's level, keeping the registration in step with it. */
  function setMode(agent, mode) {
    const sessionId = agent && agent.id
    if (sessionId === undefined) return false
    const previous = modeOf(sessionId)
    modes.set(sessionId, mode)
    const applied = installSection(agent)
    log('mode', { session: sessionId, from: previous, to: mode, applied })
    return applied
  }

  // --- per-agent wiring ----------------------------------------------------
  function setupAgent(agent) {
    if (closed || agent === undefined || agent.id === undefined) return
    if (agents.has(agent.id)) return
    const scope = agent.ctx
    agents.set(agent.id, { ctx: scope, disposeSection: null, disposeListener: null })

    // Standalone "stop ponytail" / "normal mode" deactivates, matching upstream:
    // the whole message must be the command, never a phrase inside a request.
    if (scope !== undefined && typeof scope.on === 'function') {
      try {
        const disposeListener = scope.on('agent/pre-step', (payload, next) => {
          try {
            if (payload && Array.isArray(payload.messages) && payload.messages.length > 0) {
              const last = payload.messages[payload.messages.length - 1]
              const text = messageText(last)
              if (text.length > 0 && config.isDeactivationCommand(text) && modeOf(agent.id) !== 'off') {
                setMode(agent, 'off')
              }
            }
          } catch (error) {
            log('pre-step-failed', { session: agent.id, error: String(error && error.message ? error.message : error) })
          }
          // Never own the decision: this listener only observes.
          return next()
        })
        const entry = agents.get(agent.id)
        if (entry !== undefined && typeof disposeListener === 'function') entry.disposeListener = disposeListener
      } catch (error) {
        log('pre-step-register-failed', { session: agent.id, error: String(error && error.message ? error.message : error) })
      }
    }

    installSection(agent)
  }

  ctx.on('agent/created', ({ agent }) => setupAgent(agent))

  // Teardown ownership. A section registered through `agent.ctx` belongs to THAT
  // scope's fiber, not to this plugin's, and Cordis only disposes effects — a
  // cleanup function returned from apply() is ignored. Verified live 2026-10-23:
  // without this effect, `remove_bundle` left every section registered and the
  // reinstall failed with `prompt section "ponytail" is already registered`.
  // This effect is the second owner practices.md asks for, so unloading the
  // bundle really removes the ruleset.
  ctx.effect(() => () => {
    closed = true
    for (const entry of agents.values()) {
      if (entry.disposeSection !== null) {
        try {
          entry.disposeSection()
        } catch {
          /* teardown is best-effort */
        }
        entry.disposeSection = null
      }
      if (entry.disposeListener !== null) {
        try {
          entry.disposeListener()
        } catch {
          /* teardown is best-effort */
        }
        entry.disposeListener = null
      }
    }
    agents.clear()
    modes.clear()
    recorded.clear()
  })

  // Activation is not only for future sessions: a profile patch reload lands in
  // a running Host, so every agent that already exists must get its section too
  // or "always on" would silently skip the session that is open right now.
  try {
    const live = ctx.get?.('agents')
    if (live !== undefined && typeof live.list === 'function') {
      const existing = live.list()
      for (const agent of existing) setupAgent(agent)
      log('boot-sweep', { sessions: existing.length })
    }
  } catch (error) {
    log('boot-sweep-failed', { error: String(error && error.message ? error.message : error) })
  }

  log('activated', {
    defaultMode,
    skills: skills.length,
    version: readVersion(),
  })

  // No cleanup is returned: Cordis disposes the effect registered above, and a
  // returned function would only look like teardown while doing nothing.
}

/** The repo version, for the activation log line and the selftest. */
function readVersion() {
  try {
    return JSON.parse(readFileSync(repoPath('package.json'), 'utf8')).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
