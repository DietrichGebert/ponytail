// Ponytail for DeepSeek Harness: host half.
//
// The ruleset and mode vocabulary stay in hooks/ and skills/; this file only
// maps them onto DSH: a per-step system section, six runtime skills, the
// /ponytail command, and a session projection the Web client reads.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)))
let repoRoot = path.resolve(here, '..')
if (!fs.existsSync(path.join(repoRoot, 'hooks/ponytail-config.js'))) {
  // A Git subdirectory install ships only dsh-plugin/; the prompt lives in the
  // declared @dietrichgebert/ponytail dependency.
  const rootEntry = require.resolve('@dietrichgebert/ponytail')
  repoRoot = path.resolve(path.dirname(rootEntry), '..', '..')
}
const { getPonytailInstructions } = require(path.join(repoRoot, 'hooks/ponytail-instructions.js'))
const { getDefaultMode, normalizeMode, writeDefaultMode, isDeactivationCommand } = require(path.join(repoRoot, 'hooks/ponytail-config.js'))

export const name = 'dsh-ponytail'
export const inject = ['systemPrompt', 'commands', 'skills', 'sessionProjections']

const SKILL_NAMES = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']
const MODES = ['off', 'lite', 'full', 'ultra']

function frontmatterField(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/)
  const start = lines.findIndex((line) => new RegExp(`^${key}:`).test(line))
  if (start < 0) return ''
  const inline = lines[start].slice(key.length + 1).trim()
  if (inline !== '>' && inline !== '|') return inline
  const out = []
  for (let i = start + 1; i < lines.length; i += 1) {
    if (!/^\s+/.test(lines[i])) break
    out.push(lines[i].trim())
  }
  return out.join(' ').trim()
}

