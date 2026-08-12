const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClaudeDir, getConfigDir } = require('./ponytail-config');

const STATE_FILE = '.ponytail-active';
// Sidecar recording which project wrote the (machine-global) flag, so a
// concurrent session in another repo can tell the flag isn't theirs (#662).
const OWNER_FILE = '.ponytail-active.owner';

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

let stateDir = getClaudeDir();
if (isCodex) stateDir = process.env.PLUGIN_DATA;
// COPILOT_PLUGIN_DATA is unset under VS Code Copilot, so fall back to
// getClaudeDir() rather than building a path from undefined.
if (isCopilot) stateDir = process.env.COPILOT_PLUGIN_DATA || getClaudeDir();
if (isQoder) stateDir = path.join(os.homedir(), '.qoder');

const statePath = path.join(stateDir, STATE_FILE);
const ownerPath = path.join(stateDir, OWNER_FILE);

// Claude Code sets CLAUDE_PROJECT_DIR per session, so it identifies which
// concurrent session owns the shared flag (#662). Empty when unknown (non-Claude
// hosts) — callers then fall back to the legacy unscoped behavior.
function projectDir() {
  return (process.env.CLAUDE_PROJECT_DIR || '').trim();
}

function readOwner() {
  try {
    return fs.readFileSync(ownerPath, 'utf8').trim() || null;
  } catch (e) {
    return null;
  }
}

// True only when this session's project wrote the current flag. Used to WHITELIST
// injection (an explicit /ponytail opt-in in an otherwise-off repo), never to
// suppress — so two sessions sharing a configured mode never disable each other.
function ownedByCurrentProject() {
  const dir = projectDir();
  return Boolean(dir) && readOwner() === dir;
}

function setMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
  // Attribute the flag to this project. Unknown project → drop any stale owner so
  // the flag stays unscoped (legacy behavior) rather than falsely attributed.
  const dir = projectDir();
  try {
    if (dir) fs.writeFileSync(ownerPath, dir);
    else fs.unlinkSync(ownerPath);
  } catch (e) {}
}

function clearMode() {
  // Never delete a flag owned by another concurrent session's repo — that would
  // yank ponytail out from under it mid-session (#662). Unknown project (or no
  // recorded owner) falls back to the legacy unconditional clear.
  const dir = projectDir();
  const owner = readOwner();
  if (owner && dir && owner !== dir) return;
  try { fs.unlinkSync(statePath); } catch (e) {}
  try { fs.unlinkSync(ownerPath); } catch (e) {}
}

// Live mode written by activate/mode-tracker. Absent flag = ponytail off.
function readMode() {
  try {
    return fs.readFileSync(statePath, 'utf8').trim() || null;
  } catch (e) {
    return null;
  }
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
  isCodex,
  isCopilot,
  isQoder,
  ownedByCurrentProject,
  readMode,
  setMode,
  writeHookOutput,
};
