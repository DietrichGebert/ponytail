// Concurrent sessions each keep their own level. Before, one shared flag meant a new session reset
// every other session to the default, and "stop ponytail" in one switched it off in all of them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const hooks = path.join(__dirname, '..', 'hooks');

function sandbox(extra = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-sessions-'));
  const claude = path.join(home, '.claude');
  fs.mkdirSync(claude, { recursive: true });
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: claude,
                XDG_CONFIG_HOME: path.join(home, '.config'), PONYTAIL_DEFAULT_MODE: 'full', ...extra };
  const node = (script, input) => spawnSync(process.execPath, [path.join(hooks, script)], { env, input, encoding: 'utf8' });
  return {
    home, claude, env,
    start: sid => node('ponytail-activate.js', sid === undefined ? '' : JSON.stringify({ hook_event_name: 'SessionStart', session_id: sid })),
    prompt: (sid, text) => node('ponytail-mode-tracker.js', JSON.stringify({ session_id: sid, prompt: text })).stdout,
    subagent: (payload, env2 = {}) => spawnSync(process.execPath, [path.join(hooks, 'ponytail-subagent.js')],
      { env: { ...env, ...env2 }, input: payload ? JSON.stringify(payload) : '', encoding: 'utf8' }).stdout,
    badge: sid => spawnSync('bash', [path.join(hooks, 'ponytail-statusline.sh')],
      { env, input: sid ? JSON.stringify({ session_id: sid, model: { id: 'x' } }) : '', encoding: 'utf8' })
      .stdout.replace(/\u001b\[[0-9;]*m/g, ''),
    file: sid => path.join(claude, sid ? `.ponytail-active-${sid}` : '.ponytail-active'),
    cleanup: () => fs.rmSync(home, { recursive: true, force: true }),
  };
}

test('a second session starting does not reset the first', () => {
  const s = sandbox();
  try {
    s.start('A');
    assert.match(s.prompt('A', '/ponytail ultra'), /CHANGED — level: ultra/);
    s.start('B');
    assert.equal(fs.readFileSync(s.file('A'), 'utf8'), 'ultra');
    assert.equal(fs.readFileSync(s.file('B'), 'utf8'), 'full');
    assert.equal(s.prompt('A', '/ponytail'), 'PONYTAIL MODE ACTIVE — level: ultra');
    assert.equal(s.prompt('B', '/ponytail'), 'PONYTAIL MODE ACTIVE — level: full');
    assert.equal(fs.existsSync(s.file()), false, 'named sessions never write the shared flag');
  } finally { s.cleanup(); }
});

test('stopping ponytail in one session leaves the other running', () => {
  const s = sandbox();
  try {
    s.start('A');
    s.prompt('A', '/ponytail ultra');
    s.start('B');
    assert.equal(s.prompt('B', 'stop ponytail'), 'PONYTAIL MODE OFF');
    assert.equal(s.prompt('A', '/ponytail'), 'PONYTAIL MODE ACTIVE — level: ultra');
    assert.equal(s.prompt('B', '/ponytail'), 'PONYTAIL MODE OFF');
  } finally { s.cleanup(); }
});

test('each statusline shows its own session', { skip: process.platform === 'win32' }, () => {
  const s = sandbox();
  try {
    s.start('A');
    s.prompt('A', '/ponytail ultra');
    s.start('B');
    assert.equal(s.badge('A'), '[PONYTAIL:ULTRA]');
    assert.equal(s.badge('B'), '[PONYTAIL]');
    s.prompt('B', 'stop ponytail');
    assert.equal(s.badge('B'), '', 'an off session shows no badge');
    assert.equal(s.badge('A'), '[PONYTAIL:ULTRA]', "another session's stop must not hide this badge");
    // With no session on stdin, the most recently active session is shown.
    s.prompt('A', 'carry on');
    assert.equal(s.badge(undefined), '[PONYTAIL:ULTRA]');
  } finally { s.cleanup(); }
});

