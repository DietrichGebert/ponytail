#!/usr/bin/env node
// Review markers are kept outside repositories so the gate works everywhere.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getConfigDir } = require('./ponytail-config');

const statePath = () => process.env.PONYTAIL_REVIEW_STATE_PATH || path.join(getConfigDir(), 'review-state.json');
const git = (cwd, args) => {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.error || result.status !== 0 ? null : result.stdout;
};

function snapshot(cwd) {
  if (typeof cwd !== 'string' || !cwd.trim()) return null;
  const root = (git(cwd, ['rev-parse', '--show-toplevel']) || '').trim();
  const diff = git(cwd, ['diff', 'HEAD', '--binary']) || git(cwd, ['diff', '--binary']);
  if (!root || diff === null) return null;
  let resolvedRoot;
  try { resolvedRoot = fs.realpathSync.native(root); } catch (_) { resolvedRoot = path.resolve(root); }
  const hash = crypto.createHash('sha256').update(diff);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (untracked === null) return null;
  for (const name of untracked.split('\0').filter(Boolean)) {
    try {
      hash.update('\0' + name + '\0');
      hash.update(fs.readFileSync(path.join(resolvedRoot, name)));
    } catch (_) { return null; }
  }
  return {
    root: resolvedRoot,
    fingerprint: hash.digest('hex'),
  };
}

function read() {
  try {
    const value = JSON.parse(fs.readFileSync(statePath(), 'utf8').replace(/^\uFEFF/, ''));
    return value && Array.isArray(value.reviews) ? value : { version: 1, reviews: [] };
  } catch (_) {
    return { version: 1, reviews: [] };
  }
}

function write(value) {
  const target = statePath();
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, target);
}

const session = value => typeof value === 'string' ? value.trim() : '';

function markReview(cwd, sessionId) {
  const current = snapshot(cwd);
  if (!current) return false;
  const id = session(sessionId);
  const state = read();
  state.version = 1;
  state.reviews = [
    { ...current, session_id: id, reviewed_at: new Date().toISOString() },
    ...state.reviews.filter(item => !(item && item.root === current.root && session(item.session_id) === id)),
  ].slice(0, 64);
  write(state);
  return true;
}

function hasFreshReview(cwd, sessionId) {
  const current = snapshot(cwd);
  if (!current) return false;
  const id = session(sessionId);
  return read().reviews.some(item => item && item.root === current.root && item.fingerprint === current.fingerprint && session(item.session_id) === id);
}

module.exports = { hasFreshReview, markReview, snapshot, statePath };
