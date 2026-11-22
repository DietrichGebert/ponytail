const assert = require('node:assert/strict');
const fs = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

let boardHtml;
test.before(async () => {
  const dir = path.join(__dirname, '..', 'hooks', 'band');
  const source = fs.readFileSync(path.join(dir, 'board.ts'), 'utf8')
    .replace("'./logo'", JSON.stringify(pathToFileURL(path.join(dir, 'logo.ts')).href));
  ({ boardHtml } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')));
});

// Run the generated board script with the DOM operations it uses, without a browser dependency.
class Element {
  constructor() {
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.style = { setProperty() {} };
    this.classList = { toggle() {} };
    this.textContent = '';
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  click() { if (!this.disabled) this.listeners.click?.({ target: this }); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 340 }; }
}

function page(tasks) {
  const html = boardHtml(tasks, new Date(2026, 10, 20, 12).getTime());
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Element()]));
  const buttons = [...html.matchAll(/data-(metric|period)="([^"]+)"/g)].map(m => {
    const button = new Element(); button.setAttribute('data-' + m[1], m[2]); return button;
  });
  elements.get('board-data').textContent = html.match(/<script type="application\/json" id="board-data">([\s\S]*?)<\/script>/)[1];
  const document = {
    documentElement: new Element(),
    getElementById: id => elements.get(id),
    createElement: () => new Element(),
    createElementNS: () => new Element(),
    createTextNode: text => { const node = new Element(); node.textContent = text; return node; },
    querySelectorAll: selector => buttons.filter(b => b.getAttribute(selector.slice(1, -1)) !== null),
  };
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document, window: { addEventListener() {} }, localStorage: { getItem() { return null; } },
  });
  return {
    get: id => elements.get(id),
    choose: (kind, value) => buttons.find(b => b.getAttribute('data-' + kind) === value).click(),
    search: value => elements.get('q').listeners.input({ target: { value } }),
    names: () => elements.get('rows').children.map(row => row.children[0].children[0]?.textContent),
  };
}

const tasks = Array.from({ length: 250 }, (_, i) => ({
  project: i < 125 ? 'Alpha' : 'Beta', started: i < 150 ? '2026-11-20 12:00' : '2026-11-06 12:00',
  name: i === 225 ? 'Needle' : `Session ${String(i).padStart(3, '0')}`, cost: 2, turns: 1,
  agentMinutes: i + 1, tokens: 100, reuse: null, tests: '', level: 'import', model: '',
}));

test('large histories render at most 100 rows and retain every session across pages', () => {
  const p = page(tasks);
  assert.equal(p.get('rows').children.length, 100);
  assert.equal(p.get('count').textContent, '250');
  assert.equal(p.get('c-sessions').textContent, '250');
  assert.equal(p.get('page-range').textContent, '1–100 of 250');
  assert.equal(p.get('page-prev').disabled, true);
  assert.equal(p.get('rows').children[99].children[0].children[2].style.width, '40%');
  const seen = [...p.names()];
  p.get('page-next').click();
  assert.equal(p.get('page-range').textContent, '101–200 of 250');
  seen.push(...p.names());
  p.get('page-next').click();
  assert.equal(p.get('rows').children.length, 50);
  assert.equal(p.get('page-next').disabled, true);
  seen.push(...p.names());
  assert.deepEqual(seen, tasks.map(t => t.name));
  p.get('page-next').click();
  assert.equal(p.get('page-range').textContent, '201–250 of 250');
  p.get('page-prev').click();
  assert.equal(p.names()[0], 'Session 100');
  assert.equal(p.get('c-sessions').textContent, '250');
});

test('search covers all sessions and resets pagination when the query changes', () => {
  const p = page(tasks);
  p.get('page-next').click();
  p.search('Needle');
  assert.deepEqual(p.names(), ['Needle']);
  assert.equal(p.get('count').textContent, '1');
  assert.equal(p.get('pager').hidden, true);
  assert.equal(p.get('page-prev').disabled, true);
  p.search('missing');
  assert.equal(p.get('count').textContent, '0');
  assert.equal(p.get('rows').textContent, 'No session matches.');
  assert.equal(p.get('page-next').disabled, true);
  p.search('');
  assert.equal(p.get('rows').children.length, 100);
  assert.equal(p.names()[0], 'Session 000');
});

test('project and period changes return to their first page', () => {
  const p = page(tasks);
  p.get('page-next').click();
  p.get('projects').children.find(b => b.title === 'Beta').click();
  assert.equal(p.get('page-range').textContent, '1–100 of 125');
  assert.equal(p.names()[0], 'Session 125');
  p.get('page-next').click();
  assert.equal(p.get('rows').children.length, 25);
  p.get('projects').children.find(b => b.title === 'All projects').click();
  p.get('page-next').click();
  p.choose('period', '7');
  assert.equal(p.get('page-range').textContent, '1–100 of 150');
  assert.equal(p.names()[0], 'Session 000');
  p.get('page-next').click();
  assert.equal(p.get('rows').children.length, 50);
  p.choose('period', '30');
  assert.equal(p.get('page-range').textContent, '1–100 of 250');
});

test('small and empty histories keep their existing rows, totals and empty state', () => {
  const small = page(tasks.slice(0, 4));
  assert.deepEqual(small.names(), tasks.slice(0, 4).map(t => t.name));
  assert.equal(small.get('count').textContent, '4');
  assert.equal(small.get('c-cost').textContent, '$8.00');
  const empty = page([]);
  assert.equal(empty.get('count').textContent, '0');
  assert.match(empty.get('rows').textContent, /No sessions yet/);
  assert.equal(empty.get('rows').children[0].children[0].colSpan, 6);
});
