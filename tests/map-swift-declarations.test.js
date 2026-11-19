const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildMap } = require('../hooks/ponytail-map');

test('indexes Swift utility functions and value types in the reuse map', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-swift-'));
  try {
    fs.mkdirSync(path.join(root, 'lib'));
    fs.writeFileSync(path.join(root, 'lib', 'Helpers.swift'),
      'func doubled(_ value: Int) -> Int { value * 2 }\n' +
      'public struct Options {}\ninternal typealias Identifier = String\n');
    const map = buildMap(root);
    assert.ok(map.includes('lib/: doubled, Options, Identifier'), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('indexes Swift protocols and actors without exposing private or nested helpers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-swift-'));
  try {
    fs.writeFileSync(path.join(root, 'Types.swift'),
      'public protocol Named { var name: String { get } }\n' +
      'actor Cache {}\nclass Existing {}\n');
    fs.writeFileSync(path.join(root, 'Helpers.swift'),
      'private func hidden() {}\nfileprivate struct Hidden {}\n' +
      'func _internal() {}\nfunc container() {\n  func nested() {}\n}\n');
    const map = buildMap(root);
    for (const name of ['Named', 'Cache', 'Existing', 'container']) {
      assert.ok(new RegExp(`\\b${name}\\b`).test(map), map);
    }
    assert.ok(!/hidden|Hidden|_internal|nested/.test(map), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
