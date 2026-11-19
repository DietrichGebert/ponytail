const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildMap } = require('../hooks/ponytail-map');

test('keeps Ruby predicate, bang and writer names distinct in the codebase map', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-ruby-'));
  try {
    fs.mkdirSync(path.join(root, 'lib'));
    fs.writeFileSync(path.join(root, 'lib', 'predicates.rb'),
      'def active\nend\ndef active?\nend\ndef save!\nend\n');
    fs.writeFileSync(path.join(root, 'lib', 'writers.rb'),
      'def self.update!\nend\ndef setting=(value)\nend\ndef plain\nend\n');
    const map = buildMap(root);
    const names = map.split('\n').find((line) => line.startsWith('lib/: ')).slice(6).split(', ');
    for (const name of ['active', 'active?', 'save!', 'self.update!', 'setting=', 'plain']) {
      assert.ok(names.includes(name), `${name} missing from ${map}`);
    }
    for (const name of ['save', 'self.update', 'setting']) assert.ok(!names.includes(name), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('keeps qualified Ruby classes and modules without accepting prose as a name', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-map-ruby-'));
  try {
    fs.writeFileSync(path.join(root, 'qualified.rb'),
      'module Shop::Billing\nend\nclass Cart::Item\nend\nclass Plain\nend\n');
    fs.writeFileSync(path.join(root, 'exports.ts'),
      'export { SYSTEM::NOTICE, run!commands, valid }\n');
    const map = buildMap(root);
    const names = map.split('\n').find((line) => line.startsWith('./: ')).slice(4).split(', ');
    for (const name of ['Shop::Billing', 'Cart::Item', 'Plain', 'valid']) assert.ok(names.includes(name), map);
    assert.ok(!names.includes('Shop') && !names.includes('Cart'), map);
    assert.ok(!/SYSTEM|NOTICE|commands/.test(map), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
