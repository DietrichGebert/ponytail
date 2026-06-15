#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate the config dir so the host machine's real config can't sway results.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-guard-'));
process.env.XDG_CONFIG_HOME = temp;
delete process.env.PONYTAIL_GUARD_READABILITY;

const { getReadabilityGuard } = require('../hooks/ponytail-config');
const { getPonytailInstructions } = require('../hooks/ponytail-instructions');

// Default: off → no clause in the ruleset.
assert.equal(getReadabilityGuard(), false, 'guard defaults off');
assert.ok(
  !getPonytailInstructions('full').includes('Readability guard'),
  'no clause when the guard is off',
);

// Config file turns it on.
fs.mkdirSync(path.join(temp, 'ponytail'), { recursive: true });
fs.writeFileSync(
  path.join(temp, 'ponytail', 'config.json'),
  JSON.stringify({ guardReadability: true }),
);
assert.equal(getReadabilityGuard(), true, 'config guardReadability turns it on');

// Env overrides config: an explicit off wins.
process.env.PONYTAIL_GUARD_READABILITY = 'off';
assert.equal(getReadabilityGuard(), false, 'env off overrides config on');

// Env on → clause is appended and names the dimensions it protects.
process.env.PONYTAIL_GUARD_READABILITY = '1';
const on = getPonytailInstructions('full');
assert.ok(on.includes('## Readability guard (opt-in)'), 'clause present when on');
assert.ok(
  on.includes('architecture, readability, scalability, maintainability, or modularity'),
  'clause names the protected dimensions',
);

delete process.env.PONYTAIL_GUARD_READABILITY;
fs.rmSync(temp, { recursive: true, force: true });
console.log('readability guard checks passed');
