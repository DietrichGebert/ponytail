// Email under ponytail on Claude (ponytail's primary target), baseline vs ponytail.
const fs = require('fs'), path = require('path');
const { checkPy, pyBlock, TASKS } = require('./robustness-audit.js');
const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md'), 'utf8');
const email = TASKS.find(t => t.name === 'email');
const N = Number(process.env.CE_N) || 40;
const MODELS = (process.env.CE_MODELS || 'claude-haiku-4-5-20251001,claude-sonnet-4-6,claude-opus-4-8').split(',');

const kv = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  .split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const KEY = kv.ANTHROPIC_API_KEY;

async function call(model, system, user) {
  const body = { model, max_tokens: 1024, messages: [{ role: 'user', content: user }] };
  if (system) body.system = system;
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return { err: r.status };
  const j = await r.json();
  return { text: (j.content || []).map(b => b.text || '').join('') };
}

(async () => {
  console.log(`email, n=${N}\n`);
  console.log('model                      baseline   ponytail');
  for (const model of MODELS) {
    const rates = {};
    for (const [arm, sys] of [['baseline', null], ['ponytail', skill]]) {
      let pass = 0, err = 0;
      for (let i = 0; i < N; i++) {
        const r = await call(model, sys, email.prompt);
        if (r.err) { err++; continue; }
        if (checkPy(pyBlock(r.text), email)) pass++;
      }
      rates[arm] = `${pass}/${N - err}`;
    }
    console.log(`${model.padEnd(26)} ${rates.baseline.padEnd(10)} ${rates.ponytail}`);
  }
})();
