const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
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

test('band grep and definition parsing retain Rust functions with scoped visibility', () => {
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../hooks/band/metrics.ts'), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/^export \{.*\}$/gm, '').replace(/^export /gm, '');
  const { GREP_DEFS, parseDefs } = vm.runInNewContext(source + '\n({ GREP_DEFS, parseDefs })');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-rust-defs-'));
  try {
    const initialized = spawnSync('git', ['init', '-q', root], { encoding: 'utf8' });
    assert.equal(initialized.status, 0, initialized.stderr);
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'shared.rs'), [
      'pub(crate) fn crate_helper() {}',
      'pub(super) async fn parent_helper() {}',
      'pub(in crate::shared) fn module_helper() {}',
      'pub(self) fn local_helper() {}',
      'pub fn public_helper() {}',
      'fn private_helper() {}',
    ].join('\n'));
    const grep = spawnSync('git', ['-C', root, 'grep', '--untracked', '-nE', GREP_DEFS], { encoding: 'utf8' });
    assert.equal(grep.status, 0, grep.stderr);
    assert.deepEqual([...parseDefs(grep.stdout).keys()], [
      'crate_helper', 'parent_helper', 'module_helper', 'local_helper', 'public_helper', 'private_helper',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
