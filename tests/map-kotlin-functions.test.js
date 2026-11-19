const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildMap } = require('../hooks/ponytail-map');

test('lists public Kotlin top-level functions including suspend and generic declarations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-kotlin-'));
  try {
    fs.mkdirSync(path.join(root, 'lib'));
    fs.writeFileSync(path.join(root, 'lib', 'functions.kt'),
      'fun normalize(value: String): String = value.trim()\n' +
      'public suspend fun load(): String = "ready"\n' +
      'internal inline fun <T> echo(value: T): T = value\n');
    const map = buildMap(root);
    assert.ok(map.includes('lib/: normalize, load, echo'), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('lists Kotlin extension functions while preserving classes and private-name filtering', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-kotlin-'));
  try {
    fs.writeFileSync(path.join(root, 'extensions.kt'),
      'class Helpers\nfun String.trimmed(): String = trim()\n' +
      'fun List<Int>.sumItems(): Int = sum()\n' +
      'private fun hidden(): Int = 0\nfun _internal(): Int = 1\n');
    fs.writeFileSync(path.join(root, 'nested.kt'),
      'fun container() {\n  fun nested() {}\n}\n');
    const map = buildMap(root);
    for (const name of ['Helpers', 'trimmed', 'sumItems', 'container']) {
      assert.ok(new RegExp(`\\b${name}\\b`).test(map), map);
    }
    assert.ok(!/hidden|_internal|nested/.test(map), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
