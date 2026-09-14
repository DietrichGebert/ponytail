// dsh-plugin-ponytail — Node half, fully self-contained (zero dependencies).
//
// One mount, two registrations into host-global layers:
//  1. ctx.commands.register  — the six /ponytail* slash commands. A DSH
//     command handler runs WITHOUT opening a model turn and its result text
//     is rendered only in the UI (never enters model history), so each
//     handler drives the agent with agent.steer(createUserMessage(...)) —
//     the same pattern the built-in /plan command uses.
//  2. ctx.skills.registerProvider — a bundled-skill provider serving the six
//     ponytail skills. It sits in the skill registry's global (deployment)
//     layer, so every agent/preset sees the skills even though the web profile
//     disables the host skill-filesystem row. Skills are static SKILL.md files,
//     parsed once at load — no watchers.
//
// Thin adapter, single source of truth: in a repo checkout (or a path-based
// dsh plugin install) the skills are read from the repo-root ../skills/ — the
// same files every other adapter references. The package's own skills/ only
// exists in the published npm tarball, where npm cannot include files outside
// the package dir: scripts/sync-skills.mjs regenerates it as a prepack
// artifact from ../skills/ (byte-checked by tests).
// Command briefings mirror commands/*.toml.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const name = 'dsh-plugin-ponytail'
const inject = ['commands', 'skills']

const packageDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

// Repo-root skills/ (single source of truth) win in a checkout; the packaged
// skills/ is the npm-tarball fallback.
function resolveSkillsDir() {
  const repoRoot = join(packageDir, '..', 'skills')
  if (existsSync(repoRoot)) return repoRoot
  return join(packageDir, 'skills')
}

const skillsDir = resolveSkillsDir()

// Host skill-name grammar (mirrors @deepseek-ai/dsh-skill's isSkillName):
// kebab-case. A bundled SKILL.md whose name fails this is skipped, because the
// host rejects such a candidate OUTSIDE the per-provider try/catch and would
// otherwise take down the whole profile's skill registry.
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// ── slash commands ─────────────────────────────────────────────────────────