test('the subagent hook follows the session that is spawning it', () => {
  const s = sandbox();
  try {
    s.start('A');
    s.prompt('A', '/ponytail ultra');
    s.start('B');
    s.prompt('B', 'stop ponytail');
    // Default path (no stdin wait, #443): the most recently active session, B, is off.
    assert.equal(s.subagent(), '');
    // A prompts, so a subagent spawned now belongs to A.
    s.prompt('A', 'spawn a helper');
    assert.match(s.subagent(), /PONYTAIL MODE ACTIVE — level: ultra/);
    // With a matcher, stdin is read anyway and the named parent session decides exactly.
    assert.equal(s.subagent({ session_id: 'B', agent_type: 'general' }, { PONYTAIL_SUBAGENT_MATCHER: 'general' }), '');
    assert.match(s.subagent({ session_id: 'A', agent_type: 'general' }, { PONYTAIL_SUBAGENT_MATCHER: 'general' }),
      /level: ultra/);
  } finally { s.cleanup(); }
});

test('a host that names no session keeps the shared flag exactly as before', () => {
  const s = sandbox();
  try {
    s.start(undefined);
    assert.equal(fs.readFileSync(s.file(), 'utf8'), 'full');
    const tracker = spawnSync(process.execPath, [path.join(hooks, 'ponytail-mode-tracker.js')],
      { env: s.env, input: JSON.stringify({ prompt: 'stop ponytail' }), encoding: 'utf8' });
    assert.equal(tracker.stdout, 'PONYTAIL MODE OFF');
    assert.equal(fs.existsSync(s.file()), false, 'without a session name, off is still no flag');
  } finally { s.cleanup(); }
});

test('a session started before the upgrade still reads the shared flag it was given', () => {
  const s = sandbox();
  try {
    fs.writeFileSync(s.file(), 'lite');           // written by the previous version
    assert.equal(s.prompt('OLD', '/ponytail'), 'PONYTAIL MODE ACTIVE — level: lite');
  } finally { s.cleanup(); }
});

test('session state older than a week is pruned when a session starts, and its own is kept', () => {
  const s = sandbox();
  try {
    const stale = s.file('ancient');
    fs.writeFileSync(stale, 'full');
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(stale, old, old);
    const recent = s.file('yesterday');
    fs.writeFileSync(recent, 'lite');
    s.start('NOW');
    assert.equal(fs.existsSync(stale), false);
    assert.equal(fs.existsSync(recent), true);
    assert.equal(fs.readFileSync(s.file('NOW'), 'utf8'), 'full');
  } finally { s.cleanup(); }
});

test('uninstall removes every session flag it wrote', () => {
  const s = sandbox();
  try {
    s.start('A');
    s.start('B');
    fs.mkdirSync(path.join(s.home, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(s.home, '.cursor', '.ponytail-active-conv-1'), 'full');
    const out = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'uninstall.js')], { env: s.env, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.deepEqual(fs.readdirSync(s.claude).filter(n => n.startsWith('.ponytail-active')), []);
    assert.equal(fs.existsSync(path.join(s.home, '.cursor', '.ponytail-active-conv-1')), false);
  } finally { s.cleanup(); }
});

test('session start still finishes when stdin never closes (#443)', async () => {
  const s = sandbox();
  try {
    const child = spawn(process.execPath, [path.join(hooks, 'ponytail-activate.js')], { env: s.env });
    let stdout = '';
    child.stdout.on('data', d => { stdout += d; });
    const started = Date.now();
    const code = await new Promise(resolve => child.on('exit', resolve));   // stdin left open on purpose
    assert.equal(code, 0);
    assert.ok(Date.now() - started < 3000, 'must not wait on a stdin that never closes');
    assert.match(stdout, /PONYTAIL MODE ACTIVE — level: full/, 'the ruleset is still delivered in full');
  } finally { s.cleanup(); }
});
