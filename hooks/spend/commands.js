// ponytail — spend firewall: the `/ponytail spend ...` command surface.
//
// Parsing lives apart from the hook that runs it so the grammar can be tested
// without a process, a transcript, or a config file.

const fs = require('fs');
const { getConfigPath, updateConfig } = require('../ponytail-config');
const { MODES, parseMode, parseUsd } = require('./policy');
const { reset } = require('./ledger');

// Matches the same prefixes the mode tracker accepts: `/ponytail`, `@ponytail`
// (Codex), `$ponytail`, and the `/ponytail:ponytail` plugin-namespaced form.
const INVOCATION = /^[/@$]ponytail(?::ponytail)?\s+spend\b/i;

// Returns null when the prompt is not a spend command, so the caller can fall
// straight through to metering.
function parseSpendCommand(prompt) {
  const text = String(prompt || '').trim();
  if (!INVOCATION.test(text)) return null;

  const args = text.split(/\s+/).slice(2);
  const verb = (args[0] || '').toLowerCase().replace(/[.!?]+$/, '');

  if (!verb || verb === 'status') return { action: 'status' };
  if (verb === 'reset' || verb === 'clear') return { action: 'reset' };
  if (verb === 'limit' || verb === 'budget') {
    const amount = parseUsd(args[1]);
    return amount
      ? { action: 'limit', amount }
      : { action: 'invalid', detail: 'limit needs a dollar amount, e.g. `/ponytail spend limit 5`' };
  }
  if (parseMode(verb)) return { action: 'mode', mode: parseMode(verb) };

  return { action: 'invalid', detail: 'unknown option "' + verb + '"' };
}

// The stored spend section, so a partial update keeps the keys it isn't
// touching. Resolved config can't be reused here: it has env overrides and
// defaults folded in, and writing those back would persist them by accident.
function readSpendSection() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8').replace(/^\uFEFF/, ''));
    const spend = config && config.spend;
    return spend && typeof spend === 'object' && !Array.isArray(spend) ? spend : {};
  } catch (e) {
    return {};
  }
}

// Applies a parsed command and returns the line to show the user. `status` is
// handled by the caller, which has the metered ledger this module doesn't.
function applySpendCommand(command, sessionId) {
  const spend = readSpendSection();

  if (command.action === 'reset') {
    reset(sessionId);
    return "PONYTAIL SPEND RESET — this session's counter is back to $0.00.";
  }

  if (command.action === 'limit') {
    updateConfig({ spend: { ...spend, limit: command.amount } });
    return 'PONYTAIL SPEND LIMIT SET — $' + command.amount.toFixed(2) +
      ' per session, saved to config. Mode: ' + (parseMode(spend.mode) || 'block') + '.';
  }

  if (command.action === 'mode') {
    updateConfig({ spend: { ...spend, mode: command.mode } });
    const explain = {
      off: 'metering continues, nothing is warned or blocked',
      warn: 'warns at the threshold and over the limit, never blocks',
      block: 'warns at the threshold, blocks at the limit',
    }[command.mode];
    return 'PONYTAIL SPEND MODE — ' + command.mode + ': ' + explain + '.';
  }

  return 'PONYTAIL SPEND — ' + (command.detail || 'unrecognized command') + '. Try: `/ponytail spend`, ' +
    '`/ponytail spend limit <usd>`, `/ponytail spend reset`, or `/ponytail spend ' +
    MODES.join('|') + '`.';
}

module.exports = { INVOCATION, applySpendCommand, parseSpendCommand };
