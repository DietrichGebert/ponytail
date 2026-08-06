#!/usr/bin/env node
// The ChatGPT adapter is generated from the canonical skills/. These tests
// catch stale copies and ensure an uploaded bundle exposes exactly one
// SKILL.md entrypoint instead of six independent skills.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  ENTRYPOINT,
  NAMES,
  OPENAI_YAML,
  OUT,
  outPath,
  renderFiles,
  sourceBody,
} = require('../scripts/build-chatgpt-skill');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('committed ChatGPT adapter matches the generator', () => {
  for (const [relativePath, expected] of renderFiles()) {
    const actual = fs.readFileSync(outPath(relativePath), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(actual, expected, `stale — run: node scripts/build-chatgpt-skill.js (${relativePath})`);
  }
});

test('ChatGPT bundle exposes exactly one SKILL.md', () => {
  const skillFiles = walk(OUT).filter((file) => path.basename(file) === 'SKILL.md');
  assert.deepEqual(skillFiles.map((file) => path.relative(OUT, file).replace(/\\/g, '/')), ['SKILL.md']);
});

test('root entrypoint uses ChatGPT-compatible frontmatter', () => {
  const frontmatter = ENTRYPOINT.match(/^---\n([\s\S]*?)\n---/)[1];
  const keys = frontmatter.split('\n').filter((line) => /^[a-z][a-z-]*:/.test(line)).map((line) => line.split(':')[0]);
  assert.deepEqual(keys, ['name', 'description']);
  assert.match(frontmatter, /^name: ponytail$/m);
});

test('OpenAI UI metadata is present', () => {
  assert.match(OPENAI_YAML, /display_name: "Ponytail"/);
  assert.match(OPENAI_YAML, /short_description:/);
});

for (const name of NAMES) {
  test(`${name}: ChatGPT reference is the canonical skill body`, () => {
    const reference = fs.readFileSync(outPath(`references/${name}.md`), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(reference, sourceBody(name));
  });
}
