#!/usr/bin/env node
// The installer is the one-line entry point users get from a curl pipe, and it
// writes into files it does not own, so the guards here are: the host table's
// shape, that a run actually installs the ruleset, and that a rerun cannot
// duplicate or eat anything.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const INSTALLER = path.join(root, 'scripts', 'install.js');
const { HOSTS, mergeBlock, parseArgs, onPath, BEGIN, END, RULES_FILE } = require('../scripts/install.js');

// Windows runs the host CLIs through cmd.exe (their .cmd shims cannot be
// spawned without a shell), so every argument in the table has to be inert
// there. Same spirit as the POSIX guard in hooks-windows.test.js.
const SHELL_SAFE_ARG = /^[A-Za-z0-9@:/._#-]+$/;

// Every spawn pins PATH and HOME: without that, detection depends on whichever
// agents the developer or the CI runner happens to have, and a test could
// install into a real one.
function run(args, { home, binDir = '' } = {}) {
  return spawnSync(process.execPath, [INSTALLER, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home, PATH: binDir },
    encoding: 'utf8',
  });
}

function tempHome(seed = () => {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-install-'));
  const home = path.join(temp, 'home');
  fs.mkdirSync(home, { recursive: true });
  seed(home);
  return { temp, home, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) };
}

// A stand-in host CLI, so the CLI branch is exercised without touching a real
// agent. Windows would need .cmd shims and a PATHEXT dance; the branch it would
// prove is the same one, so POSIX-only is enough.
// `codes` is the exit status per invocation, so a test can say "the first
// command fails, the second succeeds" -- the case that decides whether a
// failure early in a host's sequence is caught or swallowed.
function fakeCli(name, codes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-bin-'));
  const bin = path.join(dir, name);
  const ranLog = path.join(dir, 'ran.log');
  const list = [].concat(codes);
  const counter = path.join(dir, 'count');
  // Builtins only: the tests pin PATH to this directory, so wc/tr/cat are not
  // reachable from inside the script.
  fs.writeFileSync(bin, [
    '#!/bin/sh',
    'n=0',
    `[ -f "${counter}" ] && read n < "${counter}"`,
    'n=$((n+1))',
    `echo "$n" > "${counter}"`,
    `echo "$@" >> "${ranLog}"`,
    'case "$n" in',
    ...list.map((code, i) => `  ${i + 1}) exit ${code} ;;`),
    `  *) exit ${list[list.length - 1]} ;;`,
    'esac',
    '',
  ].join('\n'));
  fs.chmodSync(bin, 0o755);
  return {
    dir,
    ran: () => fs.existsSync(ranLog),
    calls: () => (fs.existsSync(ranLog) ? fs.readFileSync(ranLog, 'utf8').trim().split('\n') : []),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

const rulesBody = fs.readFileSync(path.join(root, RULES_FILE), 'utf8').trim();

test('every host row is either a CLI install or a file install', () => {
  const ids = new Set();
  const clis = new Set(HOSTS.map((h) => h.cli).filter(Boolean));

  for (const host of HOSTS) {
    assert.ok(host.id && host.name, `host missing id/name: ${JSON.stringify(host)}`);
    assert.ok(!ids.has(host.id), `duplicate host id: ${host.id}`);
    ids.add(host.id);

    if (host.cli) {
      assert.ok(Array.isArray(host.steps) && host.steps.length, `${host.id}: cli host needs steps`);
      for (const args of [...(host.precondition ? [host.precondition] : []), ...host.steps]) {
        assert.ok(Array.isArray(args), `${host.id}: step args must be an array (no shell string)`);
        for (const arg of args) {
          assert.match(arg, SHELL_SAFE_ARG, `${host.id}: ${arg} is not safe for the Windows shell path`);
        }
      }
    } else {
      assert.ok(host.dir, `${host.id}: file host needs a detection dir`);
      assert.ok(host.file, `${host.id}: file host needs a target file`);
      assert.ok(host.merge || host.copy, `${host.id}: file host needs merge or copy`);
      // A dir host must never be detected by a directory it also creates.
      assert.ok(host.file.startsWith(host.dir), `${host.id}: target should live under ${host.dir}`);
    }

    // A fallback row is only suppressed if it names a CLI some row can detect.
    if (host.skipIfCli) {
      assert.ok(clis.has(host.skipIfCli), `${host.id}: skipIfCli '${host.skipIfCli}' is no host's cli`);
    }
  }
});

test('files a host copies verbatim exist in the repo and declare ownership', () => {
  for (const host of HOSTS.filter((h) => h.copy)) {
    const source = path.join(root, host.copy);
    assert.ok(fs.existsSync(source), `${host.id}: missing source ${host.copy}`);
    // A whole-file copy lands in a directory the user writes by hand, so it
    // needs a marker that says the target is ours before it may be replaced.
    assert.ok(host.owner, `${host.id}: a copy host must declare owner`);
    assert.ok(
      fs.readFileSync(source, 'utf8').includes(host.owner),
      `${host.id}: the repo copy does not contain its own owner string`,
    );
  }
  // The ruleset source is .agents/rules/ponytail.md, not AGENTS.md, whose
  // trailing note is addressed to agents working on this repo.
  assert.ok(rulesBody.length > 500, `${RULES_FILE} is empty or truncated`);
  assert.ok(!rulesBody.includes('this file also applies to agents working on the ponytail repo'));
});

test('mergeBlock is idempotent and keeps the user content around it', () => {
  const existing = '# My own instructions\n\nAlways use tabs.\n\nSee you later.\n';

  const once = mergeBlock(existing, 'RULE ONE\nRULE TWO');
  assert.ok(once.includes('Always use tabs.'), 'user content before the block was dropped');
  assert.ok(once.includes(BEGIN) && once.includes(END), 'markers missing');

  assert.equal(mergeBlock(once, 'RULE ONE\nRULE TWO'), once, 'rerunning changed the file');

  // A ruleset update replaces the block instead of appending a second one, and
  // whatever the user wrote on either side of it survives.
  const withTail = `${once}\nmy tail notes\n`;
  const updated = mergeBlock(withTail, 'RULE ONE\nRULE THREE');
  assert.equal(updated.match(new RegExp(BEGIN, 'g')).length, 1, 'second block appended');
  assert.ok(updated.includes('RULE THREE') && !updated.includes('RULE TWO'));
  assert.ok(updated.includes('Always use tabs.'), 'leading user content lost on rewrite');
  assert.ok(updated.includes('my tail notes'), 'trailing user content lost on rewrite');
});

test('mergeBlock writes a clean file when there is nothing there yet', () => {
  assert.equal(mergeBlock('', 'BODY'), `${BEGIN}\nBODY\n${END}\n`);
});

test('mergeBlock refuses to guess when the markers are malformed', () => {
  // Each of these used to append a second block, after which the next run
  // matched from the first BEGIN to the only END and deleted the user's text
  // in between. Refusing is the only option that cannot lose content.
  const truncated = `notes\n${BEGIN}\nstale rules\n`;
  const reversed = `${END}\nmine\n${BEGIN}\n`;
  const doubled = `${BEGIN}\na\n${END}\nmine\n${BEGIN}\nb\n${END}\n`;

  for (const [label, text] of [['truncated', truncated], ['reversed', reversed], ['doubled', doubled]]) {
    assert.throws(() => mergeBlock(text, 'NEW'), /malformed|more than one/, `${label} should throw`);
  }
});

test('parseArgs accepts the documented flags and rejects the rest', () => {
  assert.equal(parseArgs(['--dry-run']).dryRun, true);
  assert.equal(parseArgs(['--help']).help, true);
  assert.throws(() => parseArgs(['--force']), /unknown flag/);
  assert.throws(() => parseArgs(['-n']), /unknown flag/);
});

// The table is a second copy of the per-host commands in the README and nothing
// generates one from the other, so bind them: every command the installer runs
// must appear verbatim in that host's own README section.
test('every host command appears verbatim in its README section', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const install = readme.slice(readme.indexOf('## Install'), readme.indexOf('### Uninstall'));
  const sections = [...install.matchAll(/^### (.+)$/gm)].map((m) => m[1].trim());

  for (const host of HOSTS.filter((h) => h.cli)) {
    const start = install.indexOf(`### ${host.name}`);
    assert.notEqual(start, -1, `${host.id}: no "### ${host.name}" section in the README Install section`);
    const next = install.indexOf('\n### ', start + 1);
    const body = install.slice(start, next === -1 ? undefined : next);
    for (const args of [...(host.precondition ? [host.precondition] : []), ...host.steps]) {
      const command = `${host.cli} ${args.join(' ')}`;
      assert.ok(body.includes(command), `${host.id}: README section does not document \`${command}\``);
    }
  }

  // Sections with no row are fine only when they are project-scoped hosts the
  // installer deliberately leaves manual. Pin that list so a new CLI-installable
  // host cannot be documented and then silently skipped by the installer.
  const MANUAL = ['OpenCode', 'Qoder', 'CodeWhale'];
  const OWN_SECTION = 'One line, every agent you have';
  const covered = new Set(HOSTS.map((h) => h.name));
  for (const section of sections.filter((s) => s !== OWN_SECTION)) {
    assert.ok(
      covered.has(section) || MANUAL.includes(section),
      `README documents "${section}" but no installer row covers it (add a row, or add it to MANUAL with a reason)`,
    );
  }
});

// End-to-end against a throwaway home, the same way uninstall.test.js drives
// scripts/uninstall.js. "Safe to rerun" is the README's claim, so it is checked
// by actually rerunning it.
test('installing into a temp home writes the ruleset and is idempotent', () => {
  const { home, cleanup } = tempHome((h) => {
    fs.mkdirSync(path.join(h, '.config', 'amp'), { recursive: true });
    fs.mkdirSync(path.join(h, '.kiro'), { recursive: true });
    fs.writeFileSync(path.join(h, '.config', 'amp', 'AGENTS.md'), '# My own rules\n\nAlways use tabs.\n');
  });
  try {
    const ampFile = path.join(home, '.config', 'amp', 'AGENTS.md');
    const kiroFile = path.join(home, '.kiro', 'steering', 'ponytail.md');

    const first = run([], { home });
    assert.equal(first.status, 0, first.stderr);
    // The Windows console's default codepage turns anything else into mojibake,
    // and a curl-pipe install lands on exactly that console.
    assert.match(first.stdout, /^[\x00-\x7f]*$/, 'installer printed a non-ASCII character');

    const amp = fs.readFileSync(ampFile, 'utf8');
    assert.ok(amp.includes('Always use tabs.'), 'user content was dropped');
    assert.ok(
      amp.slice(amp.indexOf(BEGIN), amp.indexOf(END)).includes(rulesBody),
      'the block does not contain the ruleset — an empty or wrong body would pass without this',
    );
    assert.equal(
      fs.readFileSync(kiroFile, 'utf8'),
      fs.readFileSync(path.join(root, '.kiro', 'steering', 'ponytail.md'), 'utf8'),
      'Kiro steering file does not match the repo copy',
    );

    const second = run([], { home });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(fs.readFileSync(ampFile, 'utf8'), amp, 'second run changed the merged file');
    assert.equal(
      fs.readFileSync(kiroFile, 'utf8'),
      fs.readFileSync(path.join(root, '.kiro', 'steering', 'ponytail.md'), 'utf8'),
      'second run rewrote the Kiro file with something else',
    );
    assert.equal(
      (second.stdout.match(/unchanged/g) || []).length, 2,
      'both hosts should report unchanged on a second run, not just one',
    );
  } finally {
    cleanup();
  }
});

test('--dry-run writes nothing and runs no host CLI', (t) => {
  if (process.platform === 'win32') return t.skip('fake CLI fixture is POSIX-only');

  const cli = fakeCli('clawhub', [0]);
  const { home, cleanup } = tempHome((h) => {
    fs.mkdirSync(path.join(h, '.config', 'amp'), { recursive: true });
    fs.mkdirSync(path.join(h, '.kiro'), { recursive: true });
  });
  try {
    const r = run(['--dry-run'], { home, binDir: cli.dir });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /would write/);
    assert.match(r.stdout, /would run: clawhub install ponytail/);
    assert.equal(fs.existsSync(path.join(home, '.config', 'amp', 'AGENTS.md')), false, '--dry-run wrote the amp file');
    assert.equal(fs.existsSync(path.join(home, '.kiro', 'steering')), false, '--dry-run wrote the Kiro file');
    assert.equal(cli.ran(), false, '--dry-run executed a host CLI');
  } finally {
    cli.cleanup();
    cleanup();
  }
});

test('an absent host is never detected and never gets a directory', () => {
  const { home, cleanup } = tempHome();
  try {
    const r = run([], { home });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /found no agent/);
    assert.equal(fs.existsSync(path.join(home, '.kiro')), false, 'installer created a directory for an absent host');
    assert.equal(fs.existsSync(path.join(home, '.config')), false);
  } finally {
    cleanup();
  }
});

test('a partial install reports the failure and still writes the host that worked', () => {
  const { home, cleanup } = tempHome((h) => {
    fs.mkdirSync(path.join(h, '.config', 'amp'), { recursive: true });
    // Occupy the Kiro target with a directory so its write fails for a real reason.
    fs.mkdirSync(path.join(h, '.kiro', 'steering', 'ponytail.md'), { recursive: true });
  });
  try {
    const r = run([], { home });
    assert.equal(r.status, 1, 'a failed host must not exit 0');
    assert.match(r.stdout, /1 ok, 1 failed/);
    assert.ok(
      fs.readFileSync(path.join(home, '.config', 'amp', 'AGENTS.md'), 'utf8').includes(BEGIN),
      'the host that could be installed was skipped because another failed',
    );
  } finally {
    cleanup();
  }
});

test('--help prints usage and installs nothing', () => {
  const { home, cleanup } = tempHome((h) => fs.mkdirSync(path.join(h, '.kiro'), { recursive: true }));
  try {
    const r = run(['--help'], { home });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Usage: node scripts\/install\.js/);
    assert.match(r.stdout, /^[\x00-\x7f]*$/, 'usage text printed a non-ASCII character');
    assert.equal(fs.existsSync(path.join(home, '.kiro', 'steering')), false, '--help installed something');
  } finally {
    cleanup();
  }
});

