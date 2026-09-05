#!/usr/bin/env node
// SubagentStart hook. Injects the active ruleset. Optional
// PONYTAIL_SUBAGENT_MATCHER scopes by agent_type. Uses consumeStdin so a hung
// stdin cannot stall the session.

const { getPonytailInstructions } = require('./ponytail-instructions');
const { readMode, writeHookOutput } = require('./ponytail-runtime');
const { consumeStdin } = require('./ponytail-stdin');

const mode = readMode();

if (!mode || mode === 'off') {
  process.exit(0);
}

function inject() {
  try {
    writeHookOutput('SubagentStart', mode, getPonytailInstructions(mode));
  } catch (e) {
  }
}

let matcherRe = null;
try {
  if (process.env.PONYTAIL_SUBAGENT_MATCHER) {
    matcherRe = new RegExp(process.env.PONYTAIL_SUBAGENT_MATCHER, 'i');
  }
} catch (e) {
  matcherRe = null;
}

if (!matcherRe) {
  inject();
  process.exit(0);
}

consumeStdin((input) => {
  let agentType = '';
  try {
    agentType = String(JSON.parse(input.replace(/^\uFEFF/, '')).agent_type || '').trim();
  } catch (e) {
  }
  if (agentType && !matcherRe.test(agentType)) {
    process.exit(0);
  }
  inject();
});
