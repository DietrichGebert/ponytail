const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { getConfigPath, writeDefaultMode } = require('../hooks/ponytail-config');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-config-write-'));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = root;
  t.after(() => {
    t.mock.restoreAll();
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const file = getConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return { root, file };
}

test('a partial default-mode write leaves the original config intact and retryable', (t) => {
  const { root, file } = fixture(t);
  const original = '{"defaultMode":"lite","customSetting":42,"hideStatus":true}\n';
  fs.writeFileSync(file, original, { mode: 0o600 });
  const write = fs.writeFileSync;
  const failure = Object.assign(new Error('disk filled during config write'), { code: 'ENOSPC' });
  t.mock.method(fs, 'writeFileSync', (target, content, options) => {
    if (typeof target === 'string' && target.startsWith(root + path.sep)) {
      write(target, content.slice(0, 7), options);
      throw failure;
    }
    return write(target, content, options);
  });
  assert.throws(() => writeDefaultMode('ultra'), (error) => error === failure);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['config.json']);
  t.mock.restoreAll();
  assert.equal(writeDefaultMode('ultra'), 'ultra');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
    defaultMode: 'ultra', customSetting: 42, hideStatus: true,
  });
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('a failed config replacement leaves the old contents and no temporary files', (t) => {
  const { file } = fixture(t);
  const original = '{"defaultMode":"lite","quietStartup":true}\n';
  fs.writeFileSync(file, original);
  const failure = Object.assign(new Error('replacement refused'), { code: 'EACCES' });
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (source, target) => {
    if (target === file) throw failure;
    return rename(source, target);
  });
  assert.throws(() => writeDefaultMode('full'), (error) => error === failure);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['config.json']);
});

test('a failed first config write does not publish a partial file', (t) => {
  const { root, file } = fixture(t);
  const write = fs.writeFileSync;
  const failure = Object.assign(new Error('disk filled during first write'), { code: 'ENOSPC' });
  t.mock.method(fs, 'writeFileSync', (target, content, options) => {
    if (typeof target === 'string' && target.startsWith(root + path.sep)) {
      write(target, content.slice(0, 7), options);
      throw failure;
    }
    return write(target, content, options);
  });
  assert.throws(() => writeDefaultMode('lite'), (error) => error === failure);
  assert.equal(fs.existsSync(file), false);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), []);
  t.mock.restoreAll();
  assert.equal(writeDefaultMode(' LITE '), 'lite');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { defaultMode: 'lite' });
});

test('updating a symlinked config preserves the link and private target permissions', {
  skip: process.platform === 'win32' ? 'creating file symlinks requires additional Windows privileges' : false,
}, (t) => {
  const { root, file } = fixture(t);
  const target = path.join(root, 'managed-config.json');
  fs.writeFileSync(target, '{"defaultMode":"lite","managedSetting":42}', { mode: 0o600 });
  fs.symlinkSync(path.relative(path.dirname(file), target), file);
  const link = fs.readlinkSync(file);
  assert.equal(writeDefaultMode('ultra'), 'ultra');
  assert.equal(fs.readlinkSync(file), link);
  assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), {
    defaultMode: 'ultra', managedSetting: 42,
  });
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(root).sort(), ['managed-config.json', 'ponytail']);
});
