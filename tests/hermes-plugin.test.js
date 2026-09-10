#!/usr/bin/env node
// Hermes support is a real plugin, not just copied rules: the repo root must be
// installable with `hermes plugins install owner/repo`, register bundled skills,
// inject active mode context, and expose slash commands.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const commands = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'];
const skillCommands = commands.filter((name) => name !== 'ponytail');

const root = path.join(__dirname, '..');

// ponytail: probe once; on Windows `python3` is the Store-alias stub that fails
// even when Python is installed, so fall back to `python` (mirrors benchmarks/correctness.js).
let pythonCmd;
function pythonExe() {
  if (pythonCmd) return pythonCmd;
  for (const cmd of ['python3', 'python']) {
    if (spawnSync(cmd, ['-c', 'import sys'], { encoding: 'utf8' }).status === 0) {
      return (pythonCmd = cmd);
    }
  }
  return (pythonCmd = 'python3');
}

function python(script, env = {}) {
  const result = spawnSync(pythonExe(), ['-c', script], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`python failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

test('Hermes plugin manifest matches runtime skills, hooks, commands, and package version', () => {
  const manifestPath = path.join(root, 'plugin.yaml');
  assert.ok(fs.existsSync(manifestPath), 'missing root plugin.yaml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const skillDirs = fs.readdirSync(path.join(root, 'skills'))
    .filter((name) => fs.existsSync(path.join(root, 'skills', name, 'SKILL.md')))
    .sort();

  assert.match(manifest, /^name:\s*ponytail$/m);
  assert.match(manifest, new RegExp(`^version:\\s*${packageJson.version}$`, 'm'));
  assert.match(manifest, new RegExp(`^author:\\s*${packageJson.author.name}$`, 'm'));
  assert.deepEqual(commands.filter((name) => manifest.includes(`  - ${name}`)), commands);
  assert.deepEqual(skillDirs.filter((name) => manifest.includes(`  - ${name}`)), skillDirs);
  assert.match(manifest, /pre_llm_call/);
  assert.match(manifest, /pre_gateway_dispatch/);
});

test('Hermes plugin registers every shipped skill under the ponytail namespace', () => {
  const output = python(String.raw`
import importlib.util, json, pathlib
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class Ctx:
    def __init__(self):
        self.skills = []
        self.hooks = []
        self.commands = []
    def register_skill(self, name, path):
        self.skills.append((name, pathlib.Path(path).as_posix()))
    def register_hook(self, name, handler):
        self.hooks.append(name)
    def register_command(self, name, handler, description='', args_hint=''):
        self.commands.append(name)
ctx = Ctx()
mod.register(ctx)
print(json.dumps({'skills': ctx.skills, 'hooks': ctx.hooks, 'commands': ctx.commands}, sort_keys=True))
`);
  const data = JSON.parse(output);
  assert.deepEqual(data.skills.map(([name]) => name).sort(), [
    'ponytail',
    'ponytail-audit',
    'ponytail-debt',
    'ponytail-gain',
    'ponytail-help',
    'ponytail-review',
  ]);
  assert.ok(data.skills.every(([, skillPath]) => skillPath.endsWith('/SKILL.md')));
  assert.ok(data.hooks.includes('pre_llm_call'));
  assert.ok(data.commands.includes('ponytail'));
  assert.ok(data.commands.includes('ponytail-review'));
});

test('Hermes plugin builds mode-aware injected context from the canonical skill', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-config-'));
  const output = python(String.raw`
import importlib.util, json
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
ctx = mod.build_injected_context('ultra')
print(json.dumps({'ctx': ctx}))
`, { XDG_CONFIG_HOME: tmp });
  const { ctx } = JSON.parse(output);

  assert.match(ctx, /PONYTAIL MODE ACTIVE — level: ultra/);
  assert.match(ctx, /The best\s+code is the code never written/);
  assert.match(ctx, /ultra/i);
  assert.doesNotMatch(ctx, /^---/);
  assert.doesNotMatch(ctx, /\|\s*\*\*Lite\*\*/i);
});

test('Hermes mode config respects env, config file, off, and invalid command behavior', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-config-'));
  fs.mkdirSync(path.join(tmp, 'ponytail'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'ponytail', 'config.json'), JSON.stringify({ defaultMode: 'lite' }));
  const output = python(String.raw`
import importlib.util, json
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class Ctx:
    def __init__(self): self.commands = {}
    def register_skill(self, name, path): pass
    def register_hook(self, name, handler): pass
    def register_command(self, name, handler, description='', args_hint=''):
        self.commands[name] = handler
ctx = Ctx()
mod.register(ctx)
status_before = ctx.commands['ponytail']('')
invalid = ctx.commands['ponytail']('maximum')
status_after = ctx.commands['ponytail']('')
print(json.dumps({
    'default': mod.build_injected_context(None),
    'off': mod.build_injected_context('off'),
    'status_before': status_before,
    'invalid': invalid,
    'status_after': status_after,
}))
`, { XDG_CONFIG_HOME: tmp, PONYTAIL_DEFAULT_MODE: 'ultra' });
  const data = JSON.parse(output);
  assert.match(data.default, /level: ultra/);
  assert.equal(data.off, '');
  assert.match(data.status_before, /Ponytail mode: ultra/);
  assert.match(data.invalid, /Usage:/);
  assert.match(data.status_after, /Ponytail mode: ultra/);
});

test('Hermes plugin review mode injects the real review skill body', () => {
  const output = python(String.raw`
import importlib.util, json
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
ctx = mod.build_injected_context('review')
print(json.dumps({'ctx': ctx}))
`);
  const { ctx } = JSON.parse(output);
  assert.match(ctx, /PONYTAIL MODE ACTIVE — level: review/);
  assert.match(ctx, /Review diffs for unnecessary complexity/);
  assert.match(ctx, /net: -<N> lines possible/);
  assert.doesNotMatch(ctx, /^---/);
});

test('Hermes /ponytail command changes mode and pre_llm_call injects current context', () => {
  const output = python(String.raw`
import importlib.util, json
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class Ctx:
    def __init__(self):
        self.hooks = {}
        self.commands = {}
    def register_skill(self, name, path): pass
    def register_hook(self, name, handler): self.hooks[name] = handler
    def register_command(self, name, handler, description='', args_hint=''):
        self.commands[name] = handler
ctx = Ctx()
mod.register(ctx)
message = ctx.commands['ponytail']('ultra')
injected = ctx.hooks['pre_llm_call'](session_id='s1', user_message='build it', conversation_history=[], is_first_turn=False, model='m', platform='cli')
print(json.dumps({'message': message, 'context': injected['context']}))
`);
  const data = JSON.parse(output);
  assert.match(data.message, /ultra/);
  assert.match(data.context, /PONYTAIL MODE ACTIVE — level: ultra/);
});

test('Hermes gateway rewrite respects slash access denial', () => {
  const output = python(String.raw`
import importlib.util, json
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class Source:
    platform = None
    chat_id = 'c1'
    user_id = 'u1'
class Event:
    text = '/ponytail-review src/app.js'
    source = Source()
class Gateway:
    def _check_slash_access(self, source, command):
        return 'denied'
result = mod.rewrite_gateway_command(event=Event(), gateway=Gateway())
print(json.dumps(result))
`);
  assert.equal(output, 'null');
});

test('Hermes gateway rewrite preserves every skill command and ignores unrelated text', () => {
  const output = python(String.raw`
import importlib.util, json
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class Event:
    def __init__(self, text): self.text = text
cases = {}
for text in ['/ponytail-review x', '/ponytail_audit repo', '/ponytail-debt', '/ponytail-help', '/status', 'hello']:
    cases[text] = mod.rewrite_gateway_command(event=Event(text))
print(json.dumps(cases, sort_keys=True))
`);
  const data = JSON.parse(output);
  assert.match(data['/ponytail-review x'].text, /ponytail-review/);
  assert.match(data['/ponytail_audit repo'].text, /ponytail-audit/);
  assert.match(data['/ponytail_audit repo'].text, /repo/);
  assert.match(data['/ponytail-debt'].text, /ponytail-debt/);
  assert.match(data['/ponytail-help'].text, /ponytail-help/);
  assert.equal(data['/status'], null);
  assert.equal(data.hello, null);
});

test('Hermes Python filter matches the JS filter byte-for-byte for every level (parity, #664)', () => {
  // KTD2/R7 hard gate: the two filters must never silently fork again. Run the
  // JS filter and the Python mirror over the same canonical SKILL.md for all
  // three levels and assert identical (trailing-whitespace-normalized) output.
  const skillPath = path.join(root, 'skills', 'ponytail', 'SKILL.md');
  const skillBody = fs.readFileSync(skillPath, 'utf8');
  const { filterSkillBodyForMode } = require('../hooks/ponytail-instructions');

  // Feed the canonical body to the Python filter via stdin (the python()
  // helper runs `python -c`, so pass the body through the child's stdin).
  const pyJson = spawnSync(pythonExe(), ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
body = sys.stdin.read()
print(json.dumps({m: mod._filter_skill_body_for_mode(body, m) for m in ['lite', 'full', 'ultra']}))
`], { cwd: root, input: skillBody, encoding: 'utf8' });
  assert.equal(pyJson.status, 0, pyJson.stderr);
  const py = JSON.parse(pyJson.stdout);

  for (const m of ['lite', 'full', 'ultra']) {
    const jsOut = filterSkillBodyForMode(skillBody, m).replace(/\s+$/, '');
    const pyOutFor = py[m].replace(/\s+$/, '');
    assert.equal(
      pyOutFor,
      jsOut,
      `Hermes Python filter output must match the JS filter for level ${m} (#664)`,
    );
    // The active level's block is present; the other levels' blocks are absent.
    assert.match(jsOut, new RegExp(`\\*\\*${m} —`));
    for (const other of ['lite', 'full', 'ultra']) {
      if (other !== m) assert.doesNotMatch(jsOut, new RegExp(`\\*\\*${other} —`));
    }
  }

  // KTD2 fallback parity (#4): the stateless line-drop fallback only fires on
  // content OUTSIDE mode blocks. Every mode-labeled row/example in the
  // canonical SKILL.md now lives inside a gated block, so the canonical body
  // above never exercises the fallback — a JS/Python fork there would go
  // undetected. Feed a synthetic blockless fixture through both filters and
  // assert identical keep/drop behavior for every level.
  const blocklessFixture = [
    '| **lite** | keep lite |',
    '| **ultra** | keep ultra |',
    '- lite: "Lite example"',
    '- ultra: "Ultra example"',
    '- Full: do not confuse this rule label with the mode name.',
  ].join('\n');

  const pyFixtureJson = spawnSync(pythonExe(), ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('ponytail_hermes_plugin', '__init__.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
body = sys.stdin.read()
print(json.dumps({m: mod._filter_skill_body_for_mode(body, m) for m in ['lite', 'full', 'ultra']}))
`], { cwd: root, input: blocklessFixture, encoding: 'utf8' });
  assert.equal(pyFixtureJson.status, 0, pyFixtureJson.stderr);
  const pyFixture = JSON.parse(pyFixtureJson.stdout);

  for (const m of ['lite', 'full', 'ultra']) {
    const jsOut = filterSkillBodyForMode(blocklessFixture, m).replace(/\s+$/, '');
    const pyOutFor = pyFixture[m].replace(/\s+$/, '');
    assert.equal(
      pyOutFor,
      jsOut,
      `Hermes Python filter fallback must match the JS filter fallback for level ${m} (#4)`,
    );
    // Expected keep/drop on the blockless fixture: a bold table row or quoted
    // worked example labeled with the effective mode survives; other levels'
    // are dropped; the unquoted rule bullet survives every mode.
    assert.equal(
      jsOut.includes('| **lite** |'), m === 'lite',
      `lite row must ${m === 'lite' ? 'survive' : 'be dropped'} in level ${m}`,
    );
    assert.equal(
      jsOut.includes('| **ultra** |'), m === 'ultra',
      `ultra row must ${m === 'ultra' ? 'survive' : 'be dropped'} in level ${m}`,
    );
    assert.equal(
      jsOut.includes('- lite: "Lite example"'), m === 'lite',
      `lite example must ${m === 'lite' ? 'survive' : 'be dropped'} in level ${m}`,
    );
    assert.equal(
      jsOut.includes('- ultra: "Ultra example"'), m === 'ultra',
      `ultra example must ${m === 'ultra' ? 'survive' : 'be dropped'} in level ${m}`,
    );
    assert.ok(
      jsOut.includes('- Full: do not confuse this rule label with the mode name.'),
      `unquoted rule bullet must survive in level ${m}`,
    );
  }
});
