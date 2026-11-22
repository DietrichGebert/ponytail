#!/usr/bin/env node
// Regression tests for the publish-script argument allowlist (F-2).
// The script must be importable without publishing: require.main guard.

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeArg, displayName, quote } = require('../scripts/publish-openclaw-skills.js');

test('importing the publish script does not publish anything', () => {
  // The require above already proved it: no spawn happened, exports exist.
  assert.equal(typeof assertSafeArg, 'function');
});

test('repo-generated args pass the allowlist', () => {
  assert.equal(assertSafeArg('ponytail-review'), 'ponytail-review');
  assert.equal(assertSafeArg('.openclaw/skills/ponytail-review'), '.openclaw/skills/ponytail-review');
  assert.equal(assertSafeArg('Ponytail Review'), 'Ponytail Review');
  assert.equal(assertSafeArg('5.3.2'), '5.3.2');
  assert.equal(assertSafeArg('--dry-run'), '--dry-run');
});

test('shell metacharacters are refused before any shell runs', () => {
  // A malicious PR could add a skill directory with any of these in its name;
  // double quoting does not stop them in POSIX sh or cmd.exe.
  for (const evil of [
    'foo$(curl evil)',
    'foo`id`',
    'x%PATH%',
    'semi;colon',
    'amp&&and',
    'pipe|pipe',
    'redir>out',
    "quote'in",
  ]) {
    assert.throws(() => assertSafeArg(evil), /shell metacharacters/, evil);
  }
});

test('boundary and encoding attacks are refused (derived, not just known payloads)', () => {
  // The allowlist is the boundary: only [A-Za-z0-9 ._/:=,-] may reach a shell.
  // Everything else must fail closed — including classes a payload list would miss.
  for (const evil of [
    '',                    // empty: no arg may silently vanish
    'a\nb',                // newline: line-splitting in any shell
    'a\tb',                // tab
    'a\rb',                // carriage return
    'a\\b',                // backslash: could escape the closing quote
    'a\\',                 // terminal backslash: definitely escapes the closing quote
    '${HOME}',             // POSIX var expansion
    '$HOME',               // POSIX var, unbraced
    'a||b',                // or-list
    '(subshell)',          // subshell grouping
    '~root',               // tilde expansion
    '*',                   // glob
    'café',                // non-ASCII
    'аbc',                 // cyrillic homoglyph
    'a\u202Eb',            // RTL override
  ]) {
    assert.throws(() => assertSafeArg(evil), /shell metacharacters/, JSON.stringify(evil));
  }
});

test('validation is the only path to the shell: one spawn, validated first, no eval', () => {
  // Structural regression guard (source-level, matching check-rule-copies style):
  // if someone adds a second spawnSync or moves validation after it, this fails.
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'scripts', 'publish-openclaw-skills.js'), 'utf8');
  assert.equal((src.match(/spawnSync\(/g) || []).length, 1, 'exactly one spawn site');
  assert.equal((src.match(/\beval\s*\(|new\s+Function\s*\(/g) || []).length, 0, 'no eval');
  assert.ok(src.indexOf('args.forEach(assertSafeArg)') > -1 && src.indexOf('args.forEach(assertSafeArg)') < src.indexOf('spawnSync('),
    'args.forEach(assertSafeArg) must precede spawnSync');
  assert.ok(src.includes('...passthrough,'), 'passthrough args flow through the same validated array');
});

test('every argument source is covered by the same validated array', () => {
  // The args array is: literals + interpolated path + slug + displayName(slug)
  // + version (from package.json) + passthrough (maintainer argv). All flow
  // through args.forEach(assertSafeArg). displayName cannot smuggle anything:
  // its output charset is the slug's charset (already allowlisted) plus spaces
  // and capitals — and its output is validated regardless.
  const { displayName: dn } = require('../scripts/publish-openclaw-skills.js');
  for (const slug of ['ponytail', 'ponytail-review', 'a-very-long-skill-name-2']) {
    const name = dn(slug);
    assert.equal(assertSafeArg(name), name); // displayName output always passes
    assert.ok(!/[^A-Za-z0-9 ]/.test(name.replace(/-/g, ' ')), 'displayName charset is slug charset + space');
  }
  // version from package.json must pass (it is a real arg source)
  const version = require('../package.json').version;
  assert.equal(assertSafeArg(version), version);
  // the interpolated path arg shape must pass
  assert.equal(assertSafeArg(`.openclaw/skills/ponytail-review`), '.openclaw/skills/ponytail-review');
});

test('quote still wraps only space-bearing args for display', () => {
  assert.equal(quote('ponytail'), 'ponytail');
  assert.equal(quote('Ponytail Review'), '"Ponytail Review"');
});

test('displayName maps slugs the way the publish loop expects', () => {
  assert.equal(displayName('ponytail-review'), 'Ponytail Review');
});
