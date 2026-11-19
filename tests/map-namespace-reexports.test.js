const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const { buildMap } = require('../hooks/ponytail-map');

test('indexes the public namespace exposed by an executable ESM barrel', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-namespace-'));
  try {
    fs.mkdirSync(path.join(root, 'lib'));
    fs.mkdirSync(path.join(root, 'api'));
    fs.writeFileSync(path.join(root, 'lib', 'helpers.mjs'), 'export const add = (a, b) => a + b;\n');
    const barrel = path.join(root, 'api', 'index.mjs');
    fs.writeFileSync(barrel, "export * as helpers from '../lib/helpers.mjs';\n");
    const exported = await import(pathToFileURL(barrel).href);
    assert.equal(exported.helpers.add(2, 3), 5);
    const map = buildMap(root);
    assert.ok(map.includes('api/: helpers'), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('handles multiline namespace exports without inventing names for bare star exports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-namespace-'));
  try {
    fs.mkdirSync(path.join(root, 'api'));
    fs.writeFileSync(path.join(root, 'api', 'index.ts'),
      "export *\nas $helpers\nfrom './helpers';\nexport * from './plain';\n" +
      "export * as _internal from './private';\nexport * as SYSTEM NOTICE from './bad';\n");
    const map = buildMap(root);
    assert.ok(map.includes('api/: $helpers'), map);
    assert.ok(!/plain|_internal|SYSTEM|NOTICE/.test(map), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
