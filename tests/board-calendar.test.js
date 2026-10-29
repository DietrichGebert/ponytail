const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

// Run the board's own browser script, without a browser or an extra dependency.
function render(now, tasks) {
  const source = fs.readFileSync(path.join(__dirname, '../hooks/band/board.ts'), 'utf8');
  const palette = source.match(/^const PALETTE = .*$/m)[0];
  const start = source.indexOf('const APP = `');
  const end = source.indexOf('\n// The share card stays dark', start);
  assert.ok(start >= 0 && end > start);
  const app = vm.runInNewContext(palette + '\n' + source.slice(start, end) + '\nAPP');
  class Element {
    constructor(tag = '') {
      this.tag = tag;
      this.children = [];
      this.attrs = {};
      this.listeners = {};
      this.style = { setProperty() {} };
      this.classList = { toggle() {} };
      this._text = '';
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key]; }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    getBoundingClientRect() { return { width: 900, height: 340, left: 0 }; }
  }
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  get('board-data').textContent = JSON.stringify({ now, tasks });
  const periods = [7, 30, 90, 0].map(n => {
    const button = new Element(); button.setAttribute('data-period', n); return button;
  });
  const document = {
    getElementById: get,
    createElement: tag => new Element(tag),
    createElementNS: (_, tag) => new Element(tag),
    createTextNode: text => { const e = new Element(); e.textContent = text; return e; },
    querySelectorAll: selector => selector === '[data-period]' ? periods : [],
    documentElement: new Element(),
  };
  vm.runInNewContext(app, { document, window: { addEventListener() {} }, Date,
    localStorage: { getItem() { return null; } }, setTimeout, clearTimeout }, { timeout: 3000 });
  return { get, period: n => periods.find(b => b.getAttribute('data-period') === String(n)).listeners.click() };
}

const scenarios = [
  ['Europe/Berlin', '2026-04-15T00:30:00'],
  ['Europe/Berlin', '2026-04-15T12:30:00'],
  ['Europe/Berlin', '2026-11-05T00:30:00'],
  ['Europe/Berlin', '2026-11-05T23:30:00'],
  ['America/New_York', '2026-03-30T00:30:00'],
  ['America/New_York', '2026-11-10T00:30:00'],
  ['America/New_York', '2026-11-10T23:30:00'],
  ['Australia/Sydney', '2026-10-25T00:30:00'],
  ['Australia/Sydney', '2026-04-15T00:30:00'],
  ['Australia/Sydney', '2026-04-15T23:30:00'],
  ['UTC', '2026-04-15T00:30:00'],
  ['Asia/Shanghai', '2026-04-15T00:30:00'],
  ['Europe/Berlin', '2027-01-02T00:30:00'],
];

function check(zone, at) {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, zone);
  const [year, month, day] = at.slice(0, 10).split('-').map(Number);
  // UTC is only the independent calendar oracle; the board must use its local dates.
  const keys = Array.from({ length: 91 }, (_, i) => new Date(Date.UTC(year, month - 1, day - 90 + i)).toISOString().slice(0, 10));
  const tasks = keys.map(started => ({ started: started + ' 09:00', project: 'demo', name: started,
    cost: 1, turns: 1, agentMinutes: 1, tokens: 1, reuse: null, tests: '', level: 'import', model: '' }));
  const board = render(new Date(at).getTime(), tasks);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = key => months[+key.slice(5, 7) - 1] + ' ' + +key.slice(8, 10);
  const cells = board.get('heat').children.filter(e => e.tag === 'path' && e.children.some(c => c.tag === 'title'));
  assert.equal(cells.length, 84);
  assert.deepEqual(cells.map(e => e.children.find(c => c.tag === 'title').textContent),
    keys.slice(-84).map(k => label(k) + ': 1m 0s'), 'every local date must have exactly one activity cell');
  const firstDow = new Date(keys.at(-84) + 'T12:00:00Z').getUTCDay();
  const apex = Number(/^M[^,]+,([^L]+)/.exec(cells[0].attrs.d)[1]);
  assert.equal(apex, 4 + firstDow * 25.5, 'the oldest cell must sit on its own weekday row');
  assert.equal(board.get('h-active').textContent, '84');
  for (const n of [7, 30, 90]) {
    board.period(n);
    assert.equal(board.get('count').textContent, String(n), `${n}-day table must retain exactly its calendar window`);
    assert.equal(board.get('chart-total').textContent, n < 60 ? `${n}m 0s` : '1h 30m');
    assert.equal(board.get('c-sessions').textContent, String(n));
    const delta = board.get('kpis').children[0].children[1].children[0];
    assert.equal(delta.textContent, n === 90 ? '↑8900%' : '↑0%', 'previous period must not overlap the current period');
  }
}

if (process.argv[2] === '--calendar-case') {
  check(process.env.TZ, process.argv[3]);
} else {
  for (const [zone, at] of scenarios) {
    test(`board keeps local calendar days in ${zone} at ${at}`, () => {
      const child = spawnSync(process.execPath, [__filename, '--calendar-case', at], {
        env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 15000,
      });
      assert.equal(child.status, 0, child.stderr || child.stdout || String(child.error));
    });
  }
}
