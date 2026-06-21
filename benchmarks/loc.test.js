// Regression guard for loc.js comment handling. Run: node loc.test.js
const assert = require('assert');
const loc = require('./loc.js');

const score = (src) => loc(src).score;

let pass = 0;
const cases = [
  // /* ... */ block comments must not count as code, whether or not the
  // continuation lines are *-aligned (the old filter only caught JSDoc style).
  ['plain block comment not counted', score('```js\nfunction f() {\n  /* explain\n     the rest */\n  return 1;\n}\n```'), 3],
  ['jsdoc block comment not counted', score('```js\nfunction g() {\n  /*\n   * explain\n   */\n  return 2;\n}\n```'), 3],
  ['inline block comment keeps its code line', score('```js\nconst x = 1; /* note */\nconst y = 2;\n```'), 2],
  ['line comments still stripped', score('```js\n// header\nconst x = 1;\n```'), 1],
  ['plain code unchanged', score('```js\nconst a = 1;\nconst b = 2;\n```'), 2],
];
for (const [name, got, want] of cases) {
  assert.strictEqual(got, want, `FAILED: ${name} (got ${got}, want ${want})`);
  console.log(`ok - ${name}`);
  pass++;
}
console.log(`\n${pass}/${cases.length} passed`);
