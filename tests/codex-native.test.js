import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Codex uses adaptive instructions without lifecycle hooks', () => {
  const codex = JSON.parse(read('.codex-plugin/plugin.json'));
  const claude = JSON.parse(read('.claude-plugin/plugin.json'));
  const skill = read('skills/ponytail/SKILL.md');
  assert.equal(codex.hooks, undefined);
  assert.deepEqual(codex.interface.capabilities, ['Instructions']);
  assert.equal(claude.hooks, './hooks/claude-codex-hooks.json');
  for (const clause of ['adaptive', 'Ultra', 'never automatically', 'proportional', 'in this codebase', 'security', 'accessibility']) assert.match(skill, new RegExp(clause, 'i'));
  for (const bad of ['ACTIVE EVERY RESPONSE', 'Code first.', 'at most three short lines', 'Ship the lazy version and question']) assert.doesNotMatch(skill, new RegExp(bad, 'i'));
  for (const file of ['ponytail-help', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain']) assert.ok(fs.existsSync(new URL(`../skills/${file}/SKILL.md`, import.meta.url)));
});

test('installed Codex discovers Ponytail through the native skills namespace', { skip: !process.env.PONYTAIL_TEST_CODEX, timeout: 30000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-codex-'));
  const codexHome = path.join(root, 'codex-home');
  const home = path.join(root, 'home');
  const marketplace = path.join(root, 'marketplace');
  fs.mkdirSync(path.join(marketplace, '.agents', 'plugins'), { recursive: true });
  fs.cpSync(new URL('..', import.meta.url), path.join(marketplace, 'ponytail'), { recursive: true, filter: source => !source.includes(`${path.sep}.git${path.sep}`) && !source.includes(`${path.sep}node_modules${path.sep}`) });
  fs.writeFileSync(path.join(marketplace, '.agents', 'plugins', 'marketplace.json'), JSON.stringify({ name: 'test', plugins: [{ name: 'ponytail', source: { source: 'local', path: './ponytail' } }] }));
  fs.mkdirSync(codexHome, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  const pathBin = process.env.PATH.split(path.delimiter).map(dir => path.join(dir, 'codex')).find(candidate => { try { return fs.statSync(candidate).isFile(); } catch { return false; } });
  const bin = process.env.CODEX_BIN ? path.resolve(process.env.CODEX_BIN) : (pathBin && fs.realpathSync(pathBin));
  assert.ok(bin && path.isAbsolute(bin), 'CODEX_BIN or an absolute Codex binary is required');
  const run = (args) => new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: { ...process.env, CODEX_HOME: codexHome, HOME: home, CODEX_DISABLE_UPDATE_CHECK: '1' }, cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`Codex timed out: ${stderr}`)); }, 15000);
    child.on('error', reject); child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error(`Codex exited ${code}: ${stderr}`)); });
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await run(['plugin', 'marketplace', 'add', marketplace]);
  await run(['plugin', 'add', 'ponytail@test']);
  const server = spawn(bin, ['app-server', '--stdio'], { env: { ...process.env, CODEX_HOME: codexHome, HOME: home, CODEX_DISABLE_UPDATE_CHECK: '1' }, cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '', errors = ''; const messages = [];
  server.stderr.on('data', chunk => { errors += chunk; });
  server.stdout.on('data', chunk => { buffer += chunk; for (const line of buffer.split('\n').slice(0, -1)) { try { messages.push(JSON.parse(line)); } catch {} } buffer = buffer.slice(buffer.lastIndexOf('\n') + 1); });
  const send = (method, params, id) => server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  send('initialize', { clientInfo: { name: 'ponytail-test', version: '1' }, capabilities: {} }, 1); send('initialized', {}, 2); send('skills/list', { cwds: [root], forceReload: true }, 3);
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`app-server timed out: ${errors}`)), 15000); const check = () => messages.some(message => message.id === 3) ? (clearTimeout(timer), resolve()) : setTimeout(check, 25); check(); });
  server.kill('SIGTERM');
  const result = messages.find(message => message.id === 3).result;
  const skill = (result.data || []).flatMap(entry => entry.skills || []).find(entry => entry.name === 'ponytail:ponytail');
  assert.ok(skill, 'ponytail skill must be returned');
  assert.equal(skill.enabled, true);
  assert.equal(skill.name, 'ponytail:ponytail');
  assert.match(skill.description, /adaptive|smallest correct/i);
  assert.ok(path.resolve(skill.path).startsWith(path.resolve(codexHome) + path.sep));
});
