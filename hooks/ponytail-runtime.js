const fs = require('fs');
const path = require('path');
const { getClaudeDir, getFactoryDir } = require('./ponytail-config');

const STATE_FILE = '.ponytail-active';
const isCopilot = Boolean(process.env.COPILOT_PLUGIN_DATA);
const isCodex = !isCopilot && Boolean(process.env.PLUGIN_DATA);
// Factory Droid: hooks/factory-hooks.json sets PONYTAIL_HOST=factory, and Factory
// exports DROID_PLUGIN_ROOT to plugin hook processes. Either signal selects the
// Factory branch (state under ~/.factory, hookSpecificOutput JSON output).
const isFactory =
  !isCopilot &&
  !isCodex &&
  (process.env.PONYTAIL_HOST === 'factory' || Boolean(process.env.DROID_PLUGIN_ROOT));

let stateDir = getClaudeDir();
if (isCodex) stateDir = process.env.PLUGIN_DATA;
if (isCopilot) stateDir = process.env.COPILOT_PLUGIN_DATA;
if (isFactory) stateDir = getFactoryDir();

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
  if (isFactory) {
    // Factory Droid: same hookSpecificOutput.additionalContext shape as Codex,
    // minus the systemMessage badge — Factory surfaces systemMessage as a
    // per-session warning, noisier than Codex's status badge. The active mode
    // is already in the injected ruleset header.
    const output = {};
    if (context) {
      output.hookSpecificOutput = { hookEventName: event, additionalContext: context };
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
  isFactory,
  readMode,
  setMode,
  writeHookOutput,
};
