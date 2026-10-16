#!/usr/bin/env node
// ZCode needs JSON context and session-local state; reuse the existing hook logic.
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');

try {
  const raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
  let input;
  try { input = JSON.parse(raw); } catch (_) { throw new Error('Expected JSON hook input'); }
  const scripts = { SessionStart: 'ponytail-activate.js', UserPromptSubmit: 'ponytail-mode-tracker.js' };
  const script = scripts[input.hook_event_name];
  if (!script || typeof input.session_id !== 'string' || !input.session_id.trim()) {
    throw new Error('Expected a supported hook event and a nonempty session_id');
  }
  const data = process.env.ZCODE_PLUGIN_DATA;
  if (!data || !path.isAbsolute(data)) throw new Error('ZCODE_PLUGIN_DATA must be an absolute path');
  const session = createHash('sha256').update(input.session_id).digest('hex');
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    input: raw, encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024,
    env: { ...process.env,
      // PLUGIN_DATA selects the shared JSON-output branch only in this child.
      PLUGIN_DATA: path.join(data, 'sessions', session),
      COPILOT_PLUGIN_DATA: '',
      CLAUDE_PLUGIN_ROOT: path.resolve(__dirname, '..'),
      CLAUDE_PROJECT_DIR: '',
      XDG_CONFIG_HOME: path.join(data, 'config'),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Ponytail hook exited with ${result.status}`);
  if (result.stdout.trim()) JSON.parse(result.stdout);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
} catch (error) {
  process.stderr.write(`Ponytail ZCode hook: ${error.message}\n`);
  process.exitCode = 1;
}