/** Read one skill bundle from the checkout, without its YAML frontmatter. */
export function readSkill(skillName) {
  const raw = fs.readFileSync(path.join(repoRoot, 'skills', skillName, 'SKILL.md'), 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const frontmatter = match ? match[1] : ''
  const body = (match ? raw.slice(match[0].length) : raw).replace(/^\s+/, '')
  return {
    name: frontmatterField(frontmatter, 'name') || skillName,
    description: frontmatterField(frontmatter, 'description') || skillName,
    content: body,
  }
}

/** Parse the text after `/ponytail`; pure so it can be tested without a host. */
export function parsePonytailCommand(text, defaultMode = 'full', currentMode = 'full') {
  const normalized = String(text ?? '').trim().toLowerCase()
  if (!normalized) {
    if (currentMode !== 'off') return { type: 'status' }
    return { type: 'set-mode', mode: defaultMode === 'off' ? 'full' : defaultMode }
  }
  const [primary, secondary] = normalized.split(/\s+/)
  if (primary === 'status') return { type: 'status' }
  if (primary === 'default') {
    const mode = normalizeMode(secondary)
    return mode ? { type: 'set-default', mode } : { type: 'invalid', reason: 'invalid-default-mode' }
  }
  const mode = normalizeMode(primary)
  return mode ? { type: 'set-mode', mode } : { type: 'invalid', reason: 'invalid-mode', mode: primary }
}

function normalizeState(value) {
  const mode = normalizeMode(value?.mode) || 'full'
  const defaultMode = normalizeMode(value?.defaultMode) || mode
  const running = value?.running && typeof value.running.commandId === 'string'
    ? {
        commandId: value.running.commandId,
        requested: normalizeMode(value.running.requested),
        defaultRequested: normalizeMode(value.running.defaultRequested),
      }
    : null
  return { mode, defaultMode, running }
}

const stateSchema = { parse: normalizeState }

// Keep the wire object reference stable across internal-only changes; the
// projection drive publishes on Object.is of the view result.
const wireCache = new Map()
function wireView(state) {
  if (!wireCache.has(state.mode)) wireCache.set(state.mode, { mode: state.mode })
  return wireCache.get(state.mode)
}

const viewSchema = {
  parse(value) {
    if (!value || !MODES.includes(value.mode)) throw new Error(`ponytail: invalid mode ${String(value?.mode)}`)
    return value
  },
}

/**
 * Session projection folding the /ponytail command log. `command/run` carries
 * the requested level; `command/done` commits it only on success. Resume and
 * fork replay the same events, so the level needs no extra session event type.
 */
export function createPonytailProjection(defaultMode = () => getDefaultMode()) {
  return {
    key: 'ponytail',
    stateVersion: 1,
    stateSchema,
    init() {
      const mode = normalizeMode(defaultMode()) || 'full'
      return { mode, defaultMode: mode, running: null }
    },
    apply(state, event) {
      if (event.type === 'command/run' && event.data.name === 'ponytail') {
        const args = String(event.data.args ?? '').trim().toLowerCase()
        let requested = null
        let defaultRequested = null
        if (!args) {
          if (state.mode === 'off') requested = state.defaultMode === 'off' ? 'full' : state.defaultMode
        } else if (args === 'status') {
          // status reports; it does not change the level.
        } else if (args.startsWith('default ')) {
          defaultRequested = normalizeMode(args.slice('default '.length).trim())
        } else {
          requested = normalizeMode(args)
        }
        return { ...state, running: { commandId: event.data.commandId, requested, defaultRequested } }
      }
      if (event.type === 'command/done' && state.running?.commandId === event.data.commandId) {
        const running = state.running
        if (event.data.kind !== 'success') return { ...state, running: null }
        return {
          ...state,
          running: null,
          mode: running.requested ?? state.mode,
          defaultMode: running.defaultRequested ?? state.defaultMode,
        }
      }
      return state
    },
    wire: { viewSchema, view: wireView },
  }
}

function rulesFor(mode) {
  return mode === 'off' ? '' : getPonytailInstructions(mode)
}

function messageText(message) {
  if (message === null || typeof message !== 'object') return ''
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

export function apply(ctx) {
  const sessionModes = new Map()
  const ruleCache = new Map()
  /** agent.id -> { ctx, disposeSection, disposeListener } */
  const agents = new Map()
  /** session.id -> agent, for projection-driven mode changes */
  const sessionAgents = new Map()
  let closed = false

  const rulesForCached = (mode) => {
    if (!ruleCache.has(mode)) ruleCache.set(mode, rulesFor(mode))
    return ruleCache.get(mode)
  }

  const modeOf = (session, fallback) => {
    try {
      const state = ctx.sessionProjections.stateOf(session, 'ponytail')
      return normalizeMode(state?.mode) || fallback
    } catch {
      return fallback
    }
  }

  const modeForAgent = (agent) => {
    if (agent?.id !== undefined && sessionModes.has(agent.id)) return sessionModes.get(agent.id)
    const fallback = normalizeMode(getDefaultMode()) || 'full'
    const mode = agent?.session ? modeOf(agent.session, fallback) : fallback
    if (agent?.id !== undefined) sessionModes.set(agent.id, mode)
    return mode
  }

  function disposeSection(entry) {
    if (entry.disposeSection === null) return
    try {
      entry.disposeSection()
    } catch {
      /* a failed disposal must not block a replacement or teardown */
    }
    entry.disposeSection = null
  }

  function disposeListener(entry) {
    if (entry.disposeListener === null) return
    try {
      entry.disposeListener()
    } catch {
      /* teardown is best-effort */
    }
    entry.disposeListener = null
  }

  function disposeEntry(entry) {
    disposeSection(entry)
    disposeListener(entry)
  }

  /**
   * Register or remove this agent instance's prompt section. The section text
   * stays dynamic, so a mode change does not need a new registration; `off`
   * disposes it so no inert section remains in the assembly.
   */
  function installSection(agent) {
    const entry = agents.get(agent?.id)
    if (entry === undefined || closed) return false
    if (modeForAgent(agent) === 'off') {
      disposeSection(entry)
      return true
    }
    if (entry.disposeSection !== null) return true
    const scope = entry.ctx
    if (scope === undefined || typeof scope.systemPrompt?.section !== 'function') return false
    try {
      const dispose = scope.systemPrompt.section({
        name: 'ponytail',
        order: 400,
        text: () => {
          const current = modeForAgent(agent)
          return current === 'off' ? '' : rulesForCached(current)
        },
      })
      entry.disposeSection = typeof dispose === 'function' ? dispose : null
      return entry.disposeSection !== null
    } catch {
      return false
    }
  }

  function setMode(agent, mode) {
    if (agent?.id === undefined) return false
    sessionModes.set(agent.id, mode)
    return installSection(agent)
  }

  function setupAgent(agent) {
    if (closed || agent?.id === undefined || agents.has(agent.id)) return
    const scope = agent.ctx
    const entry = { ctx: scope, disposeSection: null, disposeListener: null }
    agents.set(agent.id, entry)
    if (agent.session?.id !== undefined) sessionAgents.set(agent.session.id, agent)

    // Standalone "stop ponytail" / "normal mode" disables this agent. The whole
    // message must match, so a request that merely mentions the phrase is safe.
    if (scope !== undefined && typeof scope.on === 'function') {
      try {
        const dispose = scope.on('agent/pre-step', (payload, next) => {
          try {
            const messages = payload?.messages
            if (Array.isArray(messages) && messages.length > 0) {
              const text = messageText(messages[messages.length - 1])
              if (text.length > 0 && isDeactivationCommand(text) && modeForAgent(agent) !== 'off') {
                setMode(agent, 'off')
              }
            }
          } catch {
            /* never fail a turn because a deactivation check failed */
          }
          return typeof next === 'function' ? next() : undefined
        })
        if (typeof dispose === 'function') entry.disposeListener = dispose
      } catch {
        /* a missing pre-step hook leaves /ponytail off available */
      }
    }

    installSection(agent)
  }

  function disposeAgent(agent) {
    const entry = agents.get(agent?.id)
    if (entry !== undefined) {
      disposeEntry(entry)
      agents.delete(agent.id)
    }
    if (agent?.session?.id !== undefined) sessionAgents.delete(agent.session.id)
    if (agent?.id !== undefined) sessionModes.delete(agent.id)
  }

  ctx.effect(() => ctx.sessionProjections.register(createPonytailProjection()))
  ctx.effect(() => ctx.sessionProjections.onChanged((session, key, value) => {
    if (key !== 'ponytail') return
    const mode = normalizeMode(value?.mode) || 'full'
    const agent = session?.id === undefined ? undefined : sessionAgents.get(session.id)
    if (agent !== undefined) {
      sessionModes.set(agent.id, mode)
      installSection(agent)
    }
  }))

  for (const skillName of SKILL_NAMES) {
    const skill = readSkill(skillName)
    ctx.effect(() => ctx.skills.register({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      // The /ponytail command owns the bare name; keep the skill for the model
      // and let the other five answer /ponytail-review and friends.
      invocation: { modelInvocable: true, userInvocable: skillName !== 'ponytail' },
    }))
  }

  ctx.effect(() => ctx.commands.register({
    name: 'ponytail',
    description: 'Set Ponytail mode: off, lite, full, ultra; status; default <mode>',
    input: { hint: '[lite|full|ultra|off|status|default <mode>]' },
    handler: ({ agent, rawInput }) => {
      const defaultMode = normalizeMode(getDefaultMode()) || 'full'
      const currentMode = modeForAgent(agent)
      const parsed = parsePonytailCommand(rawInput, defaultMode, currentMode)
      if (parsed.type === 'status') {
        return { kind: 'success', text: `Ponytail: current ${currentMode} • default ${defaultMode}` }
      }
      if (parsed.type === 'set-default') {
        const written = writeDefaultMode(parsed.mode)
        if (!written) return { kind: 'error', text: `Ponytail: ${parsed.mode} is not a valid default mode.` }
        const effective = normalizeMode(getDefaultMode()) || written
        const note = effective === written ? '' : ` (env override keeps ${effective})`
        return { kind: 'success', text: `Default Ponytail mode set to ${written}${note}.` }
      }
      if (parsed.type === 'set-mode') {
        setMode(agent, parsed.mode)
        return { kind: 'success', text: `Ponytail mode set to ${parsed.mode}.` }
      }
      return { kind: 'error', text: `Ponytail: unknown mode "${parsed.mode ?? rawInput.trim()}".` }
    },
  }))

  ctx.on('agent/created', ({ agent }) => setupAgent(agent))
  ctx.on('agent/disposed', ({ agent }) => disposeAgent(agent))

  // A profile reload lands in a running Host; install for agents that already exist.
  try {
    const live = ctx.get?.('agents')
    if (live !== undefined && typeof live.list === 'function') {
      for (const agent of live.list()) setupAgent(agent)
    }
  } catch {
    /* the per-agent hook still covers future agents */
  }

  // Agent-scope sections are owned by the agent's fiber, not this plugin's;
  // dispose them explicitly so remove/reinstall leaves no section behind.
  ctx.effect(() => () => {
    closed = true
    for (const entry of agents.values()) disposeEntry(entry)
    agents.clear()
    sessionAgents.clear()
    sessionModes.clear()
  })
}
