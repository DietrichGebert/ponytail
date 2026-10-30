const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('resume preserves the live mode and emits only a reminder', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-resume-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  function run(script, env, input) {
    return spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', script)], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: '', CLAUDE_PROJECT_DIR: '',
        PLUGIN_DATA: '', COPILOT_PLUGIN_DATA: '', CURSOR_VERSION: '', CURSOR_PROJECT_DIR: '',
        CODEBUDDY_PLUGIN_ROOT: '', CODEBUDDY_CONFIG_DIR: '', PONYTAIL_MAP: '0', ...env },
      input, encoding: 'utf8',
    });
  }

  const resumeHome = path.join(temp, 'resume-home');
  const resumeFlag = path.join(resumeHome, '.claude', '.ponytail-active');
  const resumeEnv = { HOME: resumeHome, USERPROFILE: resumeHome, PONYTAIL_DEFAULT_MODE: 'full' };
  const resume = () => run('ponytail-activate.js', resumeEnv, JSON.stringify({ source: 'resume' }));

  assert.equal(resume().stdout, '', 'resume without a live mode must stay off');
  assert.equal(fs.existsSync(resumeFlag), false);
  run('ponytail-activate.js', resumeEnv, JSON.stringify({ source: 'startup' }));
  for (const mode of ['ultra', 'lite', 'full']) {
    run('ponytail-mode-tracker.js', resumeEnv, JSON.stringify({ prompt: '/ponytail ' + mode }));
    const result = resume();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'PONYTAIL MODE ACTIVE — level: ' + mode);
    assert.equal(fs.readFileSync(resumeFlag, 'utf8'), mode);
  }
  run('ponytail-mode-tracker.js', resumeEnv, JSON.stringify({ prompt: 'stop ponytail' }));
  assert.equal(resume().stdout, '', 'resume must not switch a stopped session back on');
  assert.equal(fs.existsSync(resumeFlag), false);
});
