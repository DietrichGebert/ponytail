const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');

const source = ['logo', 'board'].map(name =>
  stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../hooks/band', name + '.ts'), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/^export /gm, '')
).join('\n');
const boardHtml = vm.runInNewContext(source + '\nboardHtml');

function projectList(tasks) {
  const html = boardHtml(tasks, Date.UTC(2026, 9, 20));
  const data = /<script type="application\/json" id="board-data">([\s\S]*?)<\/script>/.exec(html)[1];
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const element = () => ({
    children: [], style: { setProperty() {} },
    append(...children) { this.children.push(...children); },
    addEventListener() {}, setAttribute() {},
  });
  const nav = element();
  const stop = new Error('sidebar rendered');
  assert.throws(() => vm.runInNewContext(script, {
    document: {
      getElementById(id) {
        if (id === 'board-data') return { textContent: data };
        if (id === 'projects') return nav;
        if (id === 'crumb') throw stop;
        return element();
      },
      createElement: element,
      querySelectorAll: () => [], documentElement: element(),
    },
    window: { addEventListener() {} },
  }), error => error === stop);
  return nav.children.map(button => ({
    name: button.title,
    count: button.children[button.children.length - 1].textContent,
  }));
}

test('board project list keeps counts, latest dates and stable date ties', () => {
  const task = (project, started) => ({ project, started });
  assert.deepEqual(projectList([
    task('first', '2026-10-10 09:00'),
    task('second', '2026-10-18 12:00'),
    task('tie-a', '2026-10-15 12:00'),
    task('tie-b', '2026-10-15 12:00'),
    task('constructor', '2026-10-12 12:00'),
    task('first', '2026-10-19 12:00'),
    task('second', '2026-10-11 12:00'),
  ]), [
    { name: 'All projects', count: '7' },
    { name: 'first', count: '2' },
    { name: 'second', count: '2' },
    { name: 'tie-a', count: '1' },
    { name: 'tie-b', count: '1' },
    { name: 'constructor', count: '1' },
  ]);
  assert.deepEqual(projectList([]), [{ name: 'All projects', count: '0' }]);
});

module.exports = { projectList };
