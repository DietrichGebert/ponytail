const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { buildMap } = require('../hooks/ponytail-map');

test('codebase map includes Rust declarations with restricted visibility', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-rust-map-'));
  try {
    const directory = path.join(root, 'src', 'shared');
    fs.mkdirSync(directory, { recursive: true });
    for (const [file, source] of Object.entries({
      'crate.rs': 'pub(crate) fn normalize() {}\npub(crate) struct SharedValue;\n',
      'parent.rs': 'pub(super) async fn load_records() {}\npub(super) enum LoadState { Ready }\n',
      'module.rs': 'pub(in crate::shared) trait Storage {}\npub(in crate::shared) type RecordId = u64;\n',
      'local.rs': 'pub(self) fn local_helper() {}\nfn private_helper() {}\n',
      'public.rs': 'pub fn public_helper() {}\n',
    })) fs.writeFileSync(path.join(directory, file), source);
    const map = buildMap(root);
    for (const name of ['normalize', 'SharedValue', 'load_records', 'LoadState', 'Storage', 'RecordId', 'local_helper', 'public_helper']) {
      assert.ok(map.includes(name), `missing ${name}: ${map}`);
    }
    assert.ok(!map.includes('private_helper'), map);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
