const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hook-utf8-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: dir, PONYTAIL_DEFAULT_MODE: 'lite', PONYTAIL_MAP: '0' };
  for (const key of ['CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT', 'PLUGIN_DATA', 'COPILOT_PLUGIN_DATA', 'QODER_SESSION_ID', 'CURSOR_VERSION', 'CURSOR_PROJECT_DIR', 'CODEBUDDY_PLUGIN_ROOT', 'CODEBUDDY_CONFIG_DIR', 'PONYTAIL_SUBAGENT_MATCHER']) delete env[key];
  return { dir, env, flag: path.join(dir, '.ponytail-active') };
}

// Real hook subprocesses receive a Node byte stream with deterministic chunk boundaries.
// One-byte chunks also split every multibyte character without relying on pipe timing.
function run(script, payload, env, bom = false) {
  const bytes = Buffer.from((bom ? '\uFEFF' : '') + JSON.stringify(payload));
  const entry = path.join(__dirname, '..', 'hooks', script);
  const source = `
    const { Readable } = require('node:stream');
    const chunks = ${JSON.stringify([...bytes])}.map(byte => Buffer.from([byte]));
    Object.defineProperty(process, 'stdin', { value: Readable.from(chunks, { objectMode: false }) });
    require(${JSON.stringify(entry)});
  `;
  const result = spawnSync(process.execPath, ['-e', source], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result.stdout;
}

test('compaction keeps its live level when the BOM is split between stdin chunks', t => {
  const { env, flag } = fixture(t);
  fs.writeFileSync(flag, 'ultra');
  const stdout = run('ponytail-activate.js', { source: 'compact' }, env, true);
  assert.equal(fs.readFileSync(flag, 'utf8'), 'ultra');
  assert.match(stdout, /level: ultra/i);
});

test('mode commands still parse a BOM split between stdin chunks', t => {
  const { env, flag } = fixture(t);
  fs.writeFileSync(flag, 'full');
  const stdout = run('ponytail-mode-tracker.js', { prompt: '/ponytail ultra' }, env, true);
  assert.equal(fs.readFileSync(flag, 'utf8'), 'ultra');
  assert.match(stdout, /level: ultra/i);
});

for (const [agentType, matches] of [['révision-🧪', true], ['different-agent', false]]) {
  test(`subagent matching keeps split UTF-8 intact: ${agentType}`, t => {
    const { env, flag } = fixture(t);
    fs.writeFileSync(flag, 'ultra');
    env.PONYTAIL_SUBAGENT_MATCHER = '^révision-🧪$';
    const stdout = run('ponytail-subagent.js', { agent_type: agentType }, env);
    if (matches) {
      const output = JSON.parse(stdout);
      assert.match(output.hookSpecificOutput.additionalContext, /level: ultra/i);
    } else assert.equal(stdout, '');
  });
}
