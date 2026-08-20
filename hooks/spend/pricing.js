// ponytail — spend firewall: model rates and cost math. Pure, no I/O.
//
// Rates are USD per 1M tokens, list price. Cache tokens are priced off the
// model's input rate by a multiplier rather than getting their own columns:
// that is how the vendors quote them, and it means a new model only ever needs
// one row here.

// Anthropic list prices (USD / 1M tokens).
const RATES = {
  'claude-fable-5': { input: 10, output: 50 },
  'claude-mythos-5': { input: 10, output: 50 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

// Applied to the model's input rate.
const CACHE_WRITE_5M = 1.25;
const CACHE_WRITE_1H = 2;
const CACHE_READ = 0.1;

// Last-resort rate when the exact id is unknown: a model called "...opus..."
// bills like an opus. Better a right-order-of-magnitude number than counting a
// new release as free.
const FAMILIES = [
  ['fable', { input: 10, output: 50 }],
  ['mythos', { input: 10, output: 50 }],
  ['opus', { input: 5, output: 25 }],
  ['sonnet', { input: 3, output: 15 }],
  ['haiku', { input: 1, output: 5 }],
];

// Strip what the gateways bolt on: bedrock's "us.anthropic." region+vendor
// prefix, vertex's "@20260101" version separator, and the dated snapshot
// suffix. All three name the same model at the same price.
function normalizeModel(model) {
  if (typeof model !== 'string') return '';
  return model
    .trim()
    .toLowerCase()
    .replace(/^(?:[a-z]{2,6}\.)?anthropic\./, '')
    .replace(/@.*$/, '')
    .replace(/-\d{8}$/, '');
}

// Exact id, then a known id it extends ("claude-opus-5-fast"), then the family.
// Returns null for a genuinely unrecognizable model so the caller can report
// the tokens as unpriced instead of silently valuing them at zero.
function resolveRate(model, overrides) {
  const id = normalizeModel(model);
  if (!id) return null;
  if (overrides && overrides[id]) return overrides[id];
  if (RATES[id]) return RATES[id];

  const prefix = Object.keys(RATES)
    .filter((known) => id.startsWith(known))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix) return RATES[prefix];

  const family = FAMILIES.find(([name]) => id.includes(name));
  return family ? family[1] : null;
}

function num(value) {
  return typeof value === 'number' && isFinite(value) && value > 0 ? value : 0;
}

// Total billable tokens in one usage block. Cache reads count: they are cheap,
// not free, and a loop that re-reads a 200k-token cache every turn is exactly
// the runaway this guard exists to catch.
function tokensOf(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  return num(usage.input_tokens) +
    num(usage.output_tokens) +
    num(usage.cache_creation_input_tokens) +
    num(usage.cache_read_input_tokens);
}

function costOf(usage, rate) {
  if (!usage || typeof usage !== 'object' || !rate) return 0;

  // The 5m/1h split is only present on newer transcripts; without it the flat
  // cache_creation_input_tokens is priced at the 5m rate, which is what a
  // request that never asked for a 1h TTL actually paid.
  const breakdown = usage.cache_creation;
  let write5m = num(usage.cache_creation_input_tokens);
  let write1h = 0;
  if (breakdown && typeof breakdown === 'object') {
    write5m = num(breakdown.ephemeral_5m_input_tokens);
    write1h = num(breakdown.ephemeral_1h_input_tokens);
  }

  const inputUsd = rate.input * (
    num(usage.input_tokens) +
    write5m * CACHE_WRITE_5M +
    write1h * CACHE_WRITE_1H +
    num(usage.cache_read_input_tokens) * CACHE_READ
  );
  return (inputUsd + rate.output * num(usage.output_tokens)) / 1e6;
}

module.exports = {
  RATES,
  CACHE_WRITE_5M,
  CACHE_WRITE_1H,
  CACHE_READ,
  normalizeModel,
  resolveRate,
  tokensOf,
  costOf,
};
