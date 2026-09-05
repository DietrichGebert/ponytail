#!/usr/bin/env node
// Stdin fallback timer must stay referenced so hung stdin can still exit (#790).

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const modeTrackerSrc = fs.readFileSync(path.join(root, 'hooks', 'ponytail-mode-tracker.js'), 'utf8');
const subagentSrc = fs.readFileSync(path.join(root, 'hooks', 'ponytail-subagent.js'), 'utf8');
assert.equal(modeTrackerSrc.includes('.unref('), false, 'fallback timer must stay referenced so it can fire (#790)');
assert.equal(subagentSrc.includes('.unref('), false, 'fallback timer must stay referenced so it can fire (#790)');
assert.equal(modeTrackerSrc.includes('consumeStdin'), true);
assert.equal(subagentSrc.includes('consumeStdin'), true);
console.log('stdin fallback checks passed');
