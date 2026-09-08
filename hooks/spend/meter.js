// ponytail — spend firewall: turns new transcript bytes into a running total.
// The one place transcript reading, pricing, and the ledger meet.

const { costOf, resolveRate, tokensOf } = require('./pricing');
const { load, prune, save } = require('./ledger');
const { readUsageSince } = require('./transcript');

// Reads whatever the agent has appended since the last call, prices it, and
// persists the new total. Returns the ledger either way, so a caller can report
// a session's spend without caring whether anything moved.
function meter(sessionId, transcriptPath, config = {}) {
  const ledger = load(sessionId);
  const firstRead = ledger.offset === 0;
  const { offset, seen, records } = readUsageSince(transcriptPath, ledger);

  if (!records.length && offset === ledger.offset) return ledger;

  const unpriced = new Set(ledger.unpricedModels);
  for (const record of records) {
    const tokens = tokensOf(record.usage);
    ledger.tokens += tokens;

    const rate = resolveRate(record.model, config.prices);
    if (rate) {
      ledger.costUsd += costOf(record.usage, rate);
    } else {
      // A model no table knows — a local or self-hosted one. Its tokens are
      // still counted and surfaced, so the total never silently reads low.
      ledger.unpricedTokens += tokens;
      if (record.model) unpriced.add(String(record.model));
    }
  }

  ledger.offset = offset;
  ledger.seen = seen;
  ledger.unpricedModels = [...unpriced].slice(0, 8);
  save(sessionId, ledger);

  // Sessions never announce their end, so old ledgers are swept once per
  // session instead of on exit.
  if (firstRead) prune();
  return ledger;
}

module.exports = { meter };
