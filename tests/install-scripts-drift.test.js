#!/usr/bin/env node
// ponytail: keep install.sh and install.js in lockstep on the agent list.
// Both scripts define the same 15 agents with the same name/detect_fn
// pairing. When the next agent is added, this test fails until both files
// are updated — fixes the silent drift between the two installers that
// the graph revealed (install.sh community C2 vs install.js community C5,
// both god nodes with main() at 11-15 edges each).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const installSh = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
const installJs = fs.readFileSync(path.join(root, 'install.js'), 'utf8');

// Each entry in install.sh is "name:label:detect_fn:..."
const shAgents = [...installSh.matchAll(/^\s*"([a-z]+):([^:]+):/gm)].map(m => ({
  name: m[1], label: m[2],
}));

// Each entry in install.js is { name: 'x', label: 'Y', ... }
const jsAgents = [...installJs.matchAll(/name:\s*'([a-z]+)'/g)].map(m => m[1]);

test('install.sh and install.js declare the same agent names', () => {
  const shNames = shAgents.map(a => a.name).sort();
  const jsNames = [...jsAgents].sort();
  assert.deepEqual(
    shNames, jsNames,
    `agent drift: sh=[${shNames.join(',')}] js=[${jsNames.join(',')}]`,
  );
});

test('every agent has a non-empty label in install.sh', () => {
  for (const a of shAgents) {
    assert.ok(a.label.length > 1, `agent ${a.name} has empty label`);
  }
});
