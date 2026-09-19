const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClaudeDir, getConfigDir } = require('./ponytail-config');

const STATE_FILE = '.ponytail-active';

// ponytail: VS Code Copilot never sets COPILOT_PLUGIN_DATA — it only injects
// CLAUDE_PLUGIN_ROOT, pointed at an install path under .vscode/agent-plugins/
// (#528). Without this fallback isCopilot was false, so ponytail assumed
// native Claude Code and emitted the statusline nudge, which VS Code Copilot
// doesn't read.
function isVsCodeCopilotRoot(pluginRoot) {
  if (!pluginRoot) return false;
  return pluginRoot.split(/[\\/]+/).includes('agent-plugins') &&
    pluginRoot.toLowerCase().includes('.vscode');
}

const isCopilot = Boolean(process.env.COPILOT_PLUGIN_DATA) ||
  isVsCodeCopilotRoot(process.env.CLAUDE_PLUGIN_ROOT);
const isCodex = !isCopilot && Boolean(process.env.PLUGIN_DATA);
const isQoder = !isCopilot && !isCodex && Boolean(process.env.QODER_SESSION_ID);
// Cursor (#817): CURSOR_VERSION is set only in the environment Cursor builds
// for hook processes (Cursor 3.20.17 assigns it in exactly one place, the hook
// env builder), so it never leaks into a Claude Code session running inside
// Cursor's terminal. Cursor also sets it when it runs a Claude-format plugin's
// hooks next to CLAUDE_PLUGIN_ROOT, and it needs Cursor-shaped JSON either
// way, so this check comes after the hosts with their own data dirs.
const isCursor = !isCopilot && !isCodex && !isQoder && Boolean(process.env.CURSOR_VERSION);

let stateDir = getClaudeDir();
if (isCodex) stateDir = process.env.PLUGIN_DATA;
// COPILOT_PLUGIN_DATA is unset under VS Code Copilot, so fall back to
// getClaudeDir() rather than building a path from undefined.
if (isCopilot) stateDir = process.env.COPILOT_PLUGIN_DATA || getClaudeDir();
if (isQoder) stateDir = path.join(os.homedir(), '.qoder');
if (isCursor) stateDir = path.join(os.homedir(), '.cursor');

const statePath = path.join(stateDir, STATE_FILE);
// One file per host session, so concurrent sessions stop overwriting each
// other's mode (#662, #809). The statusline scripts read the same layout.
const sessionsDir = path.join(stateDir, '.ponytail-sessions');
// ponytail: stale session files are pruned by age when a new session starts;
// a session idle for longer falls back to the legacy flag. Track session end if
// that ever bites.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The host's id for this session: session_id (Claude Code, Codex, Qoder),
// conversation_id (Cursor), or QODER_SESSION_ID. It becomes a file name, so
// only [A-Za-z0-9_-] survives and no payload can point outside sessionsDir.
function sessionIdFrom(data) {
  const raw = (data && (data.session_id || data.conversation_id)) || process.env.QODER_SESSION_ID || '';
  return String(raw).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128) || null;
}

function readFlag(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim() || null;
  } catch (e) {
    return null;
  }
}

function pruneSessions(keep) {
  try {
    const now = Date.now();
    for (const name of fs.readdirSync(sessionsDir)) {
      if (name === keep) continue;
      const file = path.join(sessionsDir, name);
      try { if (now - fs.statSync(file).mtimeMs > SESSION_TTL_MS) fs.unlinkSync(file); } catch (e) {}
    }
  } catch (e) {}
}

function writeSessionMode(sessionId, mode) {
  const file = path.join(sessionsDir, sessionId);
  const isNew = !fs.existsSync(file);
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(file, mode);
  if (isNew) pruneSessions(sessionId);
}

// ponytail: the legacy flag keeps its old last-write-wins meaning for readers
// that can't see a session id (statusline commands pinned to an older plugin
// version, hosts that send no id). Drop the mirror once those are gone.
function setMode(mode, sessionId) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
  if (sessionId) writeSessionMode(sessionId, mode);
}

// A session records 'off' explicitly: a missing session file means "not
// keyed yet" and falls back to the legacy flag, which another session may own.
function clearMode(sessionId) {
  try { fs.unlinkSync(statePath); } catch (e) {}
  if (sessionId) writeSessionMode(sessionId, 'off');
}

