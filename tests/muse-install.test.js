const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { SKILLS, install } = require('../scripts/install-muse-skills');

test('installs every skill for the Muse user and stops on failure', () => {
  const calls = [];
  assert.equal(install((...args) => {
    calls.push(args);
    return { status: 0 };
  }), 0);
  assert.deepEqual(calls.map(([command, args]) => [command, args]), SKILLS.map(name => [
    'muse', ['skills', 'install', `./skills/${name}`, '--scope', 'user'],
  ]));

  const failedCalls = [];
  const status = install((...args) => {
    failedCalls.push(args);
    return { status: failedCalls.length === 3 ? 7 : 0 };
  });

  assert.equal(status, 7);
  assert.equal(failedCalls.length, 3);
  assert.equal(calls[0][2].cwd, path.join(__dirname, '..'));
});