const COMMANDS = [
  {
    name: 'ponytail',
    description: 'Switch ponytail intensity level (lite/full/ultra/off)',
    hint: '[lite|full|ultra|off]',
    prompt: (args) => {
      // Case-insensitive level; anything not a known mode falls back to full
      // (so "/ponytail nonsense" never becomes "Switch to ponytail nonsense").
      const level = (args || '').toLowerCase()
      if (level === 'off') {
        return 'Turn ponytail mode OFF. Stop applying the lazy-senior-dev ruleset for the rest of this session and work normally; acknowledge in one line.'
      }
      const mode = ['lite', 'full', 'ultra'].includes(level) ? level : 'full'
      return `Switch to ponytail ${mode} mode. ` +
        'Lazy senior dev mode, before any code: does it need to exist at all (YAGNI)? ' +
        'Does the standard library do it? A native platform feature? Can it be one line? ' +
        'Build the minimum that works. No unrequested abstractions, no avoidable dependencies, ' +
        'no boilerplate. Mark deliberate simplifications that cut a real corner with a known ' +
        'ceiling using a ponytail: comment that names the ceiling and upgrade path.'
    }
  },
  {
    name: 'ponytail-review',
    description: 'Review changes for over-engineering, what can be deleted',
    prompt: () =>
      'Review the current code changes for over-engineering only, not correctness. ' +
      'One line per finding: L<line>: <tag> <what to cut>. <replacement>. ' +
      'Tags: delete (dead code/speculative feature), stdlib (reinvented standard library), ' +
      'native (dependency doing what the platform does), yagni (abstraction with one ' +
      'implementation), shrink (same logic, fewer lines). End with the net lines removable. ' +
      "If nothing to cut: 'Lean already. Ship.'"
  },
  {
    name: 'ponytail-audit',
    description: 'Audit the whole repo for over-engineering, what can be deleted',
    prompt: () =>
      'Audit the entire repository for over-engineering only, not correctness. Scan the whole ' +
      'tree, not a diff. One line per finding, ranked biggest cut first: <tag> <what to cut>. ' +
      '<replacement>. [path]. Tags: delete (dead code/speculative feature), stdlib (reinvented ' +
      'standard library), native (dependency doing what the platform does), yagni (abstraction ' +
      'with one implementation), shrink (same logic, fewer lines). End with the net lines and ' +
      "dependencies removable. If nothing to cut: 'Lean already. Ship.'"
  },
  {
    name: 'ponytail-debt',
    description: 'Harvest ponytail: comments into a tracked debt ledger',
    prompt: () =>
      "Harvest every `ponytail:` comment in this repository into a debt ledger so deferrals do " +
      "not rot into 'later means never'. Grep the whole tree for comment markers " +
      "(grep -rnE '(#|//) ?ponytail:' ., skipping node_modules/.git/build output). One row per " +
      'marker, grouped by file: <file>:<line> — <what was simplified>. ceiling: <the limit named ' +
      'in the comment>. upgrade: <the trigger to revisit>. Tag any marker that names no upgrade ' +
      'path or trigger as no-trigger, those rot silently. End with the count of markers and how ' +
      "many lack a trigger. If none: 'No ponytail: debt. Clean ledger.' Report only, change nothing."
  },
  {
    name: 'ponytail-gain',
    description: "Show ponytail's measured impact scoreboard (less code, cost, time)",
    prompt: () =>
      'Show the ponytail gain scoreboard. One shot, change nothing: do not switch mode, write ' +
      'flag files, or persist anything. Render the published benchmark medians (5 everyday ' +
      'tasks; models Haiku, Sonnet, Opus; source benchmarks/ and the README) as plain ASCII bars: ' +
      'Lines of code, no-skill 100% vs ponytail 6-20% (down 80-94%); Cost, no-skill 100% vs ' +
      'ponytail 23-53% (down 47-77%); Speed, ponytail 3-6x faster. The bar length shows the ' +
      'measured range, the label carries the exact figure. These are benchmark medians, not this ' +
      'repo. NEVER print a per-repo savings number: the unbuilt version was never written, so ' +
      'there is no real baseline to subtract from in a live repo. For real per-repo figures, ' +
      'point to /ponytail-debt (the counted shortcut ledger) and /ponytail-audit (what is still ' +
      'cuttable). Report only.'
  },
  {
    name: 'ponytail-help',
    description: 'Quick reference for ponytail levels, skills, and commands',
    prompt: () =>
      'Show the ponytail quick reference. One shot, change nothing: do not switch mode, write ' +
      'flag files, or persist anything. Levels: /ponytail lite (build what is asked, name the ' +
      'lazier alternative in one line), /ponytail (full, the default ladder: YAGNI then stdlib ' +
      'then native then one line then minimum), /ponytail ultra (deletion before addition, ' +
      'challenges the requirement before building). Commands: /ponytail-review (over-engineering ' +
      'review of the current changes), /ponytail-audit (whole-repo over-engineering audit), ' +
      '/ponytail-debt (harvest ponytail: comments into a tracked ledger), /ponytail-gain ' +
      '(measured-impact scoreboard from the benchmark), /ponytail-help (this card). Deactivate ' +
      "with 'stop ponytail', 'normal mode', or /ponytail off; resume anytime with /ponytail."
  }
]

// ── bundled skill provider ─────────────────────────────────────────────────

/**
 * Minimal static-bundle skill provider: reads skills/<name>/SKILL.md once.
 * ponytail: ceiling — no file watcher (skills are immutable inside the
 * installed package); upgrade path — mirror dsh-skill-filesystem's
 * SkillWatchManager + observeHostMutation if HMR for edited bundles matters.
 */
class BundledSkillProvider {
  name = 'dsh-plugin-ponytail'
  skills = new Map()

