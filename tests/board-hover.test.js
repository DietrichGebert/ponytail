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

// The board's real inline script runs against only the DOM operations it uses.
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
  click() { this.listeners.click?.({ target: this }); }
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
    move: () => elements.get('stream').onmousemove?.({ clientX: 450 }),
  };
}

const task = project => ({
  project, started: '2026-11-06 12:00', name: 'Work', cost: 2, turns: 1,
  agentMinutes: 5, tokens: 100, reuse: null, tests: '', level: 'import', model: '',
});

test('empty periods cannot show the previous period tooltip, and restoring data restores hover', () => {
  const p = page([task('Alpha')]);
  p.move(); assert.equal(p.get('tip').hidden, false);
  p.choose('period', '7');
  assert.match(p.get('stream').textContent, /No sessions in this period/);
  p.move(); assert.equal(p.get('tip').hidden, true);
  p.choose('period', '30');
  p.move(); assert.equal(p.get('tip').hidden, false);
});

test('hiding every project clears the previous project tooltip', () => {
  const p = page([task('Alpha'), task('Beta')]);
  p.move(); assert.equal(p.get('tip').hidden, false);
  p.get('legend').children[0].click();
  p.get('legend').children[1].click();
  assert.match(p.get('stream').textContent, /No sessions in this period/);
  p.move(); assert.equal(p.get('tip').hidden, true);
  p.get('legend').children[0].click();
  p.move(); assert.equal(p.get('tip').hidden, false);
});

test('a metric with no values cannot display the previous metric tooltip', () => {
  const p = page([{ ...task('Alpha'), tokens: 0 }]);
  p.move(); assert.equal(p.get('tip').hidden, false);
  p.choose('metric', 'tokens');
  p.move(); assert.equal(p.get('tip').hidden, true);
});

test('an initially empty board keeps its tooltip hidden', () => {
  const p = page([]);
  p.move(); assert.equal(p.get('tip').hidden, true);
});
