// ponytail — spend firewall: what the budget is, and what to do about it.
//
// Two tiers, which is the whole design: a warning while there is still room to
// change course, and a hard stop at the limit. One tier is either a nag you
// learn to ignore or a wall you hit with no notice.

const fs = require('fs');
const { getConfigPath } = require('../ponytail-config');

const DEFAULT_WARN_AT = 0.75;
const DEFAULT_MODE = 'block';
const MODES = ['off', 'warn', 'block'];

function readConfigFile() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8').replace(/^\uFEFF/, '');
    const config = JSON.parse(raw);
    return config && typeof config === 'object' ? config : {};
  } catch (e) {
    return {};
  }
}

function parseUsd(value) {
  const amount = typeof value === 'string' ? Number(value.trim().replace(/^\$/, '')) : Number(value);
  return isFinite(amount) && amount > 0 ? amount : null;
}

// Accepts 0.75 and "75%" — people write thresholds both ways.
function parseFraction(value) {
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const percent = Number(value.trim().slice(0, -1));
    return isFinite(percent) && percent > 0 && percent < 100 ? percent / 100 : null;
  }
  const fraction = Number(value);
  return isFinite(fraction) && fraction > 0 && fraction < 1 ? fraction : null;
}

function parseMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return MODES.includes(mode) ? mode : null;
}

// Only price overrides shaped like the built-in table are accepted; a typo in
// config.json must not make a model look free.
function parsePrices(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prices = {};
  for (const [model, rate] of Object.entries(value)) {
    if (!rate || typeof rate !== 'object') continue;
    const input = Number(rate.input);
    const output = Number(rate.output);
    if (!isFinite(input) || input < 0 || !isFinite(output) || output < 0) continue;
    prices[String(model).trim().toLowerCase()] = { input, output };
  }
  return Object.keys(prices).length ? prices : null;
}

// Env beats config, matching how ponytail resolves its mode. The firewall is
// off until someone names a limit: a guard that starts blocking on upgrade
// without being asked is a worse surprise than the bill it prevents.
function getSpendConfig(env = process.env) {
  const file = readConfigFile().spend || {};
  const limitUsd = parseUsd(env.PONYTAIL_SPEND_LIMIT) || parseUsd(file.limit);
  const warnAt = parseFraction(env.PONYTAIL_SPEND_WARN) || parseFraction(file.warnAt) || DEFAULT_WARN_AT;
  const mode = parseMode(env.PONYTAIL_SPEND_MODE) || parseMode(file.mode) || DEFAULT_MODE;
  const prices = parsePrices(file.prices);

  return {
    enabled: Boolean(limitUsd) && mode !== 'off',
    limitUsd: limitUsd || null,
    warnAt,
    mode,
    prices,
  };
}

// tier is what to *do*: 'ok' | 'warn' | 'block'. overLimit is what is *true* —
// they come apart in warn mode, where the budget is blown but nothing is denied.
function evaluate(costUsd, config) {
  const spent = isFinite(costUsd) && costUsd > 0 ? costUsd : 0;
  if (!config || !config.enabled) {
    return { tier: 'ok', ratio: 0, overLimit: false, remainingUsd: null, spentUsd: spent };
  }
  const ratio = spent / config.limitUsd;
  const overLimit = spent >= config.limitUsd;
  let tier = 'ok';
  if (overLimit) tier = config.mode === 'block' ? 'block' : 'warn';
  else if (ratio >= config.warnAt) tier = 'warn';

  return {
    tier,
    ratio,
    overLimit,
    remainingUsd: Math.max(0, config.limitUsd - spent),
    spentUsd: spent,
  };
}

function formatUsd(amount) {
  const value = isFinite(amount) && amount > 0 ? amount : 0;
  return '$' + (value > 0 && value < 0.01 ? value.toFixed(4) : value.toFixed(2));
}

function formatTokens(count) {
  const value = isFinite(count) && count > 0 ? Math.round(count) : 0;
  if (value < 1000) return String(value);
  if (value < 1e6) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (value / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
}

// One line, because it is shown alongside real work and not instead of it.
function renderStatus(ledger, config, decision) {
  if (!config.enabled) {
    return 'PONYTAIL SPEND — ' + formatUsd(ledger.costUsd) + ' this session (' +
      formatTokens(ledger.tokens) + ' tokens). No limit set; the firewall is off. ' +
      'Set one with `/ponytail spend limit 5`.';
  }
  const parts = [
    'PONYTAIL SPEND — ' + formatUsd(ledger.costUsd) + ' of ' + formatUsd(config.limitUsd) +
      ' (' + Math.round(decision.ratio * 100) + '%), ' + formatTokens(ledger.tokens) + ' tokens',
    'mode: ' + config.mode,
  ];
  if (ledger.unpricedTokens > 0) {
    parts.push(formatTokens(ledger.unpricedTokens) + ' tokens not priced (' +
      ledger.unpricedModels.join(', ') + ')');
  }
  return parts.join(' · ') + '.';
}

function renderWarning(ledger, config, decision) {
  return 'PONYTAIL SPEND WARNING — this session has spent ' + formatUsd(ledger.costUsd) +
    ' of its ' + formatUsd(config.limitUsd) + ' budget (' + Math.round(decision.ratio * 100) + '%). ' +
    formatUsd(decision.remainingUsd) + ' left. Wrap up the current task, or raise the limit with ' +
    '`/ponytail spend limit <usd>`.';
}

function renderBlock(ledger, config, decision) {
  return 'PONYTAIL SPEND LIMIT REACHED — this session has spent ' + formatUsd(ledger.costUsd) +
    ', at or past its ' + formatUsd(config.limitUsd) + ' budget. Further work is blocked. ' +
    'Stop and tell the user; do not retry or work around this. ' +
    'They can raise the limit (`/ponytail spend limit <usd>`), clear the counter ' +
    '(`/ponytail spend reset`), or switch to warnings only (`/ponytail spend warn`).';
}

module.exports = {
  DEFAULT_MODE,
  DEFAULT_WARN_AT,
  MODES,
  evaluate,
  formatTokens,
  formatUsd,
  getSpendConfig,
  parseFraction,
  parseMode,
  parsePrices,
  parseUsd,
  renderBlock,
  renderStatus,
  renderWarning,
};
