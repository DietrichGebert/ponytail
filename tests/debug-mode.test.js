const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const { normalizeMode } = require('../hooks/ponytail-config');
const { getPonytailInstructions, getFallbackInstructions } = require('../hooks/ponytail-instructions');

test('debug selects the debugging workflow rather than the ordinary intensity ladder', () => {
  assert.equal(normalizeMode('debug'), 'debug');
  for (const build of [getPonytailInstructions, getFallbackInstructions]) {
    const instructions = build('debug');
    assert.match(instructions, /level: debug/);
    assert.match(instructions, /reproduc/i);
    assert.match(instructions, /root cause/i);
    assert.match(instructions, /security/i);
    assert.doesNotMatch(instructions, /Behavior defined by/);
  }
});

test('debug environment and mode switch deliver the workflow through real hooks', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-debug-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const env = {
    ...process.env,
    XDG_CONFIG_HOME: temp,
    CLAUDE_CONFIG_DIR: temp,
    PLUGIN_DATA: temp,
    COPILOT_PLUGIN_DATA: '',
    CLAUDE_PLUGIN_ROOT: '',
    PONYTAIL_MODE: 'debug',
    PONYTAIL_DEFAULT_MODE: 'full',
  };
  const run = (script, input = {}) => {
    const result = spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
      env, input: JSON.stringify(input), encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const startup = run('ponytail-activate.js');
  assert.match(startup.hookSpecificOutput.additionalContext, /level: debug/);
  assert.match(startup.hookSpecificOutput.additionalContext, /reproduc/i);
  delete env.PONYTAIL_MODE;
  run('ponytail-mode-tracker.js', { prompt: '/ponytail full' });
  const switched = run('ponytail-mode-tracker.js', { prompt: '/ponytail debug' });
  assert.match(switched.hookSpecificOutput.additionalContext, /root cause/i);
  assert.equal(fs.readFileSync(path.join(temp, '.ponytail-active'), 'utf8'), 'debug');
  const child = run('ponytail-subagent.js');
  assert.match(child.hookSpecificOutput.additionalContext, /reproduc/i);
  run('ponytail-mode-tracker.js', { prompt: '/ponytail off' });
  assert.equal(fs.existsSync(path.join(temp, '.ponytail-active')), false);
});
