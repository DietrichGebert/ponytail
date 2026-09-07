#!/usr/bin/env node
// Smoke test for the Kiro adapter: verify the hooks template and steering rule
// are present and wired to the shared scripts.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('kiro hooks template uses Kiro v1 schema and wires the shared scripts', () => {
  const config = readJSON('hooks/kiro-hooks.json');
  assert.equal(config.version, 'v1');
  assert.ok(Array.isArray(config.hooks), 'hooks must be an array');

  const byTrigger = Object.fromEntries(config.hooks.map(h => [h.trigger, h]));

  // SessionStart activates + injects the ruleset.
  assert.ok(byTrigger.SessionStart, 'must register a SessionStart hook');
  assert.match(byTrigger.SessionStart.action.command, /ponytail-activate\.js/);

  // UserPromptSubmit tracks /ponytail level switches.
  assert.ok(byTrigger.UserPromptSubmit, 'must register a UserPromptSubmit hook');
  assert.match(byTrigger.UserPromptSubmit.action.command, /ponytail-mode-tracker\.js/);

  // No subagent hook: Kiro has no SubagentStart, and a PreToolUse hook's stdout
  // is ignored on exit 0, so it cannot inject the ruleset into a sub-agent.
  assert.ok(!byTrigger.PreToolUse, 'must not register a PreToolUse subagent hook (Kiro ignores its stdout on exit 0)');

  // Every hook must be a command action, declare the Kiro host, and reference
  // the PONYTAIL_DIR placeholder users replace with their checkout path.
  for (const h of config.hooks) {
    assert.equal(h.action.type, 'command', `${h.name} must be a command action`);
    assert.match(h.action.command, /--host=kiro\b/, `${h.name} must pass --host=kiro`);
    assert.match(h.action.command, /PONYTAIL_DIR/, `${h.name} must use the PONYTAIL_DIR placeholder`);
  }
});

test('kiro steering rule exists, is non-empty, and carries the ponytail identity', () => {
  const rulePath = path.join(root, '.kiro', 'steering', 'ponytail.md');
  assert.ok(fs.existsSync(rulePath), '.kiro/steering/ponytail.md must exist');
  const content = fs.readFileSync(rulePath, 'utf8').trim();
  assert.ok(content.length > 0, '.kiro/steering/ponytail.md must not be empty');
  assert.ok(content.includes('lazy senior developer'), 'rule must contain the ponytail identity');
  assert.match(content, /^---\r?\n[\s\S]*inclusion:\s*always[\s\S]*?\r?\n---/, 'must declare always-on steering frontmatter');
});

test('kiro runtime stays inert without the --host=kiro flag', () => {
  // isKiro resolves at module load from argv/env; the test process passes
  // neither, so it must be false and leave the other host branches untouched.
  const { isKiro } = require('../hooks/ponytail-runtime');
  assert.equal(isKiro, false, 'isKiro must be false without --host=kiro or PONYTAIL_HOST=kiro');
});
