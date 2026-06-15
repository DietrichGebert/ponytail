const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClaudeDir } = require('./ponytail-config');

const isCodex = Boolean(process.env.PLUGIN_DATA);
const isCursor = Boolean(process.env.CURSOR_PLUGIN_ROOT);
const statePath = isCodex
  ? path.join(process.env.PLUGIN_DATA, '.ponytail-active')
  : isCursor
    ? path.join(os.homedir(), '.cursor', '.ponytail-active')
  : path.join(getClaudeDir(), '.ponytail-active');

function setMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

function clearMode() {
  try { fs.unlinkSync(statePath); } catch (e) {}
}

function writeHookOutput(event, mode, context = '') {
  if (isCursor) {
    process.stdout.write(context ? JSON.stringify({ additional_context: context }) : '{}');
    return;
  }
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
  isCursor,
  setMode,
  writeHookOutput,
};
