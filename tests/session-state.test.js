#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function run(script, env, input = '') {
  const result = spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, PONYTAIL_MAP: '0', ...env },
    input,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function projectFlag(home, project) {
  const { createHash } = require('crypto');
  return path.join(
    home,
    '.claude',
    'ponytail-modes',
    createHash('sha256').update(path.normalize(project)).digest('hex'),
  );
}

function subagentLevel(env) {
  const result = run('ponytail-subagent.js', env);
  assert.equal(result.status, 0, result.stderr);
  if (!result.stdout) return null;
  return JSON.parse(result.stdout).hookSpecificOutput.additionalContext.match(/level: (\w+)/)[1];
}

function statusline(env, projectDir) {
  const script = process.platform === 'win32'
    ? path.join(root, 'hooks', 'ponytail-statusline.ps1')
    : path.join(root, 'hooks', 'ponytail-statusline.sh');
  const command = process.platform === 'win32' ? 'powershell' : 'bash';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script]
    : [script];
  const result = spawnSync(command, args, {
    env: { ...process.env, ...env },
    input: JSON.stringify({ workspace: { project_dir: projectDir } }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('default-off sessions preserve other projects and compaction restores missing state (#1162)', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-session-state-'));
  try {
    const home = path.join(temp, 'home');
    const configDir = path.join(home, '.claude');
    const repoA = { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PROJECT_DIR: '/work/repo-a' };
    const repoB = { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PROJECT_DIR: '/work/repo-b' };
    const sharedFlag = path.join(home, '.claude', '.ponytail-active');
    const repoAFlag = projectFlag(home, repoA.CLAUDE_PROJECT_DIR);

    run('ponytail-activate.js', repoA);
    assert.equal(fs.readFileSync(sharedFlag, 'utf8'), 'full');
    assert.equal(subagentLevel(repoA), 'full');
    assert.match(statusline(repoA, repoA.CLAUDE_PROJECT_DIR), /\[PONYTAIL\]/);

    run('ponytail-activate.js', { ...repoB, PONYTAIL_DEFAULT_MODE: 'off' });
    assert.equal(fs.existsSync(sharedFlag), true,
      'default-off in another project must not remove the shared statusline mirror');
    assert.equal(fs.readFileSync(sharedFlag, 'utf8'), 'full');
    assert.equal(subagentLevel(repoA), 'full', 'another project must keep its active mode');
    assert.equal(subagentLevel(repoB), null, 'the default-off project must stay inactive');
    assert.match(statusline(repoA, repoA.CLAUDE_PROJECT_DIR), /\[PONYTAIL\]/,
      'project A statusline must keep its active mode');
    assert.equal(statusline(repoB, repoB.CLAUDE_PROJECT_DIR), '',
      'project B statusline must not fall back to project A state');

    run('ponytail-activate.js', { ...repoA, PONYTAIL_DEFAULT_MODE: 'off' });
    assert.equal(fs.existsSync(repoAFlag), false, 'default-off must clear the owning project state');
    assert.equal(fs.existsSync(sharedFlag), true,
      'project-scoped default-off must leave the shared fallback untouched');
    assert.equal(fs.readFileSync(sharedFlag, 'utf8'), 'full');
    assert.equal(statusline(repoA, repoA.CLAUDE_PROJECT_DIR), '',
      'a project without state must not display the shared fallback');

    const restored = run(
      'ponytail-activate.js',
      { ...repoA, PONYTAIL_DEFAULT_MODE: 'full' },
      JSON.stringify({ source: 'compact' }),
    );
    assert.match(restored.stdout, /PONYTAIL MODE ACTIVE — level: full/,
      'missing state during compaction must restore the configured default');
    assert.equal(fs.readFileSync(repoAFlag, 'utf8'), 'full');
    assert.match(statusline(repoA, repoA.CLAUDE_PROJECT_DIR), /\[PONYTAIL\]/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('an explicit stop remains off after compaction (#1162)', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-session-stop-'));
  try {
    const home = path.join(temp, 'home');
    const env = { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: path.join(home, '.claude'), PONYTAIL_DEFAULT_MODE: 'full' };
    const flag = path.join(home, '.claude', '.ponytail-active');

    run('ponytail-activate.js', env);
    run('ponytail-mode-tracker.js', env, JSON.stringify({ prompt: 'stop ponytail' }));
    assert.equal(fs.existsSync(flag), true, 'an explicit stop must persist an off sentinel');
    assert.equal(fs.readFileSync(flag, 'utf8'), 'off');
    assert.equal(statusline(env, ''), '');

    const compacted = run('ponytail-activate.js', env, JSON.stringify({ source: 'compact' }));
    assert.equal(compacted.stdout, '');
    assert.equal(fs.existsSync(flag), true);
    assert.equal(fs.readFileSync(flag, 'utf8'), 'off');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
