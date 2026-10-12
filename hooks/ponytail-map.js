#!/usr/bin/env node
// ponytail — codebase map: what already exists, so "reuse first" costs no search.
//
// Lists the top-level functions, classes and exports of the project's source files, one line
// per folder, inside a character budget. No model, no dependencies: `git ls-files` (or a short
// directory walk) plus a regex per language. Tests, generated and vendored files are skipped;
// shared code (utils, lib, services, components, hooks) is listed first when the budget is tight.
//
// ponytail: regex, not a parser. Misses nested or dynamic definitions; a tree-sitter index is the
// upgrade if the map ever needs to be exact.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BUDGET = Number(process.env.PONYTAIL_MAP_CHARS || 2000);
const MAX_FILES = 4000;
const SRC = /\.(py|js|jsx|mjs|cjs|ts|tsx|go|rs|rb|java|kt|php|swift|cs)$/;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|vendor|venv|\.venv|__pycache__|coverage|\.next|target|migrations|versions|fixtures|tests?|__tests__|spec)(\/|$)/;
const SKIP_FILE = /(^|\/)(test_[^/]*|[^/]*(_test|\.test|\.spec|\.gen|\.min|\.d)\.[a-z]+)$/;
const SHARED = /(util|helper|lib|common|shared|service|component|hook|core|model|schema|api)/i;

const PATTERNS = {
  py: [/^(?:async\s+)?def\s+([A-Za-z]\w*)/gm, /^class\s+([A-Za-z]\w*)/gm],
  js: [/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm,
       /^export\s*\{([^}]*)\}/gm],
  go: [/^func\s+(?:\([^)]*\)\s*)?([A-Z]\w*)/gm, /^type\s+([A-Z]\w*)/gm],
  rs: [/^pub\s+(?:async\s+)?(?:fn|struct|enum|trait|type)\s+(\w+)/gm],
  rb: [/^\s*(?:def|class|module)\s+([A-Za-z][\w.]*)/gm],
  jvm: [/^\s*(?:public\s+)?(?:static\s+)?(?:final\s+)?(?:class|interface|enum|record)\s+(\w+)/gm],
};
const LANG = { py: 'py', js: 'js', jsx: 'js', mjs: 'js', cjs: 'js', ts: 'js', tsx: 'js', go: 'go', rs: 'rs',
               rb: 'rb', java: 'jvm', kt: 'jvm', swift: 'jvm', cs: 'jvm', php: 'jvm' };

function listFiles(root) {
  try {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 })
      .split('\n').filter(Boolean).slice(0, MAX_FILES * 5);
    if (tracked.length) return tracked;
  } catch (e) { /* not a git repo: walk below */ }
  {
    // No git, or an untracked folder inside a parent repo (git ls-files is then empty, not an error).
    const out = [];
    (function walk(dir, depth) {
      if (depth > 6 || out.length > MAX_FILES * 5) return;
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name.startsWith('.')) continue;
        const rel = path.relative(root, path.join(dir, ent.name)).replace(/\\/g, '/');
        if (ent.isDirectory()) { if (!SKIP_DIR.test(rel + '/')) walk(path.join(dir, ent.name), depth + 1); }
        else out.push(rel);
      }
    })(root, 0);
    return out;
  }
}

function namesIn(file, text) {
  const lang = LANG[path.extname(file).slice(1)];
  const names = [];
  for (const re of PATTERNS[lang] || []) {
    for (const m of text.matchAll(re)) {
      for (const n of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
        if (!n.startsWith('_') && !names.includes(n)) names.push(n);
      }
    }
  }
  return names;
}

function buildMap(root = process.cwd()) {
  const files = listFiles(root)
    .filter((f) => SRC.test(f) && !SKIP_DIR.test(f) && !SKIP_FILE.test(f))
    .slice(0, MAX_FILES)
    .sort((a, b) => (SHARED.test(b) - SHARED.test(a)) || a.localeCompare(b));
  // One line per directory: names are enough to know something exists; grep finds the file.
  const dirs = new Map();
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(path.join(root, f), 'utf8').slice(0, 65536); } catch (e) { continue; }
    const names = namesIn(f, text);
    if (!names.length) continue;
    const dir = path.dirname(f) === '.' ? '.' : path.dirname(f);
    dirs.set(dir, [...(dirs.get(dir) || []), names]);
  }
  const lines = [];
  let used = 0;
  let skipped = 0;
  for (const [dir, perFile] of dirs) {
    // The first exports say what a file is; in a folder of many files (a UI kit) one name each.
    const names = [...new Set(perFile.flatMap((n) => n.slice(0, perFile.length > 8 ? 1 : 3)))];
    const line = `${dir}/: ${names.slice(0, 30).join(', ')}${names.length > 30 ? ', ...' : ''}`;
    if (used + line.length > BUDGET) { skipped++; continue; }
    lines.push(line);
    used += line.length + 1;
  }
  if (!lines.length) return '';
  return 'Codebase map (what already exists; reuse it, read a file only when you need its details):\n' +
    lines.join('\n') + (skipped ? `\n(${skipped} more folders not listed)` : '');
}

module.exports = { buildMap };

if (require.main === module) process.stdout.write(buildMap(process.argv[2] || process.cwd()) + '\n');
