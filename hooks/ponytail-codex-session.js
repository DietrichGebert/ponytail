#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { normalizeMode } = require('./ponytail-config');
const {
  getCodexActivation,
  getCodexBaseHash,
  getCodexControlInstructions,
} = require('./ponytail-instructions');

const STATE_VERSION = 1;
const HASH_RE = /^[a-f0-9]{64}$/;

function normalizeSessionId(sessionId) {
  if (typeof sessionId !== 'string') return null;
  const normalized = sessionId.trim();
  return normalized && normalized.length <= 4096 ? normalized : null;
}

function getSessionStatePath(sessionId) {
  const normalized = normalizeSessionId(sessionId);
  const dataDir = process.env.PLUGIN_DATA;
  if (!normalized || !dataDir) return null;
  const digest = crypto.createHash('sha256').update(normalized).digest('hex');
  return path.join(dataDir, 'sessions', digest + '.json');
}

function normalizeState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mode = normalizeMode(value.mode);
  const baseHash = value.baseHash === null || value.baseHash === undefined
    ? null
    : typeof value.baseHash === 'string' ? value.baseHash.toLowerCase() : false;
  if (
    value.version !== STATE_VERSION ||
    !mode ||
    !Number.isSafeInteger(value.generation) || value.generation < 1 ||
    !Number.isSafeInteger(value.revision) || value.revision < 0 ||
    (baseHash !== null && !HASH_RE.test(baseHash))
  ) return null;
  return {
    version: STATE_VERSION,
    mode,
    generation: value.generation,
    revision: value.revision,
    baseHash,
  };
}

function createState(mode, generation = 1, revision = 0) {
  return {
    version: STATE_VERSION,
    mode: normalizeMode(mode) || 'off',
    generation,
    revision,
    baseHash: null,
  };
}

function createRecoveryState(mode) {
  // ponytail: a wall-clock epoch outranks normal counters but not clock rollback
  // or forged future generations; persist a monotonic epoch outside session state
  // if either becomes a real failure mode.
  return createState(mode, Date.now());
}

function readSessionState(sessionId) {
  const statePath = getSessionStatePath(sessionId);
  if (!statePath) return null;
  try {
    return normalizeState(JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '')));
  } catch (_) {
    return null;
  }
}

function writeSessionState(sessionId, state) {
  const statePath = getSessionStatePath(sessionId);
  const normalized = normalizeState(state);
  if (!statePath || !normalized) return false;

  let temporaryPath;
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    temporaryPath = statePath + '.' + process.pid + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
    fs.writeFileSync(temporaryPath, JSON.stringify(normalized), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, statePath);
    return true;
  } catch (_) {
    if (temporaryPath) try { fs.unlinkSync(temporaryPath); } catch (_) {}
    return false;
  }
}

function activateState(state) {
  const baseHash = getCodexBaseHash();
  state.baseHash = baseHash;
  return getCodexActivation(state.mode, state.generation, state.revision);
}

function startSession(sessionId, source, defaultMode) {
  if (!getSessionStatePath(sessionId)) return null;

  const configuredMode = normalizeMode(defaultMode) || 'off';
  const previous = readSessionState(sessionId);
  let state;
  let context = '';
  let changed = true;

  switch (source) {
    case 'resume':
      if (!previous) {
        state = createRecoveryState(configuredMode);
        context = state.mode === 'off'
          ? getCodexControlInstructions('off', state.generation, state.revision)
          : activateState(state);
      } else {
        state = previous;
        if (state.mode !== 'off' && state.baseHash !== getCodexBaseHash()) {
          context = activateState(state);
        } else changed = false;
      }
      break;
    case 'clear':
      state = createState(configuredMode, previous ? previous.generation + 1 : 1);
      if (state.mode !== 'off') context = activateState(state);
      break;
    case 'compact':
      state = previous || createState(configuredMode);
      if (previous) state.generation += 1;
      state.baseHash = null;
      if (state.mode !== 'off') context = activateState(state);
      break;
    case 'startup':
    default:
      state = createState(configuredMode);
      if (state.mode !== 'off') context = activateState(state);
      break;
  }

  if (changed && !writeSessionState(sessionId, state)) return null;
  return { context, mode: state.mode, state };
}

function transitionSessionMode(sessionId, requestedMode, defaultMode) {
  if (!getSessionStatePath(sessionId)) return null;
  const targetMode = normalizeMode(requestedMode);
  if (!targetMode) return null;

  const previous = readSessionState(sessionId);
  const current = previous || createRecoveryState(defaultMode);
  let context = '';
  let changed = !previous;

  if (!previous && targetMode === 'off') {
    context = getCodexControlInstructions('off', current.generation, current.revision);
  } else if (current.mode !== targetMode) {
    changed = true;
    current.mode = targetMode;
    current.revision += 1;
    if (targetMode === 'off') {
      context = getCodexControlInstructions('off', current.generation, current.revision);
    } else if (current.baseHash === getCodexBaseHash()) {
      context = getCodexControlInstructions(targetMode, current.generation, current.revision);
    } else {
      context = activateState(current);
    }
  } else if (targetMode !== 'off' && current.baseHash !== getCodexBaseHash()) {
    changed = true;
    context = activateState(current);
  }

  if (changed && !writeSessionState(sessionId, current)) return null;
  return { context, mode: current.mode, state: current };
}

function repairSession(sessionId, defaultMode, options = {}) {
  if (!getSessionStatePath(sessionId)) return null;
  let state = readSessionState(sessionId);
  let context = '';
  let changed = false;

  if (!state) {
    if (options.initialize === false) return null;
    state = createRecoveryState(defaultMode);
    changed = true;
    context = state.mode === 'off'
      ? getCodexControlInstructions('off', state.generation, state.revision)
      : activateState(state);
  } else if (state.mode !== 'off' && state.baseHash !== getCodexBaseHash()) {
    changed = true;
    context = activateState(state);
  }

  if (changed && !writeSessionState(sessionId, state)) return null;
  return { context, mode: state.mode, state };
}

function getSubagentActivation(sessionId) {
  const state = readSessionState(sessionId);
  if (!state || state.mode === 'off') return null;
  return {
    context: getCodexActivation(state.mode, state.generation, state.revision),
    mode: state.mode,
    state,
  };
}

module.exports = {
  STATE_VERSION,
  createState,
  getSessionStatePath,
  getSubagentActivation,
  normalizeSessionId,
  readSessionState,
  repairSession,
  startSession,
  transitionSessionMode,
  writeSessionState,
};
