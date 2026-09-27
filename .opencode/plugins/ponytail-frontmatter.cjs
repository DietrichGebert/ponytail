'use strict';

// ponytail command-file frontmatter parser.
//
// Pulled out of ponytail.mjs so the plugin module's only top-level export is
// the plugin function itself. OpenCode's legacy plugin loader (the one that
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

// Skill frontmatter for the v2 adapter. Same split as parseCommandFile, but
// the folded description (`description: >` plus indented continuation lines)
// needs joining, which the single-line regex above does not do.
function parseSkillFile(filePath) {
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatter, body] = match;
  const description = frontmatter.match(/^description:[ \t]*(>|[-+]?)([^\r\n]*)(?:\r?\n((?:[ \t]+[^\r\n]*\r?\n?)+))?/m);
  if (!description) return null;
  const folded = description[3] ? description[3].split(/\r?\n/).map((line) => line.trim()).join(' ') : '';
  return {
    description: (description[2].trim() + ' ' + folded).trim(),
    body: body.trim(),
  };
}

module.exports = { parseCommandFile, parseSkillFile };
