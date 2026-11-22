#!/usr/bin/env node
// INSTALL.md's Troubleshooting section names files, env vars and anchors the
// hooks actually use. Guards drift between those claims and the code/docs.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const install = fs.readFileSync(path.join(root, 'INSTALL.md'), 'utf8');
const config = require(path.join(root, 'hooks', 'ponytail-config.js'));

function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]/g, '')
    .replace(/ /g, '-');
}

function anchors(markdown) {
  return new Set(
    [...markdown.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1])),
  );
}

function section(markdown, title) {
  const start = markdown.indexOf(`## ${title}\n`);
  if (start === -1) return null;
  const rest = markdown.slice(start + title.length + 4);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

const troubleshooting = section(install, 'Troubleshooting');

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('INSTALL.md has a Troubleshooting section', () => {
  assert.ok(troubleshooting, 'missing ## Troubleshooting');
  assert.ok(troubleshooting.trim().length > 0);
});

test('Troubleshooting sits right before Uninstall', () => {
  const headings = [...install.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const i = headings.indexOf('Troubleshooting');
  assert.notEqual(i, -1);
  assert.equal(headings[i + 1], 'Uninstall');
});

test('Troubleshooting in-page links resolve to INSTALL.md headings', () => {
  const own = anchors(install);
  const links = [...troubleshooting.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length >= 3, 'expected links to install, settings and cursor');
  for (const a of links) assert.ok(own.has(a), `broken anchor #${a}`);
});

test('Troubleshooting links to the Cursor hooks Limitations section', () => {
  const links = [...troubleshooting.matchAll(/\]\((docs\/[^)#]+)#([^)]+)\)/g)];
  assert.ok(links.length > 0, 'expected a docs/ link with an anchor');
  for (const [, file, anchor] of links) {
    const full = path.join(root, file);
    assert.ok(fs.existsSync(full), `missing ${file}`);
    assert.ok(anchors(fs.readFileSync(full, 'utf8')).has(anchor), `broken ${file}#${anchor}`);
  }
});

test('documented Claude flag path matches getClaudeDir and the runtime state file', () => {
  assert.match(troubleshooting, /~\/\.claude\/\.ponytail-active/);
  assert.match(troubleshooting, /\$CLAUDE_CONFIG_DIR\/\.ponytail-active/);
  const runtime = fs.readFileSync(path.join(root, 'hooks', 'ponytail-runtime.js'), 'utf8');
  assert.match(runtime, /STATE_FILE = '\.ponytail-active'/);
  withEnv({ CLAUDE_CONFIG_DIR: undefined }, () => {
    assert.equal(config.getClaudeDir(), path.join(os.homedir(), '.claude'));
  });
  withEnv({ CLAUDE_CONFIG_DIR: '/tmp/ccdir' }, () => {
    assert.equal(config.getClaudeDir(), '/tmp/ccdir');
  });
});

test('documented Cursor flag path is the one the Cursor docs describe', () => {
  assert.match(troubleshooting, /~\/\.cursor\/\.ponytail-active/);
  const cursorDoc = fs.readFileSync(path.join(root, 'docs', 'cursor-hooks.md'), 'utf8');
  assert.ok(cursorDoc.includes('~/.cursor/.ponytail-active'));
  assert.ok(cursorDoc.includes('.cursor/rules/ponytail.mdc'));
  assert.ok(troubleshooting.includes('.cursor/rules/ponytail.mdc'));
});

test('config.json is read from $XDG_CONFIG_HOME/ponytail when set', () => {
  assert.match(troubleshooting, /\$XDG_CONFIG_HOME\/ponytail\//);
  withEnv({ XDG_CONFIG_HOME: '/tmp/xdg' }, () => {
    assert.equal(config.getConfigPath(), path.join('/tmp/xdg', 'ponytail', 'config.json'));
  });
});

test('config.json falls back to ~/.config/ponytail without XDG_CONFIG_HOME', { skip: process.platform === 'win32' }, () => {
  assert.match(troubleshooting, /~\/\.config\/ponytail\//);
  withEnv({ XDG_CONFIG_HOME: undefined }, () => {
    assert.equal(config.getConfigDir(), path.join(os.homedir(), '.config', 'ponytail'));
  });
});

function withConfig(body, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-docs-'));
  fs.mkdirSync(path.join(dir, 'ponytail'));
  fs.writeFileSync(path.join(dir, 'ponytail', 'config.json'), body);
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('invalid config JSON is ignored and the level falls back to full', () => {
  withConfig('{not json', (dir) => {
    withEnv({ XDG_CONFIG_HOME: dir, PONYTAIL_DEFAULT_MODE: undefined }, () => {
      assert.equal(config.getDefaultMode(), 'full');
    });
  });
});

test('unknown defaultMode is ignored and the level falls back to full', () => {
  withConfig(JSON.stringify({ defaultMode: 'turbo' }), (dir) => {
    withEnv({ XDG_CONFIG_HOME: dir, PONYTAIL_DEFAULT_MODE: undefined }, () => {
      assert.equal(config.getDefaultMode(), 'full');
    });
  });
});

test('invalid config falls back to PONYTAIL_DEFAULT_MODE when set', () => {
  withConfig('{not json', (dir) => {
    withEnv({ XDG_CONFIG_HOME: dir, PONYTAIL_DEFAULT_MODE: 'lite' }, () => {
      assert.equal(config.getDefaultMode(), 'lite');
    });
  });
});

test('PONYTAIL_MAP=0 is the switch the activate hook checks', () => {
  assert.match(troubleshooting, /`PONYTAIL_MAP=0`/);
  const activate = fs.readFileSync(path.join(root, 'hooks', 'ponytail-activate.js'), 'utf8');
  assert.match(activate, /process\.env\.PONYTAIL_MAP !== '0'/);
});
