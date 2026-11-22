const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { pathToFileURL } = require('node:url');
const { buildMap } = require('../hooks/ponytail-map');

let metrics;
test.before(async () => {
  const source = path.join(__dirname, '..', 'hooks', 'band');
  const moduleUrl = (file, from, to) => 'data:text/javascript;base64,' + Buffer.from(
    stripTypeScriptTypes(fs.readFileSync(path.join(source, file), 'utf8').replace(from, JSON.stringify(to)))
  ).toString('base64');
  const board = moduleUrl('board.ts', "'./logo'", pathToFileURL(path.join(source, 'logo.ts')).href);
  metrics = await import(moduleUrl('metrics.ts', "'./board'", board));
});

for (const newline of ['\n', '\r\n']) {
  test(`Ruby scans retain spaces, tabs and blank lines (${JSON.stringify(newline)})`, t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-ruby-scan-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'lib'));
    const code = [
      'module Billing', '', '  class Invoice', '', '\tdef self.total(price)',
      '    price', '  end', '', '    def discounted?(price)', '      price < 10', '    end',
      '  end', 'end', '',
    ].join(newline);
    fs.writeFileSync(path.join(dir, 'lib', 'invoice.rb'), code);
    fs.writeFileSync(path.join(dir, 'lib', 'empty.rb'), newline.repeat(8192) + '# no declarations');
    const map = buildMap(dir);
    assert.match(map, /lib\/: Billing, Invoice, self\.total/);
    assert.deepEqual(metrics.defsIn('invoice.rb', code), ['total', 'discounted?']);
    assert.deepEqual(metrics.defsIn('empty.rb', newline.repeat(8192) + '# no declarations'), []);
  });
}

test('Ruby scanning does not list commented or string-literal declarations', () => {
  assert.deepEqual(metrics.defsIn('invoice.rb', '\n\n  # def commented\n  "def quoted"\n'), []);
  assert.deepEqual(metrics.defsIn('invoice.ts', 'export function total() {}'), ['total']);
});
