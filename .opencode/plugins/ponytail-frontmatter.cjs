'use strict';

// ponytail command-file and SKILL.md frontmatter parser.
//
// Pulled out of ponytail.mjs so the plugin module's only top-level export is
// the plugin definition itself. OpenCode's legacy plugin loader (the one that
// runs before v1 plugins are detected) treats every function exported from a
// plugin module as a plugin; calling the frontmatter parser as one threw
// "path must be a string or a file descriptor" because it got the plugin
// context object as its first argument. Keeping the parser in its own module
// leaves exactly one plugin-shaped export on ponytail.mjs.

function parseCommandFile(filePath) {
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf8');
  // Tolerate CRLF: a Windows checkout (autocrlf) delivers \r\n, npm ships \n.
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const description = match[1].match(/description:\s*(.+)/)?.[1]?.trim();
  return { description, template: match[2].trim() };
}

// ponytail: flat frontmatter only — the shape every shipped SKILL.md uses. A
// nested key or an anchor is not interpreted, and a real YAML parser is the
// upgrade path if a skill ever needs one.
function frontmatterField(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const at = lines.findIndex((line) => line.startsWith(key + ':'));
  if (at === -1) return undefined;
  const value = lines[at].slice(key.length + 1).trim();
  if (value[0] !== '>' && value[0] !== '|') return value;

  // Block scalar: `>` folds the lines into one, `|` keeps them. Indented lines
  // continue the block, the next unindented key ends it (skills/ponytail has
  // `argument-hint` after its description), and a trailing `-` drops the
  // newline YAML would otherwise close the scalar with.
  const block = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() && !/^\s/.test(line)) break;
    block.push(line.trim());
  }
  while (block.length && !block[block.length - 1]) block.pop();
  const joined = block.join(value[0] === '|' ? '\n' : ' ');
  return value.endsWith('-') ? joined : joined + '\n';
}

// OpenCode's V2 skill transform takes the resolved fields, not the file: the
// skill id is the directory name, and `content` is the body with its
// frontmatter stripped. Matches what OpenCode itself derives from a discovered
// .opencode/skills/<id>/SKILL.md.
function parseSkillFile(filePath) {
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---[^\S\n]*\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return {
    name: frontmatterField(match[1], 'name'),
    description: frontmatterField(match[1], 'description'),
    body: match[2],
  };
}

module.exports = { parseCommandFile, parseSkillFile };
