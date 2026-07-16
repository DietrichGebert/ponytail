// Self-check for detectOverEngineering(). Run: node overengineering.test.js
const assert = require('assert');
const { detectOverEngineering } = require('./overengineering.js');

let pass = 0;
const cases = [
  ['catches moment import', detectOverEngineering("import moment from 'moment'"), [
    { pattern: 'date-lib', alternative: 'Intl.DateTimeFormat / native Date', snippet: "import moment from 'moment'", line: 1 },
  ]],
  ['catches lodash import', detectOverEngineering("const _ = require('lodash');"), [
    { pattern: 'util-lib', alternative: 'native Array/Object methods', snippet: "const _ = require('lodash');", line: 1 },
  ]],
  ['catches axios import', detectOverEngineering("import axios from 'axios'"), [
    { pattern: 'http-lib', alternative: 'native fetch()', snippet: "import axios from 'axios'", line: 1 },
  ]],
  ['catches JSON.parse(JSON.stringify)', detectOverEngineering('const x = JSON.parse(JSON.stringify(obj))'), [
    { pattern: 'deep-clone', alternative: 'structuredClone()', snippet: 'const x = JSON.parse(JSON.stringify(obj))', line: 1 },
  ]],
  ['catches new Date().toISOString()', detectOverEngineering('return new Date().toISOString()'), [
    { pattern: 'timestamp', alternative: 'Date.now()', snippet: 'return new Date().toISOString()', line: 1 },
  ]],
  ['flags trivial getter/setter class', detectOverEngineering([
    'class Point {',
    '  get x() { return this._x; }',
    '  set x(v) { this._x = v; }',
    '  get y() { return this._y; }',
    '  set y(v) { this._y = v; }',
    '}',
  ].join('\n')), [
    { pattern: 'trivial-class', alternative: 'direct property access or plain object' },
  ]],
  ['skips class with real method', detectOverEngineering([
    'class Point {',
    '  constructor(x, y) { this.x = x; this.y = y; }',
    '  distance() { return Math.hypot(this.x, this.y); }',
    '  get magnitude() { return Math.hypot(this.x, this.y); }',
    '}',
  ].join('\n')), []], // has distance() — not trivial
  ['flags trivial wrapper function', detectOverEngineering('const getUsers = (id) => fetch(id)'), [
    { pattern: 'trivial-wrapper' },
  ]],
  ['empty text returns empty', detectOverEngineering(''), []],
  ['no match returns empty', detectOverEngineering('const x = 42;\nconsole.log(x);'), []],
];

for (const [name, got, want] of cases) {
  try {
    if (want.length === 0) {
      assert.strictEqual(got.length, 0, `expected no findings, got ${got.length}`);
    } else {
      assert.ok(got.length >= want.length, `expected >=${want.length} findings, got ${got.length}`);
      for (const w of want) {
        const match = got.find(g => g.pattern === w.pattern);
        assert.ok(match, `expected finding pattern '${w.pattern}' not found`);
        if (w.line) assert.strictEqual(match.line, w.line, `expected line ${w.line}, got ${match.line}`);
        if (w.snippet) assert.ok(match.snippet.includes(w.snippet.slice(0, 20)), `expected snippet containing '${w.snippet.slice(0, 20)}'`);
      }
    }
    console.log(`ok - ${name}`);
    pass++;
  } catch (e) {
    console.log(`FAILED: ${name} — ${e.message}`);
  }
}
console.log(`\n${pass}/${cases.length} passed`);
// exit with non-zero if any case failed
if (pass !== cases.length) process.exit(1);
