#!/usr/bin/env node
// Generate AGENTS.md and the host rule copies from skills/ponytail/SKILL.md.
// SKILL.md is the only hand-edited ruleset; everything else is derived.
//
// Compact body = SKILL body without session-switch lines and without the Levels
// table (always-on hosts have no mode switcher). AGENTS.md adds the repo
// self-application footnote.
//
// Run:  node scripts/generate-rule-copies.js
// Check: node scripts/check-rule-copies.js (compares on-disk to render())

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKILL = path.join(root, 'skills', 'ponytail', 'SKILL.md');
const FOOTNOTE =
  '\n\n(Yes, this file also applies to agents working on the ponytail repo itself. Especially to them.)';

const CURSOR_FRONTMATTER =
  '---\ndescription: Ponytail, lazy senior dev mode. Always pick the simplest solution that works.\nglobs:\nalwaysApply: true\n---\n\n';

const KIRO_FRONTMATTER =
  '---\ntitle: Ponytail, lazy senior dev mode\ninclusion: always\n---\n\n';

function readSkillBody() {
  const raw = fs.readFileSync(SKILL, 'utf8').replace(/\r\n/g, '\n');
  const stripped = raw.replace(/^---\n[\s\S]*?\n---\n*/, '');
  if (stripped === raw) throw new Error('skills/ponytail/SKILL.md has no frontmatter');
  return stripped.trim() + '\n';
}

// Compact always-on body shared by AGENTS.md and host rule copies.
function compactBody(skillBody = readSkillBody()) {
  let body = skillBody;
  body = body.replace(/^# Ponytail\n/, '# Ponytail, lazy senior dev mode\n');
  // Session controls belong to hooks/skills, not always-on rules.
  body = body.replace(
    /\n+Active for the whole session until the user says "stop ponytail" or "normal mode"\. Switch level: `\/ponytail lite\|full\|ultra`\.\n+/,
    '\n\n',
  );
  body = body.replace(/\n## Levels\n[\s\S]*$/, '\n');
  return body.trim() + '\n';
}

function renderAgents(body = compactBody()) {
  return body.trimEnd() + FOOTNOTE + '\n';
}

function renderCopies(body = compactBody()) {
  const trimmed = body.trim() + '\n';
  return {
    'AGENTS.md': renderAgents(body),
    '.cursor/rules/ponytail.mdc': CURSOR_FRONTMATTER + trimmed,
    '.windsurf/rules/ponytail.md': trimmed,
    '.clinerules/ponytail.md': trimmed,
    '.agents/rules/ponytail.md': trimmed,
    '.qoder/rules/ponytail.md': trimmed,
    '.github/copilot-instructions.md': trimmed,
    '.kiro/steering/ponytail.md': KIRO_FRONTMATTER + trimmed,
  };
}

function writeAll() {
  const files = renderCopies();
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    console.log('wrote', rel);
  }
}

module.exports = {
  FOOTNOTE,
  compactBody,
  readSkillBody,
  renderAgents,
  renderCopies,
};

if (require.main === module) writeAll();