  constructor(root, logger) {
    let entries
    try {
      entries = readdirSync(root, { withFileTypes: true })
    } catch (error) {
      // A missing/unreadable bundle dir must not take down the whole profile
      // (mirrors dsh-skill-filesystem, which returns an empty catalog for an
      // absent root). Degrade to an empty provider with a visible warning.
      logger?.(`dsh-plugin-ponytail: skill dir not readable (${root}): ${error?.message ?? error}; serving no skills`)
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const path = join(root, entry.name, 'SKILL.md')
      let raw
      try {
        raw = readFileSync(path, 'utf8')
      } catch {
        continue // no SKILL.md in this subdirectory — not a skill bundle
      }
      const parsed = parseSkillMarkdown(raw)
      if (!parsed) {
        logger?.(`dsh-plugin-ponytail: ${path} has no usable name/description frontmatter; skipped`)
        continue
      }
      if (!SKILL_NAME.test(parsed.name)) {
        logger?.(`dsh-plugin-ponytail: ${path} declares invalid skill name "${parsed.name}" (need kebab-case); skipped`)
        continue
      }
      const definition = {
        name: parsed.name,
        description: parsed.description,
        ...(parsed.whenToUse !== void 0 ? { whenToUse: parsed.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'bundled',
        provider: this.name,
        // 600 = @deepseek-ai/dsh-skill's BUNDLED_SKILL_RANK: packaged roots
        // are the LOWEST precedence (project/user/custom ranks are smaller)
        // so a user's own skill of the same name always wins.
        rank: 600,
        resourceBase: { kind: 'directory', path: dirname(path) },
        path,
        content: parsed.content
      }
      // Freeze so a consumer can't mutate the shared, reused definition — the
      // same object is served to every agent (the host likewise freezes
      // messages before reuse).
      this.skills.set(parsed.name, Object.freeze(definition))
    }
  }

  /** Catalog summaries (cwd-independent — the bundle is the same for every project). */
  async list() {
    return { candidates: [...this.skills.values()], complete: true }
  }

  /** Load one full skill body. */
  async get(candidate) {
    return this.skills.get(candidate?.name)
  }

  dispose() {}
}

/**
 * Parse the `name:`/`description:`/`whenToUse:` fields out of a SKILL.md YAML
 * frontmatter. ponytail: ceiling — handles only the scalar/block-scalar fields
 * ponytail's own SKILL.md files use (description is a YAML `>` folded block);
 * upgrade path — shell out to js-yaml if a bundled skill needs full YAML.
 */
function parseSkillMarkdown(raw) {
  // Normalize CRLF to LF: npm/text checkouts on Windows store SKILL.md with
  // \r\n line endings, which would otherwise defeat the LF-only frontmatter
  // fence and silently drop every bundled skill.
  const text = raw.replace(/\r\n/g, '\n')
  const match = /^---\n(.*?)\n---\n?(.*)$/s.exec(text)
  if (!match) return void 0
  const [, frontmatter, body] = match
  const fields = {}
  const keyRe = /^(name|description|whenToUse):\s*(.*)$/
  let current = null
  for (const line of frontmatter.split('\n')) {
    const m = keyRe.exec(line)
    if (m) {
      current = m[1]
      const inline = m[2].trim()
      fields[current] = inline === '>' || inline === '|' ? '' : inline.replace(/^["']|["']$/g, '')
      if (inline !== '>' && inline !== '|') current = null
    } else if (current && /^\s+/.test(line)) {
      fields[current] += (fields[current] ? ' ' : '') + line.trim()
    } else {
      // An unindented line is the next top-level key (or blank): the folded
      // block ended at the previous line.
      current = null
    }
  }
  if (typeof fields.name !== 'string' || !fields.name) return void 0
  if (typeof fields.description !== 'string' || !fields.description) return void 0
  return { name: fields.name, description: fields.description, ...(fields.whenToUse ? { whenToUse: fields.whenToUse } : {}), content: body.trim() }
}

// ── plugin mount ───────────────────────────────────────────────────────────

/** Mount the six commands and the bundled-skill provider; disposes with the fiber. */
function apply(ctx) {
  const warn = (message) => ctx.logger?.warn?.(message)

  for (const command of COMMANDS) {
    ctx.commands.register({
      name: command.name,
      description: command.description,
      ...(command.hint ? { input: { hint: command.hint } } : {}),
      // A DSH command runs WITHOUT opening a model turn, and its result text is
      // rendered only in the UI — it never enters model history. So to make the
      // briefing actually drive the agent (the whole point of the command), we
      // steer the agent with a user message, mirroring dsh-plan-mode's /plan.
      // Prefer the host's createUserMessage (it mints the branded message id);
      // fall back to the identical minimal shape if the host package is not on
      // the resolution path.
      handler: async (invocation) => {
        const text = command.prompt(invocation.rawInput?.trim() ?? '')
        const content = [{ type: 'text', text }]
        const source = { kind: 'user' }
        try {
          const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
          invocation.agent.steer(createUserMessage({ content, source }))
        } catch {
          invocation.agent.steer({ role: 'user', id: randomUUID(), content, source })
        }
        return { kind: 'success', text }
      }
    })
  }

  const provider = new BundledSkillProvider(skillsDir, warn)
  ctx.skills.registerProvider(() => provider)
}

export { name, inject, apply, BundledSkillProvider }
