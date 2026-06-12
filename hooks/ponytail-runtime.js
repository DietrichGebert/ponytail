const fs = require('fs');
const path = require('path');
const os = require('os');

const isCodex = Boolean(process.env.PLUGIN_DATA);
const isOpenCode = Boolean(process.env.OPENCODE_PLUGIN_ROOT);
const statePath = isCodex
  ? path.join(process.env.PLUGIN_DATA, '.ponytail-active')
  : isOpenCode
    ? path.join(os.homedir(), '.config', 'opencode', '.ponytail-active')
    : path.join(os.homedir(), '.claude', '.ponytail-active');

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
