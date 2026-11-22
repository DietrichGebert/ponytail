// Opt-in state never replaces the legacy shared flag.
const fs = require('fs');
const path = require('path');
const {createHash, randomBytes} = require('crypto');
const modes = new Set(['off', 'lite', 'full', 'ultra']);

function sessionMode(statePath, host, sessionID, project = '') {
  if (process.env.PONYTAIL_SESSION_SCOPE !== '1' ||
      !['codex', 'claude', 'grok', 'opencode'].includes(host) ||
      typeof sessionID !== 'string' || !sessionID.trim() || sessionID.length > 512) return null;
  const key = createHash('sha256').update(JSON.stringify([
    host, project ? path.normalize(project) : '', sessionID.trim(),
  ])).digest('hex');
  const file = path.join(path.dirname(statePath), '.ponytail-sessions', key);
  function write(mode, initial = false) {
    if (!modes.has(mode)) return;
    fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
    const temp = file + '.' + process.pid + '.' + randomBytes(6).toString('hex') + '.tmp';
    try {
      fs.writeFileSync(temp, mode, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
      if (initial) {
        // Publish complete bytes only if no command or initializer won first.
        try { fs.linkSync(temp, file); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      } else fs.renameSync(temp, file);
    } finally {
      try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  function read(defaultMode) {
    try {
      const mode = fs.readFileSync(file, 'utf8').trim();
      if (modes.has(mode)) return mode;
      write(defaultMode);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      write(defaultMode, true);
    }
    return fs.readFileSync(file, 'utf8').trim();
  }
  return {read, write};
}
module.exports = {sessionMode};
