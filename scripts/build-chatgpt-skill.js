#!/usr/bin/env node
// Generate a single ChatGPT-uploadable Skill source tree from the canonical
// skills/. ChatGPT accepts the Agent Skills format, but one uploaded bundle
// should expose one SKILL.md entrypoint. This adapter routes Ponytail's six
// skills through one root entrypoint and keeps each canonical body as a
// reference, so the behavior stays in sync without shipping nested SKILL.md
// files that would be detected as separate skills.
//
// Run: node scripts/build-chatgpt-skill.js
// Then package: cd .chatgpt && python3 -m zipfile -c skill.zip ponytail

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.chatgpt', 'ponytail');
const NAMES = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];

const ENTRYPOINT = fs.readFileSync(path.join(OUT, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const OPENAI_YAML = `interface:\n  display_name: "Ponytail"\n  short_description: "Minimal coding, review, audit, and debt cleanup"\n  brand_color: "#8FD14F"\n`;

function sourceBody(name) {
  const source = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const frontmatter = source.match(/^---\n[\s\S]*?\n---\n?/);
  if (!frontmatter) throw new Error(`skills/${name}/SKILL.md has no frontmatter`);
  return source.slice(frontmatter[0].length);
}

function renderFiles() {
  const files = new Map([
    ['SKILL.md', ENTRYPOINT],
    ['agents/openai.yaml', OPENAI_YAML],
  ]);
  for (const name of NAMES) files.set(`references/${name}.md`, sourceBody(name));
  return files;
}

function outPath(relativePath) {
  return path.join(OUT, relativePath);
}

function writeFiles() {
  for (const [relativePath, content] of renderFiles()) {
    const target = outPath(relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    console.log('wrote', path.relative(ROOT, target).replace(/\\/g, '/'));
  }
}

module.exports = { ENTRYPOINT, NAMES, OPENAI_YAML, OUT, outPath, renderFiles, sourceBody, writeFiles };

if (require.main === module) writeFiles();
