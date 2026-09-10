'use strict';

// ponytail command-file frontmatter parser.
//
// Lives outside .opencode/plugins/ so OpenCode's legacy plugin loader
// doesn't discover it. The legacy loader treats every exported function
// from any file under plugins/ as a plugin; calling parseCommandFile with
// the plugin context object threw "path must be a string or a file
// descriptor" (#301, #596).

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
