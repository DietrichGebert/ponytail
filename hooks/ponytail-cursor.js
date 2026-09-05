#!/usr/bin/env node
// Cursor has its own JSON contract; do not route through Claude/Codex output.
const { getDefaultMode, normalizeMode } = require('./ponytail-config');
const { getPonytailInstructions } = require('./ponytail-instructions');

let input = '';
let done = false;
function finish() {
  if (done) return;
  done = true;
  let output = {};
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    if (data.hook_event_name === 'sessionStart') {
      const args = process.argv.slice(2);
      const mode = args.length === 0 ? getDefaultMode()
        : args.length === 2 && args[0] === '--mode' ? normalizeMode(args[1]) : null;
      if (mode && mode !== 'off') {
        output = { additional_context: getPonytailInstructions(mode) +
          '\n\nCursor native adapter: the level above is fixed for this conversation. ' +
          'The generic mode-switch commands in these instructions are unavailable here. ' +
          'To change levels or turn Ponytail off, configure the next session and start a new chat. ' +
          'Do not claim that a chat command changed the hook configuration or that subagents received these instructions.' };
      }
    }
  } catch (_) { /* Malformed input must not interrupt Cursor. */ }
  process.stdout.write(JSON.stringify(output));
}

process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', finish);
process.stdin.on('error', () => { finish(); process.exit(0); });
// ponytail: mirror the existing hooks' one-second ceiling for missing stdin EOF.
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
