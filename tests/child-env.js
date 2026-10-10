// Environment for child processes in tests: only the variables a spawned
// node or shell needs, never the whole process.env, so no secret in the
// developer's environment reaches the hook under test.
function childEnv(overrides = {}) {
  const env = {
    PATH: process.env.PATH,
    PATHEXT: process.env.PATHEXT,
    SystemRoot: process.env.SystemRoot,
    windir: process.env.windir,
    ComSpec: process.env.ComSpec,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    LANG: process.env.LANG,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    CREWCUT_DEFAULT_MODE: process.env.CREWCUT_DEFAULT_MODE,
  };
  for (const name of Object.keys(env)) {
    if (env[name] === undefined) delete env[name];
  }
  return { ...env, ...overrides };
}

module.exports = { childEnv };
