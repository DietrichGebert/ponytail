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

module.exports = { parseCommandFile };
