#!/usr/bin/env node
// Host capability table: mode-tracker / activate read flags, not host-name nests.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const probe = `
  const { resolveHost } = require(${JSON.stringify(path.join(root, 'hooks', 'ponytail-host.js'))});
  process.stdout.write(JSON.stringify(resolveHost()));
`;

function hostFor(env) {
  const r = spawnSync(process.execPath, ['-e', probe], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const clear = {
  COPILOT_PLUGIN_DATA: '',
  PLUGIN_DATA: '',
  QODER_SESSION_ID: '',
  CODEBUDDY_PLUGIN_ROOT: '',
  CURSOR_VERSION: '',
  CLAUDE_PLUGIN_ROOT: '',
};

test('claude host gets band + statusline; no per-prompt ruleset fold', () => {
  const h = hostFor(clear);
  assert.equal(h.id, 'claude');
  assert.equal(h.supportsBand, true);
  assert.equal(h.supportsStatuslineNudge, true);
  assert.equal(h.injectRulesEveryPrompt, false);
  assert.equal(h.foldNoticesIntoRuleset, false);
  assert.equal(h.deliverRulesetOnModeSwitch, false);
});

test('qoder host injects every prompt and folds notices', () => {
  const h = hostFor({ ...clear, QODER_SESSION_ID: 's1' });
  assert.equal(h.id, 'qoder');
  assert.equal(h.injectRulesEveryPrompt, true);
  assert.equal(h.foldNoticesIntoRuleset, true);
  assert.equal(h.persistOffAsFlag, true);
  assert.equal(h.supportsBand, false);
});

test('cursor and codex deliver the ruleset on mode switch', () => {
  assert.equal(hostFor({ ...clear, CURSOR_VERSION: '3.20.17' }).deliverRulesetOnModeSwitch, true);
  assert.equal(hostFor({ ...clear, CURSOR_VERSION: '3.20.17' }).respectsAlwaysOnRule, true);
  assert.equal(hostFor({ ...clear, PLUGIN_DATA: '/tmp/codex' }).id, 'codex');
  assert.equal(hostFor({ ...clear, PLUGIN_DATA: '/tmp/codex' }).deliverRulesetOnModeSwitch, true);
  assert.equal(hostFor({ ...clear, PLUGIN_DATA: '/tmp/codex' }).supportsBand, false);
});

test('mode-tracker and activate no longer nest isQoder/isCursor host checks', () => {
  for (const file of ['ponytail-mode-tracker.js', 'ponytail-activate.js']) {
    const src = require('fs').readFileSync(path.join(root, 'hooks', file), 'utf8');
    assert.match(src, /resolveHost/);
    assert.doesNotMatch(src, /\bisQoder\b/);
    assert.doesNotMatch(src, /\bisCursor\b/);
    assert.doesNotMatch(src, /\bisCodex\b/);
    assert.doesNotMatch(src, /\bisCopilot\b/);
    assert.doesNotMatch(src, /\bisCodeBuddy\b/);
  }
});
