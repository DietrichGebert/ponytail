#!/usr/bin/env node
// gavel — runtime helpers
//
// Shared utilities for hook scripts: mode persistence, output formatting,
// runtime detection (Claude Code, Codex, Copilot).

const fs = require('fs');
const path = require('path');
const os = require('os');

const isCodex = !!process.env.CODEX_PLUGIN_ROOT;
const isCopilot = !!process.env.COPILOT_AGENT_PLUGIN_ROOT;

function setMode(mode) {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const flagPath = path.join(claudeDir, '.gavel-active');
  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, mode);
}

function clearMode() {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const flagPath = path.join(claudeDir, '.gavel-active');
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

function readMode() {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const flagPath = path.join(claudeDir, '.gavel-active');
  try {
    return fs.readFileSync(flagPath, 'utf8').trim();
  } catch (e) {
    return null;
  }
}

function writeHookOutput(hookType, mode, output) {
  if (isCodex || isCopilot) {
    // Codex/Copilot hooks communicate via stdout
    if (output) process.stdout.write(output);
  } else {
    // Claude Code hooks use JSON on stdout
    const json = { hookType, mode, output };
    process.stdout.write(JSON.stringify(json));
  }
}

module.exports = {
  isCodex,
  isCopilot,
  setMode,
  clearMode,
  readMode,
  writeHookOutput,
};
