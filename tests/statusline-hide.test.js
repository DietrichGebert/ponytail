#!/usr/bin/env node
// #659 — hideStatus parity for the Claude Code statusline badge.
//
// getHideStatus() lived in the shared hooks/ponytail-config.js but only
// pi-extension read it; the native Claude/Codex statusline scripts ignored it.
// The fix: ponytail-activate.js drops a `.ponytail-hidden` marker next to the
// mode flag when hideStatus resolves truthy, and the statusline scripts bail
// when they see it. This test proves the whole round-trip via the real hook.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

// The statusline script under test is bash; skip on hosts without it rather
// than fail (Windows has its own ponytail-statusline.ps1, unit-tested elsewhere).
const bashOk = spawnSync('bash', ['-c', 'true'], { encoding: 'utf8' }).status === 0;

function activate(env) {
  return spawnSync(process.execPath, [path.join(root, 'hooks', 'ponytail-activate.js')], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}
function statusline(env) {
  return spawnSync('bash', [path.join(root, 'hooks', 'ponytail-statusline.sh')], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

// Keep the base env clean so activate takes the native-Claude branch.
for (const k of ['CLAUDE_CONFIG_DIR', 'PLUGIN_DATA', 'COPILOT_PLUGIN_DATA',
  'QODER_SESSION_ID', 'PONYTAIL_HIDE_STATUS', 'PONYTAIL_DEFAULT_MODE']) {
  delete process.env[k];
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hide-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

const home = path.join(temp, 'home');
fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
const hiddenMarker = path.join(home, '.claude', '.ponytail-hidden');
const base = { HOME: home, USERPROFILE: home };

// 1. Default: no hideStatus → no marker → badge shows.
let r = activate(base);
assert.equal(r.status, 0, r.stderr);
assert.equal(fs.existsSync(hiddenMarker), false, 'no marker when hideStatus is off');
if (bashOk) {
  assert.match(statusline(base).stdout, /PONYTAIL/, 'badge must show by default');
}

// 2. PONYTAIL_HIDE_STATUS=1 → activate writes the marker → statusline prints nothing.
r = activate({ ...base, PONYTAIL_HIDE_STATUS: '1' });
assert.equal(r.status, 0, r.stderr);
assert.equal(fs.existsSync(hiddenMarker), true, 'marker written when hideStatus is on');
if (bashOk) {
  assert.equal(statusline(base).stdout, '', 'badge must be hidden when marker is present');
}

// 3. config.hideStatus (no env var) is honored too — proves the shared resolver
//    is used, not just the env shortcut.
fs.mkdirSync(path.join(temp, 'cfg', 'ponytail'), { recursive: true });
fs.writeFileSync(path.join(temp, 'cfg', 'ponytail', 'config.json'),
  JSON.stringify({ hideStatus: true }));
r = activate({ ...base, XDG_CONFIG_HOME: path.join(temp, 'cfg') });
assert.equal(r.status, 0, r.stderr);
assert.equal(fs.existsSync(hiddenMarker), true, 'config.hideStatus must write the marker');

// 4. Toggling it back off rewrites state: marker cleared, badge returns.
r = activate(base);
assert.equal(r.status, 0, r.stderr);
assert.equal(fs.existsSync(hiddenMarker), false, 'marker cleared when hideStatus is unset');
if (bashOk) {
  assert.match(statusline(base).stdout, /PONYTAIL/, 'badge returns after unsetting hideStatus');
}

console.log('statusline-hide.test.js: OK' + (bashOk ? '' : ' (bash-dependent asserts skipped)'));
