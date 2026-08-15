#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('../hooks/ponytail-config');
const { getPonytailInstructions } = require('../hooks/ponytail-instructions');

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return fn(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('external policy is appended from env and config fallback', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-policy-'));
  const policy = path.join(tmp, 'policy.md');
  fs.writeFileSync(policy, '# Team policy\nUse the existing logger.\n');
  fs.mkdirSync(path.join(tmp, 'ponytail'));
  fs.writeFileSync(path.join(tmp, 'ponytail', 'config.json'), JSON.stringify({ policyFile: policy }));

  withEnv({ XDG_CONFIG_HOME: tmp, PONYTAIL_POLICY_FILE: undefined }, () => {
    assert.match(getPonytailInstructions('full'), /# Team policy/);
  });
  withEnv({ XDG_CONFIG_HOME: tmp, PONYTAIL_POLICY_FILE: policy }, () => {
    assert.match(getPonytailInstructions('full'), /Use the existing logger/);
  });
});

test('missing, invalid, and non-markdown policy paths are ignored', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-policy-'));
  withEnv({ XDG_CONFIG_HOME: tmp, PONYTAIL_POLICY_FILE: path.join(tmp, 'missing.md') }, () => {
    const context = getPonytailInstructions('full');
    assert.doesNotMatch(context, /Team policy/);
  });
  fs.mkdirSync(path.join(tmp, 'ponytail'));
  fs.writeFileSync(path.join(tmp, 'ponytail', 'config.json'), '{invalid');
  withEnv({ XDG_CONFIG_HOME: tmp, PONYTAIL_POLICY_FILE: undefined }, () => {
    assert.doesNotMatch(getPonytailInstructions('full'), /Team policy/);
  });
});

test('skill paths only return existing directories and exclude built-in names', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-skills-'));
  const custom = path.join(tmp, 'custom');
  fs.mkdirSync(path.join(custom, 'team-review'), { recursive: true });
  fs.writeFileSync(path.join(custom, 'team-review', 'SKILL.md'), '# Team review');
  fs.mkdirSync(path.join(custom, 'ponytail'), { recursive: true });
  fs.writeFileSync(path.join(custom, 'ponytail', 'SKILL.md'), '# Should not replace built-in');

  withEnv({ PONYTAIL_SKILL_PATHS: [custom, path.join(tmp, 'missing')].join(path.delimiter), XDG_CONFIG_HOME: tmp }, () => {
    assert.deepEqual(config.getCustomSkillFiles().map(({ name }) => name), ['team-review']);
  });
});

test('custom policy is present on every non-off injection', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-policy-'));
  const policy = path.join(tmp, 'policy.md');
  fs.writeFileSync(policy, 'POLICY-EVERY-TURN');
  withEnv({ PONYTAIL_POLICY_FILE: policy }, () => {
    assert.match(getPonytailInstructions('review'), /POLICY-EVERY-TURN/);
  });
});
