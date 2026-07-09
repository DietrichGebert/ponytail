// Cross-model email rate at high n: is the parseaddr quirk gpt-5.4-mini-specific?
const fs = require('fs'), path = require('path');
const { checkPy, pyBlock, TASKS } = require('./robustness-audit.js');
const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md'), 'utf8');
const email = TASKS.find(t => t.name === 'email');
const N = Number(process.env.ME_N) || 100;
const MODELS = (process.env.ME_MODELS || 'gpt-4.1-mini,gpt-5.4-mini').split(',');

const kv = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  .split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const KEY = kv.OPENAI_API_KEY;

async function call(model, system, user) {
  const body = { model, max_completion_tokens: 4096,
    messages: system ? [{ role: 'system', content: system }, { role: 'user', content: user }] : [{ role: 'user', content: user }] };
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return { err: r.status };
  return { text: (await r.json()).choices?.[0]?.message?.content || '' };
}

(async () => {
  console.log(`email, n=${N}\n`);
  console.log('model           baseline   ponytail');
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
    console.log(`${model.padEnd(15)} ${rates.baseline.padEnd(10)} ${rates.ponytail}`);
  }
})();
