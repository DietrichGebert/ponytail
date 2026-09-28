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

// SKILL.md -> { name, description, content }. Handles a plain one-line
// description and the folded `description: >` block every bundled skill uses.
function parseSkillFile(filePath) {
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (!name) return null;
  let description;
  const at = lines.findIndex((line) => /^description:/.test(line));
  if (at !== -1) {
    const inline = lines[at].replace(/^description:\s*/, '').trim();
    if (/^[>|]-?$/.test(inline)) {
      const block = [];
      for (const line of lines.slice(at + 1)) {
        if (!/^\s+\S/.test(line)) break;
        block.push(line.trim());
      }
      description = block.join(' ');
    } else {
      description = inline;
    }
  }
  return { name, description, content: match[2].trim() };
}

module.exports = { parseCommandFile, parseSkillFile };
