import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(process.argv[2] || fileURLToPath(new URL('../.opencode/v2', import.meta.url)));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ponytail-v2-'));
const requests = [];
const provider = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const input = JSON.parse(body);
  requests.push(input);
  const completion = { id: 'probe', object: 'chat.completion', created: 1, model: 'probe',
    choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
  if (!input.stream) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(completion));
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  for (const [delta, finish_reason] of [[{ role: 'assistant', content: 'OK' }, null], [{}, 'stop']]) {
    res.write(`data: ${JSON.stringify({ ...completion, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
  }
  res.end('data: [DONE]\n\n');
});
provider.listen(0, '127.0.0.1');
await once(provider, 'listening');
const env = { ...process.env, HOME: root, PONYTAIL_DEFAULT_MODE: 'full' };
for (const key of Object.keys(env)) if (key.startsWith('OPENCODE_')) delete env[key];
for (const name of ['CONFIG', 'DATA', 'CACHE', 'STATE']) env[`XDG_${name}_HOME`] = path.join(root, name.toLowerCase());
const configDir = path.join(env.XDG_CONFIG_HOME, 'opencode');
await fs.mkdir(configDir, { recursive: true });
await fs.writeFile(path.join(configDir, 'opencode.json'), JSON.stringify({
  plugins: [plugin], model: 'test/probe', update: 'disable',
  default_agent: 'probe',
  agents: { probe: { mode: 'primary', system: 'PONYTAIL_V2_VERIFICATION. Reply OK only.' } },
  providers: { test: {
    package: 'aisdk:@ai-sdk/openai-compatible',
    settings: { baseURL: `http://127.0.0.1:${provider.address().port}/v1`, apiKey: 'test' },
    models: { probe: { name: 'Probe', limit: { context: 32000, output: 1000 },
      capabilities: { tools: false, input: ['text'], output: ['text'] } } },
  } },
}));
let server, url, authorization;
async function start() {
  server = spawn(process.env.OPENCODE_V2_BIN || 'opencode2', ['serve', '--hostname', '127.0.0.1', '--port', '0'], { cwd: root, env });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 30000);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Server exited ${code}: ${output}`)));
    const read = (chunk) => {
      output += chunk;
      const address = output.match(/server listening on (http:\/\/\S+)/);
      const password = output.match(/server password (\S+)/);
      if (!address || !password) return;
      url = address[1];
      authorization = `Basic ${Buffer.from(`opencode:${password[1]}`).toString('base64')}`;
      clearTimeout(timer);
      resolve();
    };
    server.stdout.on('data', read);
    server.stderr.on('data', read);
  });
  await api('/api/plugin/await-activation', {});
  const plugins = await api('/api/plugin');
  assert.ok(plugins.data.some((p) => p.id === 'ponytail'), JSON.stringify(plugins));
  const commands = await api('/api/command');
  assert.equal(commands.data.filter((c) => c.name.startsWith('ponytail')).length, 6);
  const skills = await api('/api/skill');
  assert.equal(skills.data.filter((s) => s.id.startsWith('ponytail')).length, 6);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, 'exit');
  server.kill('SIGTERM');
  await exited;
}
async function api(endpoint, body) {
  const response = await fetch(url + endpoint, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  assert.ok(response.ok, `${endpoint}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}
async function turn(session, mode, expected) {
  const before = requests.length;
  const endpoint = mode === null ? 'prompt' : 'command';
  await api(`/api/session/${session}/${endpoint}`, mode === null ? { text: 'Reply OK.' } : { command: 'ponytail', text: mode });
  await api(`/api/session/${session}/wait`, {});
  const outgoing = requests.slice(before).filter((r) => r.messages?.some((m) => ['system', 'developer'].includes(m.role) && JSON.stringify(m.content).includes('PONYTAIL_V2_VERIFICATION')));
  assert.ok(outgoing.length, `No model request for ${mode}; inspect ${root}`);
  const system = outgoing[0].messages.filter((m) => ['system', 'developer'].includes(m.role)).map((m) => JSON.stringify(m.content)).join('\n');
  if (expected === 'off') assert.doesNotMatch(system, /PONYTAIL MODE ACTIVE/);
  else assert.match(system, new RegExp(`PONYTAIL MODE ACTIVE[^\n]*level: ${expected}`));
  console.log(`${mode === null ? 'next turn' : `/ponytail ${mode}`}: ${expected}`);
}
try {
  await start();
  const first = (await api('/api/session', { model: { providerID: 'test', id: 'probe' } })).data.id;
  const second = (await api('/api/session', { model: { providerID: 'test', id: 'probe' } })).data.id;
  await turn(first, 'ultra', 'ultra');
  await turn(first, null, 'ultra');
  await turn(second, null, 'full');
  await turn(first, 'off', 'off');
  await turn(first, null, 'off');
  await stop();
  await start();
  await turn(first, null, 'off');
  await turn(first, 'lite', 'lite');
  await turn(first, '', 'lite');
  await turn(first, 'typo', 'lite');
  console.log(`Verified installed V2 plugin, commands, skills, model requests, session isolation, and restart persistence. Artifacts: ${root}`);
} finally {
  await stop();
  provider.close();
}
