#!/usr/bin/env node
// The OpenClaw skill package (.openclaw/skills/) is generated from skills/ by
// scripts/build-openclaw-skills.js. These tests fail if the committed copies are
// stale (ruleset drift) or if a description breaks OpenClaw's one-line <160 rule.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { NAMES, render, outPath, sourceBody, DESCRIPTIONS } = require('../scripts/build-openclaw-skills');

for (const name of NAMES) {
  test(`${name}: committed OpenClaw skill matches the generator`, () => {
    const onDisk = fs.readFileSync(outPath(name), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(onDisk, render(name), 'stale — run: node scripts/build-openclaw-skills.js');
  });

  test(`${name}: body is the canonical skills/${name} body, verbatim`, () => {
    const onDisk = fs.readFileSync(outPath(name), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(onDisk.endsWith(sourceBody(name)), 'body drifted from skills/' + name);
  });

  test(`${name}: description is one line under 160 chars`, () => {
    const d = DESCRIPTIONS[name];
    assert.ok(d.length <= 160 && !d.includes('\n'), 'description too long or multiline');
  });
}

// Leak test (KTD5/R10): the raw SKILL.md and its verbatim OpenClaw copy carry
// the union of core + per-level blocks. Every `<!-- mode: X -->` open marker
// must be balanced by a matching `<!-- /mode: X -->` close — an unclosed or
// stray marker would leak into raw consumers (OpenClaw, pi skills, skill
// pickers, benchmark arms) as instructions.
//
// The filter (hooks/ponytail-instructions.js) is a single skip-flag state
// machine over line-anchored markers, so this guard validates the *sequence*,
// not just the multiset: a crossed or reordered block set (open lite, open
// ultra, close lite, close ultra) satisfies equal counts and multiset
// membership while the filter silently drops core content or mixes
// foreign-mode rules. Walk the lines in order with a stack and assert each
// close matches the currently-open block, with the stack empty at the end.
test('ponytail: gated mode blocks are balanced and well-formed in the raw copies', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md'), 'utf8');
  const openclaw = fs.readFileSync(outPath('ponytail'), 'utf8');

  // Mirror the filter's line-anchored marker regexes (MODE_BLOCK_OPEN_RE /
  // MODE_BLOCK_CLOSE_RE in hooks/ponytail-instructions.js) so this validates
  // exactly what the filter consumes.
  const MODE_BLOCK_OPEN_RE = /^<!--\s*mode:\s*([a-z]+)\s*-->\s*$/;
  const MODE_BLOCK_CLOSE_RE = /^<!--\s*\/mode:\s*([a-z]+)\s*-->\s*$/;
  const ALLOWED = ['lite', 'full', 'ultra'];

  for (const [label, text] of [['skills/ponytail/SKILL.md', skill], ['.openclaw/skills/ponytail/SKILL.md', openclaw]]) {
    const lines = text.split(/\r?\n/);
    const opens = [];
    const closes = [];
    const stack = [];

    lines.forEach((line, i) => {
      const n = i + 1; // 1-based line number for error messages

      const open = line.match(MODE_BLOCK_OPEN_RE);
      if (open) {
        opens.push(open[1]);
        stack.push(open[1]);
        return;
      }

      const close = line.match(MODE_BLOCK_CLOSE_RE);
      if (close) {
        closes.push(close[1]);
        const top = stack.pop();
        assert.equal(
          close[1],
          top,
          `${label}:${n} closes mode "${close[1]}" but the open block on top is ${top === undefined ? 'nothing (stack already empty)' : `"${top}"`} — crossed, reordered, or stray marker`
        );
      }
    });

    assert.ok(opens.length > 0, `${label} must carry gated mode blocks`);
    assert.equal(closes.length, opens.length, `${label} must have balanced mode markers`);
    for (const m of opens) {
      assert.ok(ALLOWED.includes(m), `${label} has an unknown mode marker: ${m}`);
    }
    for (const m of closes) {
      assert.ok(ALLOWED.includes(m), `${label} has a close marker for an unknown mode: ${m}`);
    }
    assert.equal(stack.length, 0, `${label} has ${stack.length} unclosed mode block(s): ${stack.join(', ')} — marker would leak into raw consumers`);
  }
});
