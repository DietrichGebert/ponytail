const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const python = ['python3', 'python'].find((command) =>
  spawnSync(command, ['-c', 'import sys']).status === 0);

test('ChatGPT package contains the shared skills and no runtime hooks', () => {
  assert.ok(python, 'Python is required to build the ChatGPT ZIP');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-chatgpt-'));
  const output = path.join(directory, 'plugin.zip');
  try {
    const build = spawnSync(python, [
      'scripts/build-chatgpt-plugin.py', output,
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);

    const inspect = spawnSync(python, ['-c', String.raw`
import json, struct, sys
from zipfile import ZipFile
with ZipFile(sys.argv[1]) as archive:
    icon = archive.read('assets/chatgpt-icon.png')
    print(json.dumps({
        'names': archive.namelist(),
        'manifest': json.loads(archive.read('plugin.json')),
        'icon': struct.unpack('>II', icon[16:24]),
    }))
`, output], { encoding: 'utf8' });
    assert.equal(inspect.status, 0, inspect.stderr);

    const archive = JSON.parse(inspect.stdout);
    const manifest = archive.manifest;
    const listing = manifest.extensions['com.openai'].interface;
    const skills = fs.readdirSync(path.join(root, 'skills'));
    assert.equal(manifest.version, require('../package.json').version);
    assert.equal(manifest.hooks, undefined);
    assert.deepEqual(listing.capabilities, ['Instructions']);
    assert.deepEqual(archive.icon, [512, 512]);
    assert.equal(archive.names.length, skills.length + 3);
    for (const skill of skills) assert.ok(archive.names.includes(`skills/${skill}/SKILL.md`));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
