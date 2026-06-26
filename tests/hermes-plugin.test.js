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

function python(script, env = {}) {
  const result = spawnSync('python3', ['-c', script], {
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
