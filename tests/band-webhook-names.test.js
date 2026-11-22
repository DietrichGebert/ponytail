#!/usr/bin/env node
// The webhook gets no task names unless the user turns them on.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const plugin = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
assert.strictEqual(plugin.userConfig.sendNames.default, false, 'sendNames is off by default');

const register = fs.readFileSync(path.join(root, 'hooks', 'band', 'register.tsx'), 'utf8');
assert.ok(register.includes('options.sendNames === true'), 'an unset sendNames sends no names');
assert.ok(!register.includes('options.sendNames !== false'), 'an unset sendNames must not count as on');

console.log('ok');
