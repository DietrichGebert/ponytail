const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

for (const scenario of ['blocked', 'failed', 'oversized', 'successful', 'disabled']) {
  test(`SessionStart preserves instructions when the optional map is ${scenario}`, (t) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail activation '));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const hooks = path.join(temp, 'plugin', 'hooks');
    const workspace = path.join(temp, 'workspace');
    fs.cpSync(path.join(root, 'hooks'), hooks, { recursive: true });
    fs.cpSync(path.join(root, 'skills'), path.join(temp, 'plugin', 'skills'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'lib', 'helper.js'), 'export function usefulHelper() {}');

    if (scenario !== 'successful') {
      const body = {
        blocked: 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000); return "";',
        failed: 'throw new Error("map unavailable");',
        oversized: 'return "x".repeat(100000);',
        disabled: 'require("node:fs").writeFileSync("map-ran", "yes"); return "unexpected map";',
      }[scenario];
      fs.writeFileSync(path.join(hooks, 'ponytail-map.js'),
        `exports.buildMap = () => { ${body} };\n` +
        'if (require.main === module) process.stdout.write(exports.buildMap());\n');
    }

    const result = spawnSync(process.execPath, [path.join(hooks, 'ponytail-activate.js')], {
      cwd: workspace,
      input: '',
      encoding: 'utf8',
      timeout: 4000,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: path.join(temp, 'claude'),
        CLAUDE_PROJECT_DIR: '',
        PLUGIN_DATA: path.join(temp, 'state'),
        COPILOT_PLUGIN_DATA: '',
        XDG_CONFIG_HOME: path.join(temp, 'config'),
        PONYTAIL_DEFAULT_MODE: 'full',
        PONYTAIL_MAP: scenario === 'disabled' ? '0' : '1',
      },
    });
    assert.equal(result.error, undefined, 'optional mapping must finish before the hook timeout');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.hookEventName, 'SessionStart');
    assert.match(output.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);
    assert.match(output.additionalContext, /Never cut:/);
    if (scenario === 'successful') {
      assert.match(output.additionalContext, /Codebase map[^]*lib\/: usefulHelper/);
    } else {
      assert.doesNotMatch(output.additionalContext, /Codebase map|unexpected map|x{1000}/);
    }
    assert.equal(fs.existsSync(path.join(workspace, 'map-ran')), false);
  });
}
