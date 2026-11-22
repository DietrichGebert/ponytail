import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  for (const details of [false, true]) {
    test(`Hide preserves the level and other mods in ${surface} ${details ? 'details' : 'compact'} view`, async ($, on) => {
      mock.clock(on)
      mock.store(on)
      const env: Record<string, string> = surface === 'desktop'
        ? { USERPROFILE: 'C:/Users/u' }
        : { HOME: '/home/u', ...(details ? { CLAUDE_CONFIG_DIR: '/settings/claude' } : {}) }
      const flag = `${env.CLAUDE_CONFIG_DIR ?? `${env.HOME ?? env.USERPROFILE}/.claude`}/.ponytail-band`
      let hidden = false
      const writes: { path: string; text: string }[] = []
      const commands: string[] = []
      on('env.get', ($, e) => ({ value: env[e.name] }))
      on('fs.read', ($, e, next) => e.path.replaceAll('\\', '/').endsWith(flag)
        ? { value: hidden ? 'off' : '' }
        : next(e))
      on('fs.write', ($, e) => {
        writes.push({ path: e.path.replaceAll('\\', '/'), text: e.text })
        if (e.path.replaceAll('\\', '/').endsWith(flag)) hidden = e.text === 'off'
        return { value: undefined }
      })
      on('command.run', ($, e) => {
        commands.push(`${e.command} ${e.args}`)
        return { text: '' }
      })
      on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)
        return <Text>other mod</Text>
      })

      const ui = await $.ui.mount({ plugin: 'ponytail', surface, ...BAND })
      await ui.press({ key: 'level' })
      await ui.press({ key: 'level-full' })
      if (!details) await ui.press({ key: 'details' })
      commands.length = 0

      await ui.press({ key: 'hide' })
      expect(hidden).toBe(true)
      expect(writes.length).toBe(1)
      expect(writes[0]?.path.endsWith(flag)).toBe(true)
      expect(writes[0]?.text).toBe('off')
      expect(commands).toEqual([])
      expect(await ui.find({ key: 'hide' })).toBeUndefined()
      expect(await ui.find({ key: 'level' })).toBeUndefined()
      expect(await ui.find({ key: 'level-full' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /other mod/ })).toBeDefined()
      await ui.unmount()

      const persisted = await $.ui.mount({ plugin: 'ponytail', surface, ...BAND })
      expect(await persisted.find({ key: 'hide' })).toBeUndefined()
      await persisted.unmount()

      hidden = false
      const restored = await $.ui.mount({ plugin: 'ponytail', surface, ...BAND })
      expect(await restored.find({ key: 'hide' })).toBeDefined()
      if (details) expect((await restored.find({ key: 'level-full' }))?.props.variant).toBe('primary')
      else expect(await restored.find({ key: 'level', text: /full/ })).toBeDefined()
      await restored.unmount()
    })
  }
}

test('Hide leaves the band visible and reports a failed flag write', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/home/u' : undefined }))
  on('fs.write', () => ({ deny: 'read-only filesystem' }) as never)
  const toasts: unknown[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e)
    return { value: undefined }
  })
  const ui = await $.ui.mount({ plugin: 'ponytail', surface: 'terminal', ...BAND })
  await ui.press({ key: 'hide' })
  expect(await ui.find({ key: 'hide' })).toBeDefined()
  expect(toasts.length).toBe(1)
  expect(JSON.stringify(toasts)).toContain('ponytail band: could not hide the band')
  await ui.unmount()
})
