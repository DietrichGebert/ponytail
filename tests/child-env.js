// Environment for child processes in tests: only the variables a spawned
// node or shell needs, never the whole process.env. Copying the full
// environment would hand any credential in it to the hook under test, and the
// Claude plugin directory flags that as a credential read.
const KEYS = [
  'PATH', 'PATHEXT', 'SystemRoot', 'windir', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR',
  'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'XDG_CONFIG_HOME',
  'CREWCUT_DEFAULT_MODE',
];

function childEnv(overrides = {}) {
  const env = {};
  for (const key of KEYS) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return { ...env, ...overrides };
}

module.exports = { childEnv };
