const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClaudeDir, getConfigDir, normalizePersistedMode } = require('./ponytail-config');

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

// Mode state is kept per session whenever the host names the session, so two sessions never
// share one flag: before, a new session reset every other session's level to the default, and
// "stop ponytail" in one switched ponytail off in all of them. Hosts send the name in the hook
// payload (Claude Code `session_id`, Cursor `conversation_id`); Qoder puts it in the environment.
// A host that names no session keeps the single shared flag, exactly as before.
//
// A keyed session records "off" explicitly instead of deleting its flag, so its absence always
// means "this session has not started yet" and readers never fall back to another session's state.
function sessionKey(id) {
  const safe = String(id == null ? '' : id).replace(/[^A-Za-z0-9_-]/g, '');
  return safe.slice(0, 64) || null;
}

let currentKey = isQoder ? (sessionKey(process.env.QODER_SESSION_ID) || 'default') : null;

// Called once per hook invocation with the parsed stdin payload, if there is one.
function useSession(payload) {
  if (!payload || typeof payload !== 'object') return;
  const key = sessionKey(payload.session_id || payload.sessionId || payload.conversation_id || payload.conversationId);
  if (key) currentKey = key;
}

const legacyStatePath = path.join(stateDir, STATE_FILE);
function statePath() {
  return currentKey ? path.join(stateDir, STATE_FILE + '-' + currentKey) : legacyStatePath;
}

// Per-session files are tiny, but they should not pile up forever.
const SESSION_STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
function pruneStaleSessionState(now = Date.now()) {
  if (!currentKey) return;
  const own = statePath();
  try {
    for (const name of fs.readdirSync(stateDir)) {
      if (!name.startsWith(STATE_FILE + '-')) continue;
      const file = path.join(stateDir, name);
      if (file === own) continue;
      try {
        if (now - fs.statSync(file).mtimeMs > SESSION_STATE_MAX_AGE_MS) fs.unlinkSync(file);
      } catch (_) {}
    }
  } catch (_) {}
}

function setMode(mode) {
  const file = statePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, mode);
}

// Turning ponytail off. A keyed session records "off"; the shared flag is deleted, because
// without a session name its absence is what "off" has always meant.
function clearMode() {
  if (currentKey) {
    try { setMode('off'); } catch (e) {}
    return;
  }
  try { fs.unlinkSync(legacyStatePath); } catch (e) {}
}

function parseMode(raw) {
  const value = String(raw).trim().toLowerCase();
  if (value === 'off') return 'off';
  return normalizePersistedMode(value);
}

// Live mode: a known level, 'off' when recorded, or null when there is no flag. Anything else in
// the file is treated as no flag rather than echoed back to the user. A session started before
// state was per session has no file of its own yet and reads the shared flag it was written to.
function readMode() {
  try {
    return parseMode(fs.readFileSync(statePath(), 'utf8'));
  } catch (e) {}
  if (currentKey && !isQoder) {
    try { return parseMode(fs.readFileSync(legacyStatePath, 'utf8')); } catch (e) {}
  }
  return null;
}

// Marks this session as the one most recently active, for readers that cannot learn which
// session they belong to without waiting on stdin (the subagent hook, see #443).
function touchSession() {
  if (!currentKey) return;
  const now = new Date();
  try { fs.utimesSync(statePath(), now, now); } catch (_) {}
}

// The mode of the most recently active session: a best guess for a reader that has no payload.
// With one session it is exact; with several it is the one that last received a prompt.
function mostRecentMode() {
  let best = null;
  try {
    for (const name of fs.readdirSync(stateDir)) {
      if (name !== STATE_FILE && !name.startsWith(STATE_FILE + '-')) continue;
      const file = path.join(stateDir, name);
      try {
        const mtime = fs.statSync(file).mtimeMs;
        if (!best || mtime > best.mtime) best = { file, mtime };
      } catch (_) {}
    }
  } catch (_) {}
  if (!best) return null;
  try { return parseMode(fs.readFileSync(best.file, 'utf8')); } catch (_) { return null; }
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
  STATE_FILE,
  clearMode,
  mostRecentMode,
  pruneStaleSessionState,
  sessionKey,
  statePath,
  touchSession,
  useSession,
  cursorRuleNotice,
  cursorRulePath,
  isCodex,
  isCopilot,
  isCursor,
  isQoder,
  readMode,
  setMode,
  writeHookOutput,
};
