const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildMap } = require('../hooks/ponytail-map');

function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-ts-modules-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

for (const ext of ['mts', 'cts', 'ts']) {
  test(`buildMap lists ${ext} source exports and excludes tests and declarations`, t => {
    const dir = workspace(t);
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.writeFileSync(path.join(dir, 'lib', `source.${ext}`),
      'export function reusableHelper() {}\nexport interface SharedValue {}\n');
    for (const name of [`source.test.${ext}`, `source.spec.${ext}`, `source.d.${ext}`]) {
      fs.writeFileSync(path.join(dir, 'lib', name), 'export const excluded = 1;\n');
    }
    const map = buildMap(dir);
    assert.match(map, /lib\/: reusableHelper, SharedValue/);
    assert.doesNotMatch(map, /excluded/);
  });
}

test('SessionStart injects the map of a tracked TypeScript ESM project', t => {
  const dir = workspace(t);
  const project = path.join(dir, 'project');
  fs.mkdirSync(path.join(project, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(project, 'lib', 'service.mts'), 'export function trackedService() {}\n');
  for (const args of [['init', '-q'], ['add', 'lib/service.mts']]) {
    const result = spawnSync('git', args, { cwd: project, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const result = spawnSync(process.execPath, [path.join(__dirname, '../hooks/ponytail-activate.js')], {
    cwd: project, input: '', encoding: 'utf8', timeout: 5000,
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(dir, 'claude'),
      CLAUDE_PROJECT_DIR: '', PLUGIN_DATA: path.join(dir, 'state'), COPILOT_PLUGIN_DATA: '',
      XDG_CONFIG_HOME: path.join(dir, 'config'), PONYTAIL_DEFAULT_MODE: 'full', PONYTAIL_MAP: '1' },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(output.hookEventName, 'SessionStart');
  assert.match(output.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(output.additionalContext, /Codebase map[^]*lib\/: trackedService/);
});
