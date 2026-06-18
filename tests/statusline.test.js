#!/usr/bin/env node
// The statusline badge must read the flag from the SAME dir the hooks write it
// to: $CLAUDE_CONFIG_DIR when set, else ~/.claude (ponytail-config.getClaudeDir).
// The scripts used to hardcode ~/.claude, so the badge vanished whenever a user
// relocated Claude's config dir (issue #34). Exercises the bash mirror; the .ps1
// mirror is left unverified here — no PowerShell on the Linux CI runner.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'hooks', 'ponytail-statusline.sh');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-statusline-'));

function runSh(env) {
  return spawnSync('bash', [script], { env: { ...process.env, ...env }, encoding: 'utf8' });
}

test('badge reads the flag under CLAUDE_CONFIG_DIR (issue #34)', (t) => {
  if (runSh({}).error) return t.skip('bash unavailable');

  const configDir = path.join(temp, 'custom-claude');
  const home = path.join(temp, 'home-empty'); // ~/.claude deliberately has no flag
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, '.ponytail-active'), 'ultra');

  const r = runSh({ CLAUDE_CONFIG_DIR: configDir, HOME: home, USERPROFILE: home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[PONYTAIL:ULTRA\]/);
});

test('badge falls back to ~/.claude when CLAUDE_CONFIG_DIR is unset', (t) => {
  if (runSh({}).error) return t.skip('bash unavailable');

  const home = path.join(temp, 'home');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', '.ponytail-active'), 'full');

  // Empty string (not unset) still triggers the bash `:-` default.
  const r = runSh({ HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: '' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[PONYTAIL\]/);
});

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
