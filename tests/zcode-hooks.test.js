const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// A missing ZCode adapter currently emits no usable context and shares Claude state.
test('ZCode hooks deliver JSON, retain compacted modes and isolate same-repo sessions', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-zcode-'));
  try {
    const plugin = path.resolve(__dirname, '..');
    const env = { ...process.env, HOME: home, USERPROFILE: home,
      XDG_CONFIG_HOME: path.join(home, 'unrelated-config'),
      ZCODE_PLUGIN_ROOT: plugin, ZCODE_PLUGIN_DATA: path.join(home, 'zcode-data'),
      PONYTAIL_DEFAULT_MODE: 'full', PONYTAIL_MAP: '0' };
    const invoke = (event, session, fields = {}) => {
      const result = spawnSync(process.execPath, [path.join(plugin, 'hooks/zcode-hook.js')], {
        env, input: JSON.stringify({ hook_event_name: event, session_id: session, cwd: '/same/repo', ...fields }), encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      if (!result.stdout.trim()) return '';
      const output = JSON.parse(result.stdout);
      assert.equal(output.hookSpecificOutput.hookEventName, event);
      return output.hookSpecificOutput.additionalContext;
    };
    assert.match(invoke('SessionStart', 'a', { source: 'startup' }), /level: full/);
    assert.match(invoke('UserPromptSubmit', 'a', { prompt: '/ponytail ultra' }), /level: ultra/);
    assert.equal(invoke('UserPromptSubmit', 'a', { prompt: 'ordinary request' }), '');
    assert.match(invoke('SessionStart', 'a', { source: 'compact' }), /level: ultra/);
    assert.match(invoke('SessionStart', 'b', { source: 'startup' }), /level: full/);
    assert.match(invoke('SessionStart', 'a', { source: 'compact' }), /level: ultra/);
    assert.match(invoke('UserPromptSubmit', 'a', { prompt: 'stop ponytail' }), /MODE OFF/);
    assert.equal(invoke('SessionStart', 'a', { source: 'compact' }), '');
    assert.match(invoke('UserPromptSubmit', 'b', { prompt: '/ponytail default lite' }), /DEFAULT SET/);
    delete env.PONYTAIL_DEFAULT_MODE;
    assert.match(invoke('SessionStart', 'c', { source: 'startup' }), /level: lite/);
    assert.equal(fs.existsSync(path.join(home, '.claude/.ponytail-active')), false);
    assert.equal(fs.existsSync(path.join(home, 'unrelated-config/ponytail/config.json')), false);
    assert.match(invoke('SessionStart', '../../escape', { source: 'startup' }), /level: lite/);
    assert.equal(fs.existsSync(path.join(home, 'escape')), false);
    for (const input of ['secret123', '{', JSON.stringify({ hook_event_name: 'SessionStart' }), JSON.stringify({ hook_event_name: 'Stop', session_id: 'a' })]) {
      const r = spawnSync(process.execPath, [path.join(plugin, 'hooks/zcode-hook.js')], { env, input, encoding: 'utf8' });
      assert.notEqual(r.status, 0);
      assert.equal(r.stdout, '');
      assert.equal(r.stderr.includes('secret123'), false, 'malformed input must not be logged');
    }
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
