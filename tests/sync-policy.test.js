#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { STATIC_ADAPTERS, START, END, syncPolicy } = require('../scripts/sync-policy');

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-sync-')); }

test('syncs configured policy to every static adapter and generated OpenClaw skill', () => {
  const project = temp();
  const policy = path.join(project, 'POLICY.md');
  fs.writeFileSync(policy, '# Team policy\nUse the existing logger.\n');
  const openclaw = path.join(project, '.openclaw', 'skills', 'ponytail');
  fs.mkdirSync(openclaw, { recursive: true });
  fs.writeFileSync(path.join(openclaw, 'SKILL.md'), '---\nname: ponytail\n---\n\nRules.\n');

  const result = syncPolicy({ project, policy });
  assert.equal(result.files.length, STATIC_ADAPTERS.length + 1);
  for (const [target] of STATIC_ADAPTERS) {
    const text = fs.readFileSync(path.join(project, target), 'utf8');
    assert.match(text, /Use the existing logger/);
    assert.equal((text.match(new RegExp(START, 'g')) || []).length, 1);
    assert.equal((text.match(new RegExp(END, 'g')) || []).length, 1);
  }
  assert.match(fs.readFileSync(path.join(openclaw, 'SKILL.md'), 'utf8'), /# Team policy/);

  const second = syncPolicy({ project, policy });
  assert.deepEqual(second.files, []);
});

test('missing policy is a no-op and does not create static adapter files', () => {
  const project = temp();
  const result = syncPolicy({ project, policy: null });
  assert.deepEqual(result.files, []);
  assert.equal(fs.existsSync(path.join(project, 'AGENTS.md')), false);
});

test('off mode removes managed policy but preserves built-in instructions', () => {
  const project = temp();
  const policy = path.join(project, 'POLICY.md');
  fs.writeFileSync(policy, 'Do not change the API.');
  syncPolicy({ project, policy });
  const before = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  assert.match(before, /Do not change the API/);
  const result = syncPolicy({ project, policy: null, mode: 'off' });
  assert.ok(result.files.length > 0);
  const after = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  assert.doesNotMatch(after, /Do not change the API/);
  assert.match(after, /lazy senior developer/i);
  assert.doesNotMatch(after, new RegExp(START));
});

test('does not follow an existing symlink destination', () => {
  const project = temp();
  const outside = path.join(temp(), 'outside.md');
  fs.writeFileSync(outside, 'outside instructions\n');
  fs.symlinkSync(outside, path.join(project, 'AGENTS.md'));

  const result = syncPolicy({ project, policy: 'Do not modify outside.' });

  assert.equal(result.files.includes('AGENTS.md'), false);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'outside instructions\n');
  assert.equal(fs.readlinkSync(path.join(project, 'AGENTS.md')), outside);
});

test('policy containing the end marker remains idempotent', () => {
  const project = temp();
  const policy = `Keep this text ${END} exactly in the policy.`;

  syncPolicy({ project, policy });
  const before = new Map(STATIC_ADAPTERS.map(([target]) => [target, fs.readFileSync(path.join(project, target), 'utf8')]));
  const second = syncPolicy({ project, policy });

  assert.deepEqual(second.files, []);
  for (const [target, text] of before) assert.equal(fs.readFileSync(path.join(project, target), 'utf8'), text);
});

test('missing path-like explicit policy is treated as unreadable', () => {
  const project = temp();

  const result = syncPolicy({ project, policy: '/missing/path/POLICY.md' });

  assert.equal(result.policy, false);
  assert.deepEqual(result.files, []);
  assert.equal(fs.existsSync(path.join(project, 'AGENTS.md')), false);
});

test('explicit policy text containing a workspace path is preserved', () => {
  const project = temp();
  const policy = '모든 작업은 /Users/cinos81/works 아래에서 수행한다.';

  const result = syncPolicy({ project, policy });

  assert.ok(result.files.length > 0);
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /\/Users\/cinos81\/works/);
});