test('an unknown flag is a usage error on stderr', () => {
  const { home, cleanup } = tempHome();
  try {
    const r = run(['--force'], { home });
    assert.equal(r.status, 2, 'unknown flag should exit 2');
    assert.match(r.stderr, /unknown flag: --force/);
    assert.match(r.stderr, /Usage: node/);
  } finally {
    cleanup();
  }
});

test('a host CLI that succeeds is installed, one that fails exits non-zero', (t) => {
  if (process.platform === 'win32') return t.skip('fake CLI fixture is POSIX-only');

  for (const [exitCode, wantStatus, wantSummary] of [[0, 0, /1 ok, 0 failed/], [1, 1, /0 ok, 1 failed/]]) {
    const cli = fakeCli('clawhub', [exitCode]);
    const { home, cleanup } = tempHome();
    try {
      const r = run([], { home, binDir: cli.dir });
      assert.match(r.stdout, /openclaw/, 'the fake CLI was not detected on PATH');
      assert.equal(r.status, wantStatus, `exit ${exitCode} CLI should give status ${wantStatus}: ${r.stdout}`);
      assert.match(r.stdout, wantSummary);
    } finally {
      cli.cleanup();
      cleanup();
    }
  }
});

test('a host with its CLI present skips the instruction fallback', (t) => {
  if (process.platform === 'win32') return t.skip('fake CLI fixture is POSIX-only');

  const cli = fakeCli('codex', [0, 0]);
  const { home, cleanup } = tempHome((h) => fs.mkdirSync(path.join(h, '.codex'), { recursive: true }));
  try {
    const r = run(['--dry-run'], { home, binDir: cli.dir });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\bcodex\b/);
    assert.doesNotMatch(r.stdout, /codex-instructions/, 'plugin install and instruction copy both landed');
  } finally {
    cli.cleanup();
    cleanup();
  }
});

