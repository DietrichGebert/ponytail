// Email pass rate, baseline vs ponytail, per model. Replaces claude-email.js
// (Claude, ponytail's primary target) and model-email.js (cross-model check:
// is the parseaddr quirk gpt-5.4-mini-specific?).
// Usage: PROVIDER=claude|openai [N=40] [MODELS=a,b] node benchmarks/email-rate.js
const fs = require('fs'), path = require('path');
const { parseEnv } = require('node:util');
const { checkPy, pyBlock, TASKS } = require('./robustness-audit.js');

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md'), 'utf8');
const email = TASKS.find(t => t.name === 'email');
const env = parseEnv(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'));

const PROVIDERS = {
  claude: {
    key: env.ANTHROPIC_API_KEY,
    models: 'claude-haiku-4-5-20251001,claude-sonnet-4-6,claude-opus-4-8',
    async call(model, system, user) {
      const body = { model, max_tokens: 1024, messages: [{ role: 'user', content: user }] };
      if (system) body.system = system;
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
        headers: { 'x-api-key': this.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { err: r.status };
      const j = await r.json();
      return { text: (j.content || []).map(b => b.text || '').join('') };
    },
  },
  openai: {
    key: env.OPENAI_API_KEY,
    models: 'gpt-4.1-mini,gpt-5.4-mini',
    async call(model, system, user) {
      const body = { model, max_completion_tokens: 4096,
        messages: system ? [{ role: 'system', content: system }, { role: 'user', content: user }] : [{ role: 'user', content: user }] };
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST',
        headers: { Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { err: r.status };
      return { text: (await r.json()).choices?.[0]?.message?.content || '' };
    },
  },
};

const provider = PROVIDERS[process.env.PROVIDER || 'claude'];
if (!provider) { console.error('PROVIDER must be one of: ' + Object.keys(PROVIDERS).join(', ')); process.exit(1); }
const N = Number(process.env.N) || 40;
const MODELS = (process.env.MODELS || provider.models).split(',');

(async () => {
  console.log(`email, n=${N}\n`);
  console.log('model                      baseline   ponytail');
  for (const model of MODELS) {
    const rates = {};
    for (const [arm, sys] of [['baseline', null], ['ponytail', skill]]) {
      let pass = 0, err = 0;
      for (let i = 0; i < N; i++) {
        const r = await provider.call(model, sys, email.prompt);
        if (r.err) { err++; continue; }
        if (checkPy(pyBlock(r.text), email)) pass++;
      }
      rates[arm] = `${pass}/${N - err}`;
    }
    console.log(`${model.padEnd(26)} ${rates.baseline.padEnd(10)} ${rates.ponytail}`);
  }
})();
