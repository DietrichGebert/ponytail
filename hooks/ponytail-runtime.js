const fs = require('fs');
const path = require('path');
const { getClaudeDir, getGrokPluginDataDir } = require('./ponytail-config');

const STATE_FILE = '.ponytail-active';
const isCopilot = Boolean(process.env.COPILOT_PLUGIN_DATA);
const isCodex = !isCopilot && Boolean(process.env.PLUGIN_DATA);
const isGrok = Boolean(process.env.GROK_PLUGIN_DATA || process.env.GROK_PLUGIN_ROOT);

let stateDir = getClaudeDir();
if (isGrok) {
  stateDir = getGrokPluginDataDir() || process.env.GROK_PLUGIN_DATA || getClaudeDir();
} else if (isCodex) {
  stateDir = process.env.PLUGIN_DATA;
} else if (isCopilot) {
  stateDir = process.env.COPILOT_PLUGIN_DATA;
}

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
  if (isGrok) {
    // Grok captures stdout from plugin hooks for annotations/scrollback.
    // Emit the ruleset on SessionStart. Skills provide the main behavior and slash commands.
    if (context) process.stdout.write(context);
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
  isGrok,
  readMode,
  setMode,
  writeHookOutput,
};