// The win32 spawn path cannot be exercised from POSIX, so pin the property it
// depends on: cmd.exe resolves a bare command name from the current directory
// before PATH, so runStep must be handed the absolute path onPath() found.
test('onPath returns the resolved absolute path, not just a yes/no', (t) => {
  if (process.platform === 'win32') return t.skip('fake CLI fixture is POSIX-only');

  const cli = fakeCli('clawhub', [0]);
  const saved = process.env.PATH;
  process.env.PATH = cli.dir;
  try {
    assert.equal(onPath('clawhub'), path.join(cli.dir, 'clawhub'));
    assert.equal(onPath('ponytail-no-such-binary'), null);
  } finally {
    process.env.PATH = saved;
    cli.cleanup();
  }
});

// install.sh and install.ps1 are twins on purpose: neither holds install logic,
// so the only thing that can drift is what they point at. Pin that.
test('the bash and PowerShell shims agree on repo, default ref, and entry point', () => {
  const sh = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
  const ps = fs.readFileSync(path.join(root, 'install.ps1'), 'utf8');
  for (const [name, text] of [['install.sh', sh], ['install.ps1', ps]]) {
    assert.match(text, /DietrichGebert\/ponytail/, `${name}: repo slug missing`);
    assert.match(text, /PONYTAIL_REF/, `${name}: PONYTAIL_REF override missing`);
    assert.match(text, /'main'|:-main/, `${name}: default ref should be main`);
    assert.match(text, /scripts\/install\.js/, `${name}: does not run scripts/install.js`);
    assert.match(text, /codeload\.github\.com/, `${name}: no archive download path`);
    assert.match(text, /A-Za-z0-9/, `${name}: PONYTAIL_REF reaches a URL path and must be validated`);
  }
});

