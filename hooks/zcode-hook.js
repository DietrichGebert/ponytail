#!/usr/bin/env node
// ZCode needs JSON context and session-local state; reuse the existing hook logic.
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');
const os = require('os');
const { getPonytailInstructions } = require('./ponytail-instructions');

// Read only a completed boundary for this session, never conversation text.
function completedBoundary(sessionId) {
  const file = path.join(os.homedir(), '.zcode', 'cli', 'db', 'db.sqlite');
  if (!fs.existsSync(file)) return '';
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout = 1000');
    const row = db.prepare(`
      SELECT json_extract(p.data, '$.compactBoundary.boundaryId') AS boundary
      FROM part p JOIN message m
        ON m.id = json_extract(p.data, '$.compactBoundary.summaryMessageIds[0]')
       AND m.session_id = p.session_id
      WHERE p.session_id = ?
        AND json_extract(p.data, '$.type') = 'compaction'
        AND json_type(p.data, '$.compactBoundary.boundaryId') = 'text'
        AND json_type(m.data, '$.summary') = 'object'
        AND length(json_extract(m.data, '$.summary.body')) > 0
      ORDER BY p.sequence DESC, p.time_created DESC, p.id DESC LIMIT 1
    `).get(sessionId);
    return row?.boundary || '';
  } finally { db.close(); }
}

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
  const state = path.join(data, 'sessions', session);
  const checkpoint = path.join(state, 'context-boundary');
  const boundary = completedBoundary(input.session_id);
  const previous = fs.existsSync(checkpoint) ? fs.readFileSync(checkpoint, 'utf8').trim() : null;
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    input: raw, encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024,
    env: { ...process.env,
      // PLUGIN_DATA selects the shared JSON-output branch only in this child.
      PLUGIN_DATA: state,
      COPILOT_PLUGIN_DATA: '',
      CLAUDE_PLUGIN_ROOT: path.resolve(__dirname, '..'),
      CLAUDE_PROJECT_DIR: '',
      XDG_CONFIG_HOME: path.join(data, 'config'),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Ponytail hook exited with ${result.status}`);
  const output = result.stdout.trim() ? JSON.parse(result.stdout) : {};
  const flag = path.join(state, '.ponytail-active');
  const mode = fs.existsSync(flag) ? fs.readFileSync(flag, 'utf8').trim() : 'off';
  const rules = mode !== 'off' ? getPonytailInstructions(mode) : '';
  let context = output.hookSpecificOutput?.additionalContext || '';
  let injected = !!rules && context.includes(rules);
  if (input.hook_event_name === 'UserPromptSubmit' && boundary && boundary !== previous && rules && !injected) {
    context += (context ? '\n\n' : '') + 'PONYTAIL CONTEXT RESTORED AFTER COMPACTION\n\n' + rules;
    output.hookSpecificOutput = { hookEventName: input.hook_event_name, additionalContext: context };
    injected = true;
  }
  if ((input.hook_event_name === 'SessionStart' || injected || !rules) && boundary !== previous) {
    fs.mkdirSync(state, { recursive: true });
    const temporary = checkpoint + '.' + process.pid + '.tmp';
    fs.writeFileSync(temporary, boundary + '\n');
    fs.renameSync(temporary, checkpoint);
  }
  if (Object.keys(output).length) process.stdout.write(JSON.stringify(output));
  process.stderr.write(result.stderr);
} catch (error) {
  process.stderr.write(`Ponytail ZCode hook: ${error.message}\n`);
  process.exitCode = 1;
}