// Live mode written by activate/mode-tracker. Absent flag or 'off' = ponytail
// off. With a session id, that session's own file wins; fallback: false skips
// the legacy flag, for callers that need to know the session is new.
function readMode(sessionId, { fallback = true } = {}) {
  if (sessionId) {
    const mode = readFlag(path.join(sessionsDir, sessionId));
    if (mode || !fallback) return mode;
  }
  return readFlag(statePath);
}

// Hook payloads arrive as JSON on stdin; onInput gets the parsed object, or
// null when nothing parseable arrived. Never hang the session: on Windows the
// PowerShell `if {}` wrapper can swallow the piped JSON so 'end' never fires
// (#443). On error, or after a short fallback, process whatever arrived and
// exit. unref() keeps the timer off the normal path, where 'end' fires first.
function readHookInput(onInput) {
  let input = '';
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    let data = null;
    try {
      // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
      data = JSON.parse(input.replace(/^\uFEFF/, ''));
    } catch (e) {}
    onInput(data);
  };
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', finish);
  process.stdin.on('error', () => { finish(); process.exit(0); });
  setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
}

// Cursor's always-on project rule (.cursor/rules/ponytail.mdc) already puts the
// ruleset in front of every prompt and no hook can switch a rule off, so while
// it is in the workspace the hooks step back instead of injecting a second,
// possibly contradicting, copy (#817). Cursor hands every hook the workspace
// root as CURSOR_PROJECT_DIR; project hooks also run from that directory.
// ponytail: first workspace root only, a rule in a secondary folder of a
// multi-root workspace goes undetected.
function cursorRulePath() {
  const root = process.env.CURSOR_PROJECT_DIR || process.cwd();
  const rule = path.join(root, '.cursor', 'rules', 'ponytail.mdc');
  return fs.existsSync(rule) ? rule : null;
}

function cursorRuleNotice(rule) {
  return 'PONYTAIL: the always-on Cursor rule ' + rule + ' is active in this workspace and ' +
    'already carries the ponytail ruleset, so the ponytail hooks injected nothing further. ' +
    'Mode switching (/ponytail lite|full|ultra|off, "stop ponytail") is unavailable while ' +
    'that rule exists. When the user tries to switch or turn off ponytail, tell them to ' +
    'delete that rule so hooks.json can manage the level.';
}

function writeHookOutput(event, mode, context = '') {
  if (isCopilot) {
    // Copilot reads additionalContext on SessionStart; ignores output elsewhere.
    process.stdout.write(JSON.stringify(
      event === 'SessionStart' && context ? { additionalContext: context } : {}));
    return;
  }
  if (isCodex) {
    const output = { systemMessage: `PONYTAIL:${mode.toUpperCase()}` };
    if (context) {
      output.hookSpecificOutput = {
        hookEventName: event,
        additionalContext: context,
      };
    }
    process.stdout.write(JSON.stringify(output));
    return;
  }
  if (isQoder) {
    // Qoder: hookSpecificOutput JSON, same shape as Codex minus systemMessage.
    // UserPromptSubmit additionalContext is injected into the Agent's conversation.
    const output = {};
    if (context) {
      output.hookSpecificOutput = {
        hookEventName: event,
        additionalContext: context,
      };
    }
    process.stdout.write(JSON.stringify(output));
    return;
  }
  if (isCursor) {
    // Cursor parses stdout as JSON and treats empty stdout as "nothing to
    // say"; raw text would be logged as a parse error. sessionStart takes
    // additional_context into the conversation's system context;
    // beforeSubmitPrompt needs continue:true and, in Cursor 3.20.17, injects
    // additional_context into that turn (docs/cursor-hooks.md).
    if (!context) return;
    const output = { additional_context: context };
    if (event === 'UserPromptSubmit') output.continue = true;
    process.stdout.write(JSON.stringify(output));
    return;
  }
  // Native Claude: SessionStart accepts raw stdout, but SubagentStart needs the
  // hookSpecificOutput JSON form or the context is dropped.
  if (event === 'SubagentStart') {
    process.stdout.write(JSON.stringify(
      { hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
    return;
  }
  process.stdout.write(context);
}

module.exports = {
  clearMode,
  cursorRuleNotice,
  cursorRulePath,
  isCodex,
  isCopilot,
  isCursor,
  isQoder,
  readHookInput,
  readMode,
  sessionIdFrom,
  setMode,
  writeHookOutput,
};
