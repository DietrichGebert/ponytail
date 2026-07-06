const fs = require('fs');
const path = require('path');
const { getClaudeDir } = require('./ponytail-config');

const STATE_FILE = '.ponytail-active';

// VS Code Copilot's agent-plugin host never sets COPILOT_PLUGIN_DATA — it only
// injects CLAUDE_PLUGIN_ROOT, pointed at its own install dir under
// <home>/.vscode/agent-plugins/... . Without this fallback, ponytail mistakes
// it for native Claude Code (issue #528): wrong hook output shape, and a
// statusLine setup nudge for a settings.json VS Code Copilot never reads.
function looksLikeVSCodeCopilotPluginRoot(pluginRoot) {
  if (!pluginRoot) return false;
  const segments = pluginRoot.split(/[\\/]+/);
  return segments.includes('agent-plugins') &&
    segments.some((s) => s.toLowerCase() === '.vscode');
}

const isCopilot = Boolean(process.env.COPILOT_PLUGIN_DATA) ||
  looksLikeVSCodeCopilotPluginRoot(process.env.CLAUDE_PLUGIN_ROOT);
const isCodex = !isCopilot && Boolean(process.env.PLUGIN_DATA);

let stateDir = getClaudeDir();
if (isCodex) stateDir = process.env.PLUGIN_DATA;
// Only redirect state into COPILOT_PLUGIN_DATA when it's actually set — the
// VS Code Copilot fallback above detects Copilot without it being present.
if (process.env.COPILOT_PLUGIN_DATA) stateDir = process.env.COPILOT_PLUGIN_DATA;

const statePath = path.join(stateDir, STATE_FILE);

function setMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

function clearMode() {
  try { fs.unlinkSync(statePath); } catch (e) {}
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
  readMode,
  setMode,
  writeHookOutput,
};
