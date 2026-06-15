const fs = require('fs');
const path = require('path');
const { getClaudeDir } = require('./ponytail-config');

const pluginDataDir = process.env.COPILOT_PLUGIN_DATA || process.env.PLUGIN_DATA;
const isCodex = Boolean(pluginDataDir);
const statePath = isCodex
  ? path.join(pluginDataDir, '.ponytail-active')
  : path.join(getClaudeDir(), '.ponytail-active');

function setMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

function clearMode() {
  try { fs.unlinkSync(statePath); } catch (e) {}
}

function writeHookOutput(event, mode, context = '') {
  if (!isCodex) {
    process.stdout.write(context);
    return;
  }
  const output = { systemMessage: `PONYTAIL:${mode.toUpperCase()}` };
  if (context) {
    output.hookSpecificOutput = {
      hookEventName: event,
      additionalContext: context,
    };
  }
  process.stdout.write(JSON.stringify(output));
}

module.exports = {
  clearMode,
  isCodex,
  setMode,
  writeHookOutput,
};
