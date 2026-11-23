import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, parsePonytailCommand, createPonytailProjection, readSkill } from '../dsh-plugin/index.mjs'

test('parses /ponytail arguments', () => {
  assert.deepEqual(parsePonytailCommand('', 'full', 'full'), { type: 'status' })
  assert.deepEqual(parsePonytailCommand('', 'full', 'off'), { type: 'set-mode', mode: 'full' })
  assert.deepEqual(parsePonytailCommand('', 'lite', 'off'), { type: 'set-mode', mode: 'lite' })
  assert.deepEqual(parsePonytailCommand('  ULTRA ', 'full', 'full'), { type: 'set-mode', mode: 'ultra' })
  assert.deepEqual(parsePonytailCommand('status', 'full', 'full'), { type: 'status' })
  assert.deepEqual(parsePonytailCommand('default lite', 'full', 'full'), { type: 'set-default', mode: 'lite' })
  assert.equal(parsePonytailCommand('default review', 'full', 'full').type, 'invalid')
  assert.equal(parsePonytailCommand('wat', 'full', 'full').type, 'invalid')
})

test('projection commits only successful commands and is log-restorable', () => {
  const projection = createPonytailProjection(() => 'full')
  let state = projection.init()
  assert.equal(state.mode, 'full')

  state = projection.apply(state, {
    type: 'command/run',
    data: { commandId: '1', name: 'ponytail', args: ' ultra' },
  })
  state = projection.apply(state, {
    type: 'command/done',
    data: { commandId: '1', kind: 'success' },
  })
  assert.equal(state.mode, 'ultra')

  state = projection.apply(state, {
    type: 'command/run',
    data: { commandId: '2', name: 'ponytail', args: ' default lite' },
  })
  state = projection.apply(state, {
    type: 'command/done',
    data: { commandId: '2', kind: 'success' },
  })
  assert.equal(state.defaultMode, 'lite')
  assert.equal(state.mode, 'ultra')

  state = projection.apply(state, {
    type: 'command/run',
    data: { commandId: '3', name: 'ponytail', args: ' bad' },
  })
  state = projection.apply(state, {
    type: 'command/done',
    data: { commandId: '3', kind: 'error' },
  })
  assert.equal(state.mode, 'ultra')
  assert.equal(state.running, null)

  const unchanged = projection.apply(state, { type: 'unrelated', data: {} })
  assert.equal(unchanged, state)
})

test('bare /ponytail switches off back on at the default', () => {
  const projection = createPonytailProjection(() => 'lite')
  let state = { ...projection.init(), mode: 'off' }
  state = projection.apply(state, {
    type: 'command/run',
    data: { commandId: '1', name: 'ponytail', args: '' },
  })
  state = projection.apply(state, {
    type: 'command/done',
    data: { commandId: '1', kind: 'success' },
  })
  assert.equal(state.mode, 'lite')
})

test('wire view keeps one object per mode', () => {
  const projection = createPonytailProjection(() => 'full')
  const state = projection.init()
  assert.equal(projection.wire.view(state), projection.wire.view({ ...state, running: null }))
  assert.deepEqual(projection.wire.view(state), { mode: 'full' })
})

test('every skill reads with a name, description and body', () => {
  for (const name of ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']) {
    const skill = readSkill(name)
    assert.equal(skill.name, name)
    assert.ok(skill.description.length > 10)
    assert.ok(!skill.content.startsWith('---'))
    assert.ok(skill.content.length > 100)
  }
})

