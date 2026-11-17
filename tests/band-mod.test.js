// Regression guard for #1449: Claude Code reads a mod's declared events before it runs the mod, so
// a `tool.call` subscription makes it refuse Code Mode (experimental) -- "it doesn't yet work with
// an installed mod (a plugin with JavaScript hooks) that checks tool calls" -- and no guard inside
// register.tsx can stand it down. The band reads tool calls out of the transcript at turn.complete
// instead. Someone re-adding the hook would silently turn Code Mode off again with no failing test
// anywhere else, so this file runs with `npm test` and blocks it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const register = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'band', 'register.tsx'), 'utf8');

test('the band never subscribes to tool.call, so Code Mode can still start (#1449)', () => {
  assert.doesNotMatch(
    register,
    /\bon\(\s*['"`]tool\.call['"`]/,
    'a tool.call hook stops Claude Code from starting Code Mode; derive the board from the transcript at turn.complete instead (see #1449)',
  );
});
