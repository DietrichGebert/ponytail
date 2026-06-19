const setMode = (mode, ctx) => {
  const normalized = normalizePersistedMode(mode);
  if (!normalized) {
    ctx?.ui?.notify?.('Invalid mode provided.', 'error');
    return;
  }

  currentMode = normalized;
  pi.appendEntry('ponytail-mode', { mode: normalized });
  ctx?.ui?.notify?.(`Ponytail mode set to ${normalized}.`, 'info');
};