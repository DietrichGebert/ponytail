import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePonytailCommand, createPonytailProjection, readSkill } from '../dsh-plugin/index.mjs'

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
