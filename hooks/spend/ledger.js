// ponytail — spend firewall: the per-session ledger on disk.
//
// One JSON file per session under the ponytail config dir. Per-session files
// rather than one shared file because sessions run concurrently: two agents
// writing one document lose each other's writes, two agents writing their own
// files don't.

const fs = require('fs');
const path = require('path');
const { getConfigDir } = require('../ponytail-config');

const LEDGER_VERSION = 1;
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function ledgerDir() {
  return path.join(getConfigDir(), 'spend');
}

// Session ids come from the host agent, so they reach the filesystem untrusted.
// An allowlist keeps "../../.bashrc" from becoming a path.
function safeName(sessionId) {
  const cleaned = String(sessionId || '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'default';
}

function ledgerPath(sessionId) {
  return path.join(ledgerDir(), safeName(sessionId) + '.json');
}

function emptyLedger(sessionId) {
  return {
    version: LEDGER_VERSION,
    sessionId: sessionId || null,
    startedAt: new Date().toISOString(),
    offset: 0,
    seen: [],
    tokens: 0,
    costUsd: 0,
    unpricedTokens: 0,
    unpricedModels: [],
    // Highest tier the user has already been told about, so a warning is shown
    // once at the threshold instead of on every prompt after it.
    notifiedTier: 'ok',
  };
}

function load(sessionId) {
  try {
    const raw = fs.readFileSync(ledgerPath(sessionId), 'utf8').replace(/^\uFEFF/, '');
    const state = JSON.parse(raw);
    if (!state || typeof state !== 'object' || state.version !== LEDGER_VERSION) {
      return emptyLedger(sessionId);
    }
    return { ...emptyLedger(sessionId), ...state };
  } catch (e) {
    return emptyLedger(sessionId);
  }
}

// Write to a temp file and rename: a hook killed by its timeout mid-write
// leaves the previous ledger intact instead of a truncated one that reads as
// "$0 spent so far".
function save(sessionId, state) {
  try {
    const target = ledgerPath(sessionId);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = target + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }), 'utf8');
    fs.renameSync(temp, target);
    return true;
  } catch (e) {
    return false;
  }
}

function reset(sessionId) {
  const fresh = emptyLedger(sessionId);
  save(sessionId, fresh);
  return fresh;
}

// Sessions end without telling us, so old ledgers are swept on write rather
// than cleaned up on exit.
function prune(maxAgeMs = PRUNE_AFTER_MS) {
  let removed = 0;
  try {
    const dir = ledgerDir();
    const cutoff = Date.now() - maxAgeMs;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      try {
        if (fs.statSync(file).mtimeMs < cutoff) {
          fs.unlinkSync(file);
          removed++;
        }
      } catch (e) { /* raced with another hook — fine */ }
    }
  } catch (e) { /* no ledger dir yet */ }
  return removed;
}

module.exports = { LEDGER_VERSION, PRUNE_AFTER_MS, emptyLedger, ledgerDir, ledgerPath, load, prune, reset, safeName, save };
