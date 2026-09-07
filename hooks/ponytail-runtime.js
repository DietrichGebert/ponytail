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
// Kimi Code is detected two ways: KIMI_CODE_HOME in the hook's environment,
// or the client_type field every hook payload carries ("kimi_code_cli") —
// the payload is the reliable signal, so mode-tracker reports it back through
// setKimiFromClientType and isKimi can flip true after module load.
// https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html
let isKimi = Boolean(process.env.KIMI_CODE_HOME);

function getKimiDir() {
  return process.env.KIMI_CODE_HOME || path.join(os.homedir(), '.kimi-code');
}

// Called from the UserPromptSubmit hook with the payload's client_type.
// Returns the current isKimi so callers see the post-flip value.
function setKimiFromClientType(clientType) {
  if (clientType === 'kimi_code_cli') isKimi = true;
  return isKimi;
}

let stateDir = getClaudeDir();
if (isCodex) stateDir = process.env.PLUGIN_DATA;
// COPILOT_PLUGIN_DATA is unset under VS Code Copilot, so fall back to
// getClaudeDir() rather than building a path from undefined.
if (isCopilot) stateDir = process.env.COPILOT_PLUGIN_DATA || getClaudeDir();
if (isQoder) stateDir = path.join(os.homedir(), '.qoder');
if (isKimi) stateDir = getKimiDir();

const statePath = path.join(stateDir, STATE_FILE);

// statePath is frozen at load for the env-detected hosts; Kimi can turn isKimi
// on at runtime, so its flag path resolves lazily off the live value.
function getStatePath() {
  return isKimi ? path.join(getKimiDir(), STATE_FILE) : statePath;
}

function setMode(mode) {
  const flag = getStatePath();
  fs.mkdirSync(path.dirname(flag), { recursive: true });
  fs.writeFileSync(flag, mode);
}

function clearMode() {
  try { fs.unlinkSync(getStatePath()); } catch (e) {}
}

// Live mode written by activate/mode-tracker. Absent flag = ponytail off.
function readMode() {
  try {
    return fs.readFileSync(getStatePath(), 'utf8').trim() || null;
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
  if (isKimi) {
    // Kimi Code has no hookSpecificOutput JSON form — plain stdout is the
    // whole protocol. UserPromptSubmit stdout is appended to the model
    // context on exit 0; PreToolUse stdout is discarded (kimi 0.38–0.40.1).
    process.stdout.write(context);
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
  readMode,
  setKimiFromClientType,
  setMode,
  writeHookOutput,
  // Getter, not a snapshot: setKimiFromClientType can flip isKimi after load,
  // and consumers destructuring a plain boolean would keep the stale value.
  get isKimi() { return isKimi; },
};