test('install.sh parses and runs the local installer from a clone', (t) => {
  if (process.platform === 'win32') return t.skip('bash shim is not the Windows path');

  const syntax = spawnSync('bash', ['-n', path.join(root, 'install.sh')], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);

  const { home, cleanup } = tempHome();
  try {
    const r = spawnSync('bash', [path.join(root, 'install.sh'), '--help'], {
      env: { ...process.env, HOME: home, USERPROFILE: home },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Usage: node scripts\/install\.js/, 'the shim did not exec the local installer');
  } finally {
    cleanup();
  }
});

// Windows PowerShell 5.1 reads a BOM-less file as ANSI, and in CP1252 the
// bytes of an em dash decode to a smart quote -- which its parser accepts as a
// string delimiter, so one stray dash inside a string silently breaks the whole
// script on the -File path (it survives `irm | iex`, which decodes UTF-8).
test('the shims are pure ASCII', () => {
  for (const name of ['install.sh', 'install.ps1']) {
    const bytes = fs.readFileSync(path.join(root, name));
    const at = bytes.findIndex((b) => b > 0x7f);
    assert.equal(at, -1, `${name}: non-ASCII byte at offset ${at}`);
  }
});

test('install.ps1 parses under PowerShell', (t) => {
  const probe = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
  if (probe.error) return t.skip('pwsh not installed (GitHub runners have it)');
  const script = path.join(root, 'install.ps1').replace(/'/g, "''");
  const r = spawnSync('pwsh', ['-NoProfile', '-Command',
    `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${script}', [ref]$null, [ref]$e) > $null; ` +
    'if ($e.Count) { $e | ForEach-Object { $_.Message }; exit 1 }',
  ], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// ~/.kiro/steering is the user's own directory of hand-written rules, so a file
// that happens to be named ponytail.md is not automatically ours to replace.
test('a foreign file at the Kiro target is refused, not overwritten', () => {
  const mine = '---\ntitle: my own steering\n---\n\nmy rules\n';
  const { home, cleanup } = tempHome((h) => {
    fs.mkdirSync(path.join(h, '.kiro', 'steering'), { recursive: true });
    fs.writeFileSync(path.join(h, '.kiro', 'steering', 'ponytail.md'), mine);
  });
  try {
    const r = run([], { home });
    assert.equal(r.status, 1, 'refusing to overwrite must be a failed host, not a silent skip');
    assert.match(r.stdout, /refusing to overwrite/);
    assert.equal(
      fs.readFileSync(path.join(home, '.kiro', 'steering', 'ponytail.md'), 'utf8'),
      mine,
      "a user's own steering file must be left byte-for-byte intact",
    );
  } finally {
    cleanup();
  }
});

test('an older ponytail file at the Kiro target is upgraded in place', () => {
  const kiroHost = HOSTS.find((h) => h.id === 'kiro');
  // An earlier version: same title, different body. The upgrade path must not
  // be blocked by the ownership check.
  const older = `---\n${kiroHost.owner}\ninclusion: always\n---\n\nold rules\n`;
  const { home, cleanup } = tempHome((h) => {
    fs.mkdirSync(path.join(h, '.kiro', 'steering'), { recursive: true });
    fs.writeFileSync(path.join(h, '.kiro', 'steering', 'ponytail.md'), older);
  });
  try {
    const r = run([], { home });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(
      fs.readFileSync(path.join(home, '.kiro', 'steering', 'ponytail.md'), 'utf8'),
      fs.readFileSync(path.join(root, kiroHost.copy), 'utf8'),
      'an older copy of our own file must be replaced with the current one',
    );
  } finally {
    cleanup();
  }
});

// Every command in `steps` has to pass. Swival runs two, and the first failing
// must fail the host rather than being overwritten by the second's status.
test('a host whose first step fails is reported failed, and the rest is skipped', (t) => {
  if (process.platform === 'win32') return t.skip('fake CLI fixture is POSIX-only');

  const cli = fakeCli('swival', [1, 0]);
  const { home, cleanup } = tempHome();
  try {
    const r = run([], { home, binDir: cli.dir });
    assert.equal(r.status, 1, 'a failed first step must fail the host');
    assert.match(r.stdout, /0 ok, 1 failed/);
    assert.equal(cli.calls().length, 1, 'the step after a failure should not run');
  } finally {
    cli.cleanup();
    cleanup();
  }
});

// The one measured exception: Copilot CLI exits 1 when its marketplace is
// already registered, which is what a second run always looks like.
test('a failing precondition does not fail the host', (t) => {
  if (process.platform === 'win32') return t.skip('fake CLI fixture is POSIX-only');

  const cli = fakeCli('copilot', [1, 0]);
  const { home, cleanup } = tempHome();
  try {
    const r = run([], { home, binDir: cli.dir });
    assert.equal(r.status, 0, `a precondition failure must not fail the host: ${r.stdout}`);
    assert.match(r.stdout, /1 ok, 0 failed/);
    assert.equal(cli.calls().length, 2, 'the install step must still run after a failed precondition');
  } finally {
    cli.cleanup();
    cleanup();
  }
});

// --dry-run is a preflight, not just an echo: a target it would refuse has to
// say so before the real run, not after.
test('--dry-run reports a refusal it would hit, and still writes nothing', () => {
  const mine = '---\ntitle: my own steering\n---\n\nmy rules\n';
  const { home, cleanup } = tempHome((h) => {
    fs.mkdirSync(path.join(h, '.kiro', 'steering'), { recursive: true });
    fs.writeFileSync(path.join(h, '.kiro', 'steering', 'ponytail.md'), mine);
  });
  try {
    const r = run(['--dry-run'], { home });
    assert.equal(r.status, 1, 'a refusal must be visible in the dry run');
    assert.match(r.stdout, /refusing to overwrite/);
    assert.equal(
      fs.readFileSync(path.join(home, '.kiro', 'steering', 'ponytail.md'), 'utf8'),
      mine,
      'the dry run must not have touched the file',
    );
  } finally {
    cleanup();
  }
});

test('--dry-run says unchanged for a target that is already current', () => {
  const { home, cleanup } = tempHome((h) => fs.mkdirSync(path.join(h, '.kiro'), { recursive: true }));
  try {
    assert.equal(run([], { home }).status, 0);
    const r = run(['--dry-run'], { home });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /unchanged/, 'a dry run over an up-to-date install should not claim it would write');
  } finally {
    cleanup();
  }
});

// The shim's Node check has to fail closed. Keeping every digit in the output
// would concatenate them, so a wrapper that prints its own banner ahead of an
// old Node could read as a new one and pass a check meant to reject it.
test('install.sh rejects a Node whose version cannot be read cleanly', (t) => {
  if (process.platform === 'win32') return t.skip('bash shim is not the Windows path');

  const cases = [
    ['wrapper 2.0\n16', 'a banner ahead of Node 16 must not read as 2016'],
    ['16', 'Node 16 must be rejected'],
    ['not-a-number', 'unparseable output must be rejected'],
  ];
  for (const [stdout, why] of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-node-'));
    try {
      const fake = path.join(dir, 'node');
      fs.writeFileSync(fake, `#!/bin/sh\nprintf '%s\\n' '${stdout.replace(/\n/g, "' '")}'\n`);
      fs.chmodSync(fake, 0o755);
      const r = spawnSync('bash', [path.join(root, 'install.sh'), '--dry-run'], {
        env: { ...process.env, PATH: `${dir}:/usr/bin:/bin` },
        encoding: 'utf8',
      });
      assert.equal(r.status, 1, `${why}: exited ${r.status}`);
      assert.match(r.stderr, /need Node >=18/, why);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

// `iex` runs in the caller's scope, and an `exit` there terminates a calling
// script outright (measured on Windows PowerShell 5.1 and 7.6.5). What keeps
// the piped form safe is that $PSCommandPath is empty under `iex` even when
// the `iex` sits inside another .ps1 -- so the shim takes the branch that only
// sets $LASTEXITCODE. A bad PONYTAIL_REF makes the function return before the
// download, so this exercises the real file without touching the network.
test('the shim never exits the script that pipes it into iex', (t) => {
  const probe = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
  if (probe.error) return t.skip('pwsh not installed (GitHub runners have it)');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-iex-'));
  try {
    const shim = path.join(root, 'install.ps1').replace(/'/g, "''");
    const wrapper = path.join(dir, 'wrapper.ps1');
    fs.writeFileSync(wrapper, [
      "$env:PONYTAIL_REF = 'not/../valid'",
      `Invoke-Expression (Get-Content -Raw '${shim}')`,
      "'WRAPPER-STILL-ALIVE'",
      '',
    ].join('\n'));

    const r = spawnSync('pwsh', ['-NoProfile', '-File', wrapper], { encoding: 'utf8' });
    assert.match(r.stdout, /refusing PONYTAIL_REF/, 'the shim should have refused the ref');
    assert.match(
      r.stdout, /WRAPPER-STILL-ALIVE/,
      'the shim exited the calling script instead of only setting an exit code',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
