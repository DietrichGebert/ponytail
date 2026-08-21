// dsh-ponytail adapter tests — node --test, no external deps.
//
// dsh adapter files cannot be imported here (they need @deepseek-ai/* host
// packages that upstream CI does not install), so like the hermes test this
// validates the adapter statically: the files exist, the plugin entry has the
// right shape, skills/hooks are referenced from the shared upstream dirs, and
// the adapter reuses the shared instruction builder rather than copying text.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const repo = join(root, '..')

test('adapter file layout', () => {
  for (const f of ['src/index.js', 'package.json', 'test/adapter.test.js']) {
    assert.ok(existsSync(join(root, f)), `missing dsh/${f}`)
  }
})

test('plugin entry shape (name, inject, apply, Config)', () => {
  const src = readFileSync(join(root, 'src/index.js'), 'utf8')
  assert.match(src, /export const name = 'ponytail'/)
  assert.match(src, /export const inject = \['tools', 'systemPrompt', 'skills'\]/)
  assert.match(src, /export function apply\(ctx, config/)
  assert.match(src, /export const Config = Schema\.object/)
})

test('adapter reuses the shared hooks, does not copy rule text', () => {
  const src = readFileSync(join(root, 'src/index.js'), 'utf8')
  // Points at the shared builder/config rather than embedding the ruleset.
  assert.match(src, /hooks\/ponytail-instructions\.js/)
  assert.match(src, /hooks\/ponytail-config\.js/)
  // No duplicated ladder text: the ruleset lives in skills/ponytail/SKILL.md.
  assert.ok(!/The best code is the code never written/.test(src), 'rule text copied into the adapter')
})

test('skills and hooks are referenced from the shared upstream dirs', () => {
  const src = readFileSync(join(root, 'src/index.js'), 'utf8')
  const skills = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']
  for (const s of skills) {
    assert.match(src, new RegExp(`'${s}'`))
    assert.ok(existsSync(join(repo, 'skills', s, 'SKILL.md')), `missing upstream skills/${s}/SKILL.md`)
  }
  assert.ok(existsSync(join(repo, 'hooks', 'ponytail-instructions.js')))
  assert.ok(existsSync(join(repo, 'hooks', 'ponytail-config.js')))
})

test('agent portability doc lists dsh', () => {
  const doc = readFileSync(join(repo, 'docs', 'agent-portability.md'), 'utf8')
  assert.match(doc, /\| DeepSeek Harness \|/)
})

test('README install section lists dsh', () => {
  const readme = readFileSync(join(repo, 'README.md'), 'utf8')
  assert.match(readme, /DeepSeek Harness/)
})
