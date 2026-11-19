const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');

// Load the board's two modules without the Claude Code UI test runtime.
const source = ['logo', 'board'].map(name =>
  stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../hooks/band', name + '.ts'), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/^export /gm, '')
).join('\n');
const boardHtml = vm.runInNewContext(source + '\nboardHtml');

// Only the DOM operations used to render the board and click its project controls.
class Element {
  constructor(text = '') {
    this.text = text;
    this.children = [];
    this.attributes = new Map();
    this.events = new Map();
    this.style = { setProperty() {} };
  }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(event, callback) { this.events.set(event, callback); }
  click() { this.events.get('click')(); }
  getBoundingClientRect() { return { width: 900, height: 340, left: 0 }; }
}

function board() {
  const tasks = ['constructor', 'toString', '__proto__', 'shop'].map(project => ({
    project, started: '2026-10-15 12:00', name: 'Work', cost: 1, turns: 1,
    agentMinutes: 1, tokens: 100, reuse: null, tests: '', level: 'import', model: '',
  }));
  const html = boardHtml(tasks, new Date(2026, 9, 15, 12).getTime());
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
  nodes.get('board-data').textContent = /<script type="application\/json" id="board-data">([\s\S]*?)<\/script>/.exec(html)[1];
  vm.runInNewContext(/<script>([\s\S]*?)<\/script>/.exec(html)[1], {
    document: {
      getElementById: id => nodes.get(id),
      createElement: () => new Element(),
      createElementNS: () => new Element(),
      createTextNode: text => new Element(text),
      querySelectorAll: () => [],
      documentElement: new Element(),
    },
    window: { addEventListener() {} },
  });
  return nodes;
}

test('board includes project names inherited by ordinary objects', () => {
  const nodes = board();
  assert.equal(nodes.get('chart-total').textContent, '4m 0s');
  assert.equal(nodes.get('c-time').textContent, '4m 0s');
  assert.equal(nodes.get('c-sessions').textContent, '4');
  assert.equal(nodes.get('rows').children.length, 4);
  assert.ok(nodes.get('legend').children.every(button => button.getAttribute('aria-pressed') === 'true'));
});

test('project visibility toggles and resets for prototype-like names', () => {
  const nodes = board();
  const chip = name => nodes.get('legend').children.find(button => button.children[1].textContent === name);
  const select = name => nodes.get('projects').children.find(button => button.title === name).click();
  for (const name of ['constructor', 'toString', '__proto__']) {
    chip(name).click();
    assert.equal(chip(name).getAttribute('aria-pressed'), 'false');
    assert.equal(nodes.get('chart-total').textContent, '3m 0s');
    assert.equal(nodes.get('c-sessions').textContent, '3');
    select(name);
    assert.equal(nodes.get('chart-total').textContent, '1m 0s');
    assert.equal(nodes.get('c-sessions').textContent, '1');
    select('All projects');
    assert.equal(nodes.get('chart-total').textContent, '4m 0s');
    assert.equal(chip(name).getAttribute('aria-pressed'), 'true');
  }
});
