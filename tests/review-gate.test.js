#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const gate = path.join(root, 'hooks', 'ponytail-review-gate.js');
const tracker = path.join(root, 'hooks', 'ponytail-mode-tracker.js');

function run(script, env, input) {
  return spawnSync(process.execPath, [script], { env: { ...process.env, ...env }, input, encoding: 'utf8' });
}

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('commit and push require a review for the unchanged diff', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-review-gate-'));
  const repo = path.join(temp, 'repo');
  const state = path.join(temp, 'state.json');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.name', 'test');
  git(repo, 'config', 'user.email', 'test@example.com');
  fs.writeFileSync(path.join(repo, 'file.txt'), 'before\n');
  git(repo, 'add', 'file.txt');
  git(repo, 'commit', '-qm', 'init');
  fs.writeFileSync(path.join(repo, 'file.txt'), 'after\n');

  const env = { HOME: temp, USERPROFILE: temp, PONYTAIL_REVIEW_STATE_PATH: state };
  const event = cwd => JSON.stringify({ tool_name: 'Bash', tool_input: { command: cwd }, cwd: repo, session_id: 'session-1' });
  const denied = run(gate, env, event('git commit -am update'));
  assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny');

  const marked = run(tracker, env, JSON.stringify({ prompt: '/ponytail-review', cwd: repo, session_id: 'session-1' }));
  assert.equal(marked.status, 0, marked.stderr);
  assert.equal(marked.stdout, '', 'one-shot review should not replace the user prompt');

  assert.equal(run(gate, env, event('git commit -am update')).stdout, '');
  assert.equal(run(gate, env, event('git -C "' + repo + '" push')).stdout, '');
  assert.equal(run(gate, env, event('git -C "/path with spaces" push')).stdout, '');

  fs.writeFileSync(path.join(repo, 'file.txt'), 'changed again\n');
  const stale = run(gate, env, event('git commit -am update'));
  assert.equal(JSON.parse(stale.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('the gate ignores reads, status, quoted examples, and non-Bash tools', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-review-gate-'));
  const env = { HOME: temp, USERPROFILE: temp, PONYTAIL_REVIEW_STATE_PATH: path.join(temp, 'state.json') };
  for (const command of ['git status', 'git log -1', 'echo "git commit -m demo"', 'printf "git push"']) {
    assert.equal(run(gate, env, JSON.stringify({ tool_name: 'Bash', tool_input: { command } })).stdout, '');
  }
  assert.equal(run(gate, env, JSON.stringify({ tool_name: 'Read', tool_input: { command: 'git commit' } })).stdout, '');
});

test('the plugin manifest includes the review gate before Bash tools', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'claude-codex-hooks.json'), 'utf8'));
  const preToolUse = config.hooks.PreToolUse;
  assert.ok(preToolUse.some(group => group.matcher === 'Bash' && group.hooks.some(hook => hook.command.includes('ponytail-review-gate.js'))));
});
