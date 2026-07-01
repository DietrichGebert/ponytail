#!/usr/bin/env node
// Tests for .amp/plugins/ponytail.ts — the AmpCode platform adapter.
// Run via: node --experimental-strip-types --test tests/*.test.js
// All test names start with "amp-plugin:" per project convention.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')

// Set XDG_CONFIG_HOME before module load so getConfigPath() resolves to a
// deterministic temp location and never touches the real user config.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-amp-'))
process.env.XDG_CONFIG_HOME = tmp
delete process.env.PONYTAIL_DEFAULT_MODE

let mod
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.amp', 'plugins', 'ponytail.ts'))
  mod = await import(url)
})
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeAmp(configValue = {}) {
  const events = {}
  const commands = {}
  const statusUpdates = []
  const configUpdates = []
  const cfg = { ...configValue }
  return {
    events, commands, statusUpdates, configUpdates,
    on(event, handler) { events[event] = handler },
    registerCommand(name, _meta, handler) { commands[name] = handler },
    experimental: {
      createStatusItem() {
        return { update(o) { statusUpdates.push(o.text) } }
      },
    },
    configuration: {
      async get() { return { ...cfg } },
      async update(values) { configUpdates.push({ ...values }); Object.assign(cfg, values) },
    },
    getBuiltinAgent() {
      return { createThread: async () => ({ append: async () => {} }) }
    },
    logger: { log() {} },
  }
}

function makeCtx() {
  const notifications = []
  return {
    notifications,
    ui: { notify: async (text) => { notifications.push(text) } },
    thread: null,
  }
}

// Flush pending microtasks so the background void IIFE inside the plugin
// (which awaits amp.configuration.get() twice) fully resolves before assertions.
// setImmediate fires after all queued microtasks, so one hop is sufficient.
const drain = () => new Promise(r => setImmediate(r))

// ── normalizeMode ─────────────────────────────────────────────────────────────

test('amp-plugin: normalizeMode accepts valid runtime modes case-insensitively', () => {
  const { normalizeMode } = mod
  assert.equal(normalizeMode('lite'), 'lite')
  assert.equal(normalizeMode('FULL'), 'full')
  assert.equal(normalizeMode('  Ultra  '), 'ultra')
  assert.equal(normalizeMode('off'), 'off')
})

test('amp-plugin: normalizeMode rejects invalid and non-string inputs', () => {
  const { normalizeMode } = mod
  assert.equal(normalizeMode('review'), null)   // not a runtime mode
  assert.equal(normalizeMode(''), null)
  assert.equal(normalizeMode(123), null)
  assert.equal(normalizeMode(null), null)
  assert.equal(normalizeMode(undefined), null)
})

// ── getConfigPath ─────────────────────────────────────────────────────────────

test('amp-plugin: getConfigPath uses XDG_CONFIG_HOME when set', () => {
  const p = mod.getConfigPath()
  assert.ok(p.startsWith(tmp), `expected path under ${tmp}, got ${p}`)
  assert.ok(p.endsWith('config.json'))
})

// ── getMode ───────────────────────────────────────────────────────────────────

test('amp-plugin: getMode returns env var when PONYTAIL_DEFAULT_MODE is valid', () => {
  process.env.PONYTAIL_DEFAULT_MODE = 'ultra'
  try {
    assert.equal(mod.getMode(), 'ultra')
  } finally {
    delete process.env.PONYTAIL_DEFAULT_MODE
  }
})

test('amp-plugin: getMode falls back to config file, then to full', () => {
  delete process.env.PONYTAIL_DEFAULT_MODE
  try { fs.rmSync(mod.getConfigPath()) } catch {}
  assert.equal(mod.getMode(), 'full')
  mod.saveMode('lite')
  assert.equal(mod.getMode(), 'lite')
  fs.rmSync(mod.getConfigPath())
  assert.equal(mod.getMode(), 'full')
})

test('amp-plugin: getMode ignores invalid env var and falls through to default', () => {
  process.env.PONYTAIL_DEFAULT_MODE = 'bogus'
  try {
    assert.equal(mod.getMode(), 'full')
  } finally {
    delete process.env.PONYTAIL_DEFAULT_MODE
  }
})

// ── saveMode ──────────────────────────────────────────────────────────────────

test('amp-plugin: saveMode writes defaultMode to config JSON', () => {
  mod.saveMode('ultra')
  const written = JSON.parse(fs.readFileSync(mod.getConfigPath(), 'utf8'))
  assert.equal(written.defaultMode, 'ultra')
  fs.rmSync(mod.getConfigPath())
})

test('amp-plugin: saveMode creates parent directories automatically', () => {
  const saved = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = path.join(tmp, 'nested', 'deep')
  try {
    mod.saveMode('lite')
    assert.ok(fs.existsSync(mod.getConfigPath()))
  } finally {
    process.env.XDG_CONFIG_HOME = saved
  }
})

// ── filterBodyForMode ─────────────────────────────────────────────────────────

test('amp-plugin: filterBodyForMode strips frontmatter', () => {
  const result = mod.filterBodyForMode('---\ntitle: test\n---\nActual content', 'full')
  assert.ok(!result.includes('---'))
  assert.ok(!result.includes('title:'))
  assert.ok(result.includes('Actual content'))
})

test('amp-plugin: filterBodyForMode keeps lines matching mode, drops others', () => {
  const body = `preamble\n| **lite** | only lite |\n| **full** | only full |\n| **ultra** | only ultra |\npostamble`
  const result = mod.filterBodyForMode(body, 'full')
  assert.ok(result.includes('only full'))
  assert.ok(!result.includes('only lite'))
  assert.ok(!result.includes('only ultra'))
  assert.ok(result.includes('preamble') && result.includes('postamble'))
})

