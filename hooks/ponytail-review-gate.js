#!/usr/bin/env node
// Deny agent-issued commits and pushes until /ponytail-review saw this diff.

const fs = require('fs');
const { hasFreshReview } = require('./ponytail-review-state');

function isGitWrite(command) {
  // Split only at shell command boundaries. Quoted text stays one token, so
  // `echo "git commit"` is not mistaken for a Git write.
  return String(command || '').split(/[;&|()\n`]+/).some(part => {
    const tokens = (part.trim().match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+/g) || []).map(token => token.replace(/^['"]|['"]$/g, ''));
    let i = 0;
    while (i < tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]) || ['sudo', 'env', 'command', 'exec', 'nohup', 'time'].includes(tokens[i]))) i += 1;
    if (tokens[i] === 'env') i += 1;
    if (i >= tokens.length || !/(?:^|[\\/])git(?:\.exe)?$/i.test(tokens[i])) return false;
    for (i += 1; i < tokens.length; i += 1) {
      if (['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(tokens[i])) { i += 1; continue; }
      if (tokens[i].startsWith('-')) continue;
      return /^(commit|push)$/i.test(tokens[i]);
    }
    return false;
  });
}

let event;
try {
  event = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
} catch (_) {
  process.exit(0);
}

const input = event && event.tool_input || {};
const command = String(input.command || event.command || '');
const toolName = String(event.tool_name || 'Bash');
if (toolName !== 'Bash' || !isGitWrite(command)) process.exit(0);
if (hasFreshReview(String(event.cwd || process.cwd()), event.session_id)) process.exit(0);

process.stdout.write(JSON.stringify({ hookSpecificOutput: {
  hookEventName: 'PreToolUse',
  permissionDecision: 'deny',
  permissionDecisionReason: 'Ponytail review gate: run /ponytail-review on the current diff before git commit or git push, then retry the command.',
} }) + '\n');
