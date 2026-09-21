const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('statusline reads the mode for its own session', (t) => {
  if (process.platform === 'win32') return t.skip('POSIX statusline');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-statusline-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const state = path.join(home, '.claude', '.ponytail-active');
  fs.mkdirSync(state, { recursive: true });
  const key = crypto.createHash('sha256').update('session-a').digest('hex');
  fs.writeFileSync(path.join(state, key), 'ultra');

  const result = spawnSync('bash', [path.join(__dirname, '..', 'hooks', 'ponytail-statusline.sh')], {
    env: { ...process.env, HOME: home },
    input: JSON.stringify({ session_id: 'session-a' }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PONYTAIL:ULTRA/);
});
