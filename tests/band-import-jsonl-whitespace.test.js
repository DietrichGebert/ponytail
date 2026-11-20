const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const importer = path.join(__dirname, '..', 'hooks', 'ponytail-band-import.js');
const id = 'abcd1234-1111-2222-3333-444444444444';
const records = [
  { type: 'user', cwd: '/work/spacing-shop', timestamp: '2026-10-01T10:00:00Z',
    turnOrigin: 'human', message: { content: 'Import the complete session' } },
  { type: 'assistant', timestamp: '2026-10-01T10:00:06Z',
    message: { id: 'main-1', model: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: 10 } } },
];

function fixture(t, lines, subLines = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-jsonl-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, 'claude', 'projects', '-work-spacing-shop');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, id + '.jsonl'), lines.join('\r\n'));
  if (subLines.length) {
    const sub = path.join(project, id, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-1.jsonl'), subLines.join('\n'));
  }
  const run = () => {
    const result = spawnSync(process.execPath, [importer], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(dir, 'claude'), XDG_CONFIG_HOME: path.join(dir, 'config') },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const csv = () => fs.readFileSync(path.join(dir, 'config', 'ponytail', 'band', 'spacing-shop.csv'), 'utf8');
  return { run, csv, dir };
}

const formats = [
  ['leading record whitespace', line => ' \t' + line + ' \t'],
  ['working-directory separators', line => line.replace('"cwd":', '"cwd" \t: ')],
  ['turn-origin separators', line => line.replace('"turnOrigin":"human"', '"turnOrigin" : "human"')],
  ['nested origin separators', line => line.replace('"turnOrigin":"human"', '"origin" : { "kind" : "human" }')],
];

for (const [name, format] of formats) {
  test('history import accepts JSON whitespace in ' + name, t => {
    const f = fixture(t, records.map(record => format(JSON.stringify(record))));
    assert.match(f.run(), /1 past sessions found, 1 new rows/);
    const [header, row] = f.csv().trimEnd().split('\n').map(line => line.split(','));
    const value = key => row[header.indexOf(key)];
    assert.equal(value('project'), 'spacing-shop');
    assert.equal(value('name'), 'Import the complete session');
    assert.equal(value('tokens_total'), '110');
    assert.equal(value('tokens_output'), '10');
    assert.equal(value('turns'), '1');
    assert.match(f.run(), /1 past sessions found, 0 new rows/);
  });
}

test('spaced subagent records contribute usage while malformed lines are skipped', t => {
  const sub = { ...records[1], message: { ...records[1].message, id: 'sub-1', usage: { input_tokens: 30, output_tokens: 3 } } };
  const f = fixture(t, records.map(JSON.stringify), ['  {not JSON}', '\t' + JSON.stringify(sub)]);
  assert.match(f.run(), /1 past sessions found, 1 new rows/);
  const [header, row] = f.csv().trimEnd().split('\n').map(line => line.split(','));
  assert.equal(row[header.indexOf('tokens_total')], '143');
  assert.equal(row[header.indexOf('tokens_output')], '13');
});

test('spaced automated transcripts still do not create a ledger row', t => {
  const automated = records.map(record => {
    const { turnOrigin, ...rest } = record;
    return ' \t' + JSON.stringify(rest).replace('"type":', '"type" : ');
  });
  const f = fixture(t, automated);
  assert.match(f.run(), /0 past sessions found, 0 new rows/);
  assert.equal(fs.existsSync(path.join(f.dir, 'config', 'ponytail', 'band', 'spacing-shop.csv')), false);
});
