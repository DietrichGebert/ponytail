const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const importer = path.join(__dirname, '..', 'hooks', 'ponytail-band-import.js');

function transcript(cwd, id, name) {
  return [
    { type: 'user', cwd, timestamp: '2026-10-01T10:00:00Z', origin: { kind: 'human' }, message: { content: name } },
    { type: 'assistant', cwd, timestamp: '2026-10-01T10:00:05Z', message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 } } },
  ].map(r => JSON.stringify(r)).join('\n') + '\n';
}

for (const invalidCwd of ['/work/broken\\q', '/work/broken\\uZZZZ']) {
  test('invalid cwd JSON does not abort imports of healthy sessions: ' + invalidCwd, (t) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-import-cwd-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const claude = path.join(temp, 'claude');
    const config = path.join(temp, 'config');
    const project = path.join(claude, 'projects', '-work-shop');
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, 'aaaa0000-first.jsonl'), transcript('/work/shop', 'first', 'First task'));
    const broken = path.join(project, 'bbbb0000-broken.jsonl');
    const damaged = '{"cwd":"' + invalidCwd + '","type":"user","turnOrigin":"human"}\n';
    fs.writeFileSync(broken, damaged);
    fs.writeFileSync(path.join(project, 'cccc0000-last.jsonl'), transcript('/work/shop', 'last', 'Last task'));

    const run = () => spawnSync(process.execPath, [importer], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: claude, XDG_CONFIG_HOME: config },
      encoding: 'utf8',
    });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /2 past sessions found, 2 new rows/);
    const csv = fs.readFileSync(path.join(config, 'ponytail', 'band', 'shop.csv'), 'utf8');
    assert.match(csv, /,First task,/);
    assert.match(csv, /,Last task,/);
    assert.equal(csv.trim().split('\n').length, 3);
    assert.equal(fs.readFileSync(broken, 'utf8'), damaged);
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /2 past sessions found, 0 new rows/);
    assert.equal(fs.readFileSync(path.join(config, 'ponytail', 'band', 'shop.csv'), 'utf8'), csv);
  });
}

test('valid JSON escapes in cwd still reach the intended project', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-import-cwd-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const claude = path.join(temp, 'claude');
  const config = path.join(temp, 'config');
  const project = path.join(claude, 'projects', '-work-quoted');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'dddd0000-quoted.jsonl'), transcript('/work/quoted"project', 'quoted', 'Escaped task'));
  const result = spawnSync(process.execPath, [importer], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: claude, XDG_CONFIG_HOME: config },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 past sessions found, 1 new rows/);
  const csv = fs.readFileSync(path.join(config, 'ponytail', 'band', 'quoted_project.csv'), 'utf8');
  assert.match(csv, /,"quoted""project",Escaped task,/);
});