test('amp-plugin: filterBodyForMode keeps non-mode lines unchanged', () => {
  const body = 'rule 1\nrule 2\nrule 3'
  assert.equal(mod.filterBodyForMode(body, 'lite'), body)
})

// ── getInstructions ───────────────────────────────────────────────────────────

test('amp-plugin: getInstructions header contains active mode name', () => {
  const result = mod.getInstructions('full')
  assert.match(result, /PONYTAIL MODE ACTIVE — level: full/)
  assert.ok(result.length > 50)
})

test('amp-plugin: getInstructions normalizes unknown mode to full', () => {
  assert.match(mod.getInstructions('invalid'), /PONYTAIL MODE ACTIVE — level: full/)
})

// ── readSkillPrompt ───────────────────────────────────────────────────────────

test('amp-plugin: readSkillPrompt returns content for known skill names', () => {
  const review = mod.readSkillPrompt('ponytail-review')
  assert.ok(review.length > 0)
  assert.ok(review.toLowerCase().includes('over-engineer') || review.includes('Review'))
})

test('amp-plugin: readSkillPrompt returns generic fallback for unknown skill name', () => {
  assert.equal(mod.readSkillPrompt('ponytail-unknown'), 'Run ponytail-unknown.')
})

// ── statusText ────────────────────────────────────────────────────────────────

test('amp-plugin: statusText is empty string for off mode', () => {
  assert.equal(mod.statusText('off'), '')
})

test('amp-plugin: statusText includes emoji and uppercased mode for active modes', () => {
  assert.match(mod.statusText('lite'), /🌿/)
  assert.match(mod.statusText('lite'), /LITE/)
  assert.match(mod.statusText('full'), /⚡/)
  assert.match(mod.statusText('full'), /FULL/)
  assert.match(mod.statusText('ultra'), /🔥/)
  assert.match(mod.statusText('ultra'), /ULTRA/)
})

// ── Plugin integration (session.start) ───────────────────────────────────────

test('amp-plugin: session.start syncs mode from amp.configuration', async () => {
  const amp = makeAmp({ 'ponytail.mode': 'ultra' })
  await mod.default(amp)
  await drain()
  await amp.events['session.start']({}, makeCtx())
  const last = amp.statusUpdates.at(-1) ?? ''
  assert.match(last, /ULTRA/, `expected status to contain ULTRA, got: ${last}`)
})

test('amp-plugin: session.start notifies when mode is active', async () => {
  const amp = makeAmp({})
  await mod.default(amp)
  await drain()
  const ctx = makeCtx()
  await amp.events['session.start']({}, ctx)
  assert.ok(ctx.notifications.some(n => n.includes('Ponytail active')))
})

test('amp-plugin: session.start skips notification when mode is off', async () => {
  const amp = makeAmp({ 'ponytail.mode': 'off' })
  await mod.default(amp)
  await drain()
  const ctx = makeCtx()
  await amp.events['session.start']({}, ctx)
  assert.equal(ctx.notifications.length, 0)
})

// ── Plugin integration (agent.start) ─────────────────────────────────────────

test('amp-plugin: agent.start /ponytail ultra persists mode and returns early', async () => {
  const amp = makeAmp({})
  await mod.default(amp)
  await drain()
  const result = await amp.events['agent.start']({ message: '/ponytail ultra' }, makeCtx())
  assert.equal(result, undefined)
  assert.ok(
    amp.configUpdates.some(u => u['ponytail.mode'] === 'ultra'),
    'expected ponytail.mode to be persisted as ultra',
  )
})

test('amp-plugin: agent.start /ponytail with invalid arg is ignored', async () => {
  const amp = makeAmp({})
  await mod.default(amp)
  await drain()
  const before = amp.configUpdates.length
  const result = await amp.events['agent.start']({ message: '/ponytail nonsense' }, makeCtx())
  // Returns early (undefined) but does not persist a mode update for 'nonsense'
  assert.equal(result, undefined)
  const newModeUpdates = amp.configUpdates.slice(before).filter(u => 'ponytail.mode' in u)
  assert.equal(newModeUpdates.length, 0)
})

test('amp-plugin: agent.start /ponytail-review returns hidden skill message', async () => {
  const amp = makeAmp({})
  await mod.default(amp)
  await drain()
  const result = await amp.events['agent.start']({ message: '/ponytail-review' }, makeCtx())
  assert.equal(result?.message?.display, false)
  assert.ok(typeof result?.message?.content === 'string' && result.message.content.length > 0)
})

test('amp-plugin: agent.start /ponytail-audit returns hidden skill message', async () => {
  const amp = makeAmp({})
  await mod.default(amp)
  await drain()
  const result = await amp.events['agent.start']({ message: '/ponytail-audit' }, makeCtx())
  assert.equal(result?.message?.display, false)
  assert.ok(typeof result?.message?.content === 'string' && result.message.content.length > 0)
})

test('amp-plugin: agent.start normal prompt injects instructions when active', async () => {
  const amp = makeAmp({})
  await mod.default(amp)
  await drain()
  const result = await amp.events['agent.start']({ message: 'fix this bug' }, makeCtx())
  assert.equal(result?.message?.display, false)
  assert.match(result?.message?.content ?? '', /PONYTAIL MODE ACTIVE/)
})

test('amp-plugin: agent.start normal prompt returns nothing when mode is off', async () => {
  const amp = makeAmp({ 'ponytail.mode': 'off' })
  await mod.default(amp)
  await drain()
  const result = await amp.events['agent.start']({ message: 'fix this bug' }, makeCtx())
  assert.equal(result, undefined)
})
