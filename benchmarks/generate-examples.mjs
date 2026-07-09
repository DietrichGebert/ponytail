// Generate examples/*.md verbatim from a real benchmark run (output.json):
// each file shows the same task answered with no skill vs with ponytail, same model.
//   node benchmarks/generate-examples.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import loc from './loc.js';

const j = JSON.parse(readFileSync(new URL('./output.json', import.meta.url), 'utf8'));
const isHaiku = (id) => id.includes('haiku');

const meta = [
  [/validates email/, 'email-validation', 'Email Validation'],
  [/debounce/,        'debounce',         'Debounce'],
  [/sales\.csv/,      'csv-sum',          'CSV Sum'],
  [/countdown timer/, 'react-countdown',  'Countdown Timer'],
  [/rate limiting/,   'rate-limit',       'Rate Limiting'],
];

const pick = (re, armIdx) =>
  j.results.results.find((r) => isHaiku(r.provider.id) && r.promptIdx === armIdx && re.test(r.vars.task));

const rows = [];
for (const [re, slug, title] of meta) {
  const b = pick(re, 0), p = pick(re, 2);
  if (!b || !p) { console.log('MISS', slug, !!b, !!p); continue; }
  const bL = loc(b.response.output).score, pL = loc(p.response.output).score;
  const md = `# ${title}

**Task:** "${b.vars.task}"

Verbatim model output from a benchmark run — Claude Haiku 4.5, no-skill arm vs ponytail arm, temperature 1, source \`benchmarks/output.json\`. Reproduce: \`npx promptfoo@latest eval -c benchmarks/promptfooconfig.yaml\`.

## Without Ponytail — ${bL} lines of code

${b.response.output.trim()}

## With Ponytail — ${pL} lines of code

${p.response.output.trim()}

**${bL} → ${pL} lines of code** — same model, same prompt.
`;
  writeFileSync(new URL(`../examples/${slug}.md`, import.meta.url), md);
  rows.push([title, slug, bL, pL]);
  console.log('wrote examples/' + slug + '.md', bL, '->', pL);
}

const tbl = rows.map(([t, s, b, p]) => `| [${t}](${s}.md) | ${b} | ${p} |`).join('\n');
const readme = `# Examples

Real model output, verbatim from benchmark runs — the same task answered by the same model
with no skill (\`## Without Ponytail\`) and with ponytail (\`## With Ponytail\`), so you can
compare side by side. Model: Claude Haiku 4.5, temperature 1, source \`benchmarks/output.json\`.

These are not hand-written. Reproduce them yourself:
\`npx promptfoo@latest eval -c benchmarks/promptfooconfig.yaml\`. Method, all three models, and
median-of-10 numbers: [../benchmarks/](../benchmarks/).

| Example | Without (LOC) | With (LOC) |
|---|--:|--:|
${tbl}
`;
writeFileSync(new URL('../examples/README.md', import.meta.url), readme);
console.log('wrote examples/README.md');