function fakeHost() {
  const state = { sections: [], effects: [], skills: [], commands: [], hostListeners: new Map() }

  function makeScope() {
    const scope = {
      preSteps: new Map(),
      systemPrompt: {
        section(definition) {
          state.sections.push(definition)
          let live = true
          return () => {
            if (!live) return
            live = false
            const index = state.sections.indexOf(definition)
            if (index >= 0) state.sections.splice(index, 1)
          }
        },
      },
      on(event, listener) {
        scope.preSteps.set(event, listener)
        return () => scope.preSteps.delete(event)
      },
    }
    return scope
  }

  const ctx = {
    skills: { register: (definition) => (state.skills.push(definition), () => {}) },
    commands: { register: (definition) => (state.commands.push(definition), () => {}) },
    sessionProjections: {
      register: () => () => {},
      onChanged: (listener) => (state.onChanged = listener, () => {}),
      stateOf: () => undefined,
    },
    on(event, listener) {
      state.hostListeners.set(event, listener)
      return () => state.hostListeners.delete(event)
    },
    effect(action) {
      const dispose = action()
      if (typeof dispose === 'function') state.effects.push(dispose)
      return () => {}
    },
    get: () => undefined,
  }

  return { ctx, state, makeScope }
}

test('per-agent sections dispose on off, stop phrase and teardown', () => {
  const previous = process.env.PONYTAIL_DEFAULT_MODE
  process.env.PONYTAIL_DEFAULT_MODE = 'full'
  try {
    const { ctx, state, makeScope } = fakeHost()
    apply(ctx)

    const first = { id: 'a1', session: { id: 's1' }, ctx: makeScope() }
    const second = { id: 'a2', session: { id: 's2' }, ctx: makeScope() }
    const created = state.hostListeners.get('agent/created')
    created({ agent: first })
    created({ agent: second })
    assert.equal(state.sections.length, 2, 'each agent instance owns one section')

    const command = state.commands.find((entry) => entry.name === 'ponytail')
    command.handler({ agent: first, rawInput: 'off' })
    assert.equal(state.sections.length, 1, 'off disposes only the first agent section')
    assert.match(state.sections[0].text(), /level: full/)

    const preStep = second.ctx.preSteps.get('agent/pre-step')
    preStep({ messages: [{ content: 'please stop ponytail after this' }] }, () => {})
    assert.equal(state.sections.length, 1, 'the phrase only counts as a standalone message')
    preStep({ messages: [{ content: 'stop ponytail' }] }, () => {})
    assert.equal(state.sections.length, 0, 'stop ponytail disposes the second agent section')

    command.handler({ agent: second, rawInput: 'ultra' })
    assert.equal(state.sections.length, 1)
    assert.match(state.sections[0].text(), /level: ultra/)

    state.hostListeners.get('agent/disposed')({ agent: second })
    assert.equal(state.sections.length, 0, 'agent disposal cleans up its section')

    for (const dispose of state.effects) dispose()
    assert.equal(state.sections.length, 0, 'teardown leaves no section behind')
  } finally {
    if (previous === undefined) delete process.env.PONYTAIL_DEFAULT_MODE
    else process.env.PONYTAIL_DEFAULT_MODE = previous
  }
})


test('projection updates every agent sharing a session', () => {
  const previous = process.env.PONYTAIL_DEFAULT_MODE
  process.env.PONYTAIL_DEFAULT_MODE = 'full'
  try {
    const { ctx, state, makeScope } = fakeHost()
    apply(ctx)

    const first = { id: 'a1', session: { id: 'shared' }, ctx: makeScope() }
    const second = { id: 'a2', session: { id: 'shared' }, ctx: makeScope() }
    const created = state.hostListeners.get('agent/created')
    created({ agent: first })
    created({ agent: second })
    assert.equal(state.sections.length, 2)

    state.onChanged({ id: 'shared' }, 'ponytail', { mode: 'off' })
    assert.equal(state.sections.length, 0, 'all agents sharing the session see the projection change')

    state.onChanged({ id: 'shared' }, 'ponytail', { mode: 'full' })
    assert.equal(state.sections.length, 2)

    state.hostListeners.get('agent/disposed')({ agent: first })
    assert.equal(state.sections.length, 1, 'disposing one peer leaves the other registration')

    state.onChanged({ id: 'shared' }, 'ponytail', { mode: 'off' })
    assert.equal(state.sections.length, 0)

    for (const dispose of state.effects) dispose()
  } finally {
    if (previous === undefined) delete process.env.PONYTAIL_DEFAULT_MODE
    else process.env.PONYTAIL_DEFAULT_MODE = previous
  }
})
