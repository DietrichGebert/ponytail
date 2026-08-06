#!/usr/bin/env node
// Generate a single ChatGPT-uploadable Skill source tree from the canonical
// skills/. One uploaded bundle exposes one SKILL.md entrypoint, which routes
// Ponytail's six behaviors through canonical bodies copied as references.
//
// Run: npm run build:chatgpt
// Package: npm run pack:chatgpt

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
const CHATGPT_HOST = `# ChatGPT host behavior

Use this reference as the authority for ChatGPT-specific installation, commands, mode state, updates, and removal. Do not reuse host behavior from Claude Code, Codex, OpenCode, Copilot CLI, or other adapters.

## Use

ChatGPT can select Ponytail automatically for coding requests. Users can also type these text triggers:

- \`ponytail lite\`, \`ponytail full\`, \`ponytail ultra\`, or \`ponytail off\`
- \`/ponytail-review\`, \`/ponytail-audit\`, \`/ponytail-debt\`, \`/ponytail-gain\`, or \`/ponytail-help\`
- \`stop ponytail\` or \`normal mode\`

Slash-like forms are messages, not registered ChatGPT slash-menu commands.

## State

Mode is scoped to the current conversation. Default to full when Ponytail is first used unless the user explicitly selects another level. Do not read or create \`PONYTAIL_DEFAULT_MODE\`, \`~/.config/ponytail/config.json\`, mode flags, statusline files, or lifecycle hooks.

## Install and update

The upload bundle is a ZIP whose top-level directory is \`ponytail/\`. In ChatGPT, the user opens **Plugins → Skills → Create → Upload from your computer** and selects the ZIP. Availability and admin controls depend on the user's current ChatGPT plan and workspace settings.

To update, the user builds a newer ZIP and replaces or re-uploads the Skill. Personal Skills may need to be added separately on different ChatGPT surfaces.

## Remove

Delete the uploaded Ponytail Skill from **Plugins → Skills**. No local Ponytail state needs cleanup because this adapter writes none.
`;

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
    ['references/chatgpt-host.md', CHATGPT_HOST],
  ]);
  for (const name of NAMES) files.set(`references/${name}.md`, sourceBody(name));
  return files;
}

function outPath(relativePath) {
  return path.join(OUT, relativePath);
}

function writeFiles() {
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const [relativePath, content] of renderFiles()) {
    const target = outPath(relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    console.log('wrote', path.relative(ROOT, target).replace(/\\/g, '/'));
  }
}

module.exports = {
  CHATGPT_HOST,
  ENTRYPOINT,
  NAMES,
  OPENAI_YAML,
  OUT,
  outPath,
  renderFiles,
  sourceBody,
  writeFiles,
};

if (require.main === module) writeFiles();
