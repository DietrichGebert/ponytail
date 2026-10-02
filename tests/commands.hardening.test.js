// Mode commands that are mistyped, and a flag file with unexpected contents.
// Each case used to succeed silently or echo the file back to the user.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hooks = path.join(__dirname, '..', 'hooks');

function sandbox() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-cmd-'));
  const claude = path.join(home, '.claude');
  fs.mkdirSync(claude, { recursive: true });
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: claude,
                XDG_CONFIG_HOME: path.join(home, '.config') };
  const flag = path.join(claude, '.ponytail-active');
  // Prompts below name session "s", whose level is kept in its own file.
  const sessionFlag = path.join(claude, '.ponytail-active-s');
  const run = (script, input = '') => spawnSync(process.execPath, [path.join(hooks, script)], { env, input, encoding: 'utf8' });
  const prompt = text => run('ponytail-mode-tracker.js', JSON.stringify({ session_id: 's', prompt: text })).stdout;
  return { home, env, flag, sessionFlag, run, prompt, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

test('a mistyped level leaves the mode alone and says what was expected', () => {
  const s = sandbox();
  try {
    s.run('ponytail-activate.js');
    s.prompt('/ponytail ultra');
    const out = s.prompt('/ponytail lit');
    assert.match(out, /NOT CHANGED — 'lit' is not a level/);
    assert.match(out, /Current level: ultra/);
    assert.equal(fs.readFileSync(s.sessionFlag, 'utf8'), 'ultra', 'a typo must not reset the level to the default');
  } finally { s.cleanup(); }
});

test('an invalid or missing default is reported and nothing is written', () => {
  const s = sandbox();
  try {
    const config = path.join(s.env.XDG_CONFIG_HOME, 'ponytail', 'config.json');
    assert.match(s.prompt('/ponytail default review'), /DEFAULT NOT CHANGED — 'review' is not a level/);
    assert.match(s.prompt('/ponytail default'), /DEFAULT NOT CHANGED — no level given/);
    assert.equal(fs.existsSync(config), false);
    // The valid form still works.
    assert.match(s.prompt('/ponytail default lite'), /DEFAULT SET — new sessions start in lite/);
    assert.equal(JSON.parse(fs.readFileSync(config, 'utf8')).defaultMode, 'lite');
  } finally { s.cleanup(); }
});

test('asking for the level while ponytail is off says off, not the default', () => {
  const s = sandbox();
  try {
    s.run('ponytail-activate.js');
    s.prompt('stop ponytail');
    assert.equal(s.prompt('/ponytail'), 'PONYTAIL MODE OFF');
  } finally { s.cleanup(); }
});

test('a flag with unexpected contents is never echoed back', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(s.flag, 'banana');
    assert.doesNotMatch(s.prompt('/ponytail'), /banana/i);
    if (process.platform !== 'win32') {
      const badge = spawnSync('bash', [path.join(hooks, 'ponytail-statusline.sh')], { env: s.env, encoding: 'utf8' }).stdout;
      assert.equal(badge, '', 'the statusline prints nothing for an unknown level');
      // A control sequence in the file must not reach the terminal either.
      fs.writeFileSync(s.flag, '\u001b]0;pwned\u0007');
      const hostile = spawnSync('bash', [path.join(hooks, 'ponytail-statusline.sh')], { env: s.env, encoding: 'utf8' }).stdout;
      assert.equal(hostile, '');
      fs.writeFileSync(s.flag, 'ultra');
      const ok = spawnSync('bash', [path.join(hooks, 'ponytail-statusline.sh')], { env: s.env, encoding: 'utf8' }).stdout;
      assert.match(ok, /\[PONYTAIL:ULTRA\]/);
    }
  } finally { s.cleanup(); }
});
