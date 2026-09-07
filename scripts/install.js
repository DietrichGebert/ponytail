#!/usr/bin/env node
// ponytail — one-shot installer.
//
// Finds the agents you actually have on this machine and installs ponytail into
// each of them, running the same commands the README documents. Safe to rerun:
// a second run just re-issues each host's own install command, and the
// instruction-file installs rewrite only the block between ponytail's markers.
//
//   node scripts/install.js              install into every detected host
//   node scripts/install.js --dry-run    print what it would do, change nothing

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = 'DietrichGebert/ponytail';
const REPO_URL = `https://github.com/${REPO}`;
const ROOT = path.join(__dirname, '..');
const HOME = os.homedir();
const BEGIN = '<!-- ponytail:begin -->';
const END = '<!-- ponytail:end -->';
const STEP_TIMEOUT_MS = 120000;

// The ruleset written into instruction files. Not AGENTS.md: that ends with a
// note addressed to agents working on this repo, which scripts/check-rule-copies.js
// strips for exactly that reason. .agents/rules/ponytail.md is the host-agnostic
// copy CI already keeps in sync with it.
const RULES_FILE = '.agents/rules/ponytail.md';

// Every host ponytail supports that can be installed without a human in the
// loop. `cli` hosts are detected by their binary on PATH and installed with the
// commands from the README; `dir` hosts have no installer CLI, so they get the
// always-on ruleset written into the global instruction file they already read.
// One row per host — adding an ecosystem is a row, not a branch.
//
// Every command in `steps` must succeed for the host to count as installed. A
// `precondition` runs first and is allowed to fail, for the one host measured
// to report an already-registered marketplace as an error; anywhere else a
// failing command is a failing install, which is what the summary promises.
const HOSTS = [
  {
    id: 'claude', name: 'Claude Code', cli: 'claude',
    steps: [
      ['plugin', 'marketplace', 'add', REPO],
      ['plugin', 'install', 'ponytail@ponytail'],
    ],
  },
  {
    id: 'codex', name: 'Codex', cli: 'codex',
    steps: [
      ['plugin', 'marketplace', 'add', REPO],
      ['plugin', 'add', 'ponytail@ponytail'],
    ],
    note: 'run `codex`, open /hooks, trust the two lifecycle hooks, then start a new thread',
  },
  {
    id: 'copilot', name: 'GitHub Copilot CLI', cli: 'copilot',
    // Measured: this exits 1 with "Marketplace already registered" on a second
    // run, while the same command on claude and codex exits 0. It is the only
    // host that needs its marketplace step treated as a precondition.
    precondition: ['plugin', 'marketplace', 'add', REPO],
    steps: [['plugin', 'install', 'ponytail@ponytail']],
  },
  {
    id: 'gemini', name: 'Gemini CLI', cli: 'gemini',
    steps: [['extensions', 'install', REPO_URL]],
  },
  {
    id: 'antigravity', name: 'Antigravity CLI', cli: 'agy',
    steps: [['plugin', 'install', REPO_URL]],
  },
  {
    id: 'grok', name: 'Grok Build', cli: 'grok',
    steps: [['plugin', 'install', REPO, '--trust']],
    note: 'plugins are off by default; enable ponytail via /plugins or ~/.grok/config.toml',
  },
  {
    id: 'pi', name: 'Pi agent harness', cli: 'pi',
    steps: [['install', `git:github.com/${REPO}`]],
  },
  {
    id: 'hermes', name: 'Hermes Agent', cli: 'hermes',
    steps: [['plugins', 'install', REPO, '--enable']],
    note: 'restart Hermes to pick up the plugin',
  },
  {
    id: 'devin', name: 'Devin CLI', cli: 'devin',
    steps: [['plugins', 'install', REPO]],
  },
  {
    id: 'openclaw', name: 'OpenClaw', cli: 'clawhub',
    steps: [['install', 'ponytail']],
  },
  {
    id: 'swival', name: 'Swival', cli: 'swival',
    steps: [
      ['skills', 'add', '--global', REPO_URL],
      ['skills', 'add', '--global', 'ponytail'],
    ],
  },
  // Instruction-tier hosts: no installer CLI, but they auto-load a known global
  // file. Detected by the config directory they create on first run — never
  // created here, so an agent you don't have stays uninstalled.
  {
    id: 'amp', name: 'Amp (Sourcegraph)', dir: '.config/amp',
    file: '.config/amp/AGENTS.md', merge: true,
  },
  {
    id: 'kiro', name: 'Kiro', dir: '.kiro',
    // copy, not merge: the Kiro steering file needs its YAML frontmatter on
    // line 1, and a marker comment above that breaks Kiro's parser.
    //
    // `owner` is what makes replacing it safe. ~/.kiro/steering is the user's
    // own directory of hand-written rules, not a plugin folder, so the file
    // name alone does not make the file ours -- someone can have written their
    // own ponytail.md. An existing file is only replaced when it carries this
    // title, which every version of our copy has; uninstall uses the same
    // string, so install and removal agree on what ownership means.
    file: '.kiro/steering/ponytail.md', copy: '.kiro/steering/ponytail.md',
    owner: 'title: Ponytail, lazy senior dev mode',
  },
  // Fallbacks: same host as a `cli` row above, used only when that CLI is
  // missing, so a plugin install and an instruction copy never both land.
  {
    id: 'codex-instructions', name: 'Codex (instruction fallback)', dir: '.codex',
    file: '.codex/AGENTS.md', merge: true, skipIfCli: 'codex',
  },
  {
    id: 'copilot-instructions', name: 'Copilot CLI (instruction fallback)', dir: '.copilot',
    file: '.copilot/copilot-instructions.md', merge: true, skipIfCli: 'copilot',
  },
];

// Returns the absolute path of `cmd` on PATH, or null. It has to be the
// resolved path, not just a yes/no: on Windows the host CLIs are .cmd shims
// that Node can only spawn through cmd.exe, and cmd.exe resolves a bare name
// from the CURRENT DIRECTORY before PATH — so a stray claude.cmd in whatever
// folder the installer was started from would run instead of the real one.
function onPath(cmd) {
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.COM;.EXE;.CMD;.BAT').split(';').map((e) => e.trim()).filter(Boolean)
    : [''];
  const mode = process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK;
  for (const raw of (process.env.PATH || '').split(path.delimiter)) {
    // Windows PATH entries may be quoted; the quotes are not part of the path.
    const dir = raw.replace(/^"|"$/g, '');
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      try {
        fs.accessSync(candidate, mode);
        return candidate;
      } catch (_) {
        // not here, keep looking
      }
    }
  }
  return null;
}

// ponytail: detection is "binary on PATH" or "config dir exists" — no version
// probe, no handshake. Ceiling: a renamed CLI, or a config directory left
// behind by an agent that was uninstalled, costs one wasted install attempt,
// reported in the summary. Probe `<cli> --version`, or require a known file
// inside the directory, if that ever misfires often enough to matter.
function detect(host) {
  if (host.skipIfCli && onPath(host.skipIfCli)) return false;
  if (host.cli) return onPath(host.cli) !== null;
  return fs.existsSync(path.join(HOME, host.dir));
}

// Idempotency lives here: rerunning replaces ponytail's own block and leaves
// everything the user wrote around it alone. Malformed markers throw instead of
// guessing where the block ends — guessing is how a rewrite eats user text.
function mergeBlock(existing, body) {
  const block = `${BEGIN}\n${body}\n${END}`;
  if (!existing.trim()) return `${block}\n`;

  const begin = existing.indexOf(BEGIN);
  const end = existing.indexOf(END);
  if (begin === -1 && end === -1) return `${existing.trimEnd()}\n\n${block}\n`;
  if (begin === -1 || end < begin) {
    throw new Error(`ponytail markers are malformed (expected ${BEGIN} before ${END})`);
  }
  if (existing.indexOf(BEGIN, begin + 1) !== -1 || existing.indexOf(END, end + 1) !== -1) {
    throw new Error('more than one ponytail block in this file');
  }
  return existing.slice(0, begin) + block + existing.slice(end + END.length);
}

function rules() {
  return fs.readFileSync(path.join(ROOT, RULES_FILE), 'utf8').trim();
}

// Returns { changed, target }. Throws on a write it cannot do safely.
//
// A dry run takes the same path and stops before the write, so it is a real
// preflight: a file that would be refused says so now instead of printing
// "would write" and failing for the first time on the actual install.
function installFile(host, dryRun) {
  const target = path.join(HOME, host.file);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (host.owner && current !== null && !current.includes(host.owner)) {
    throw new Error(`${target} exists and is not ponytail's -- refusing to overwrite it`);
  }
  const next = host.copy
    ? fs.readFileSync(path.join(ROOT, host.copy), 'utf8')
    : mergeBlock(current || '', rules());
  if (current === next) return { changed: false, target };
  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, next, 'utf8');
  }
  return { changed: true, target };
}

function runStep(bin, args) {
  // stdin is /dev/null so a host CLI that wants to prompt gets EOF and fails
  // fast instead of hanging a `curl | bash` install forever.
  //
  // shell on Windows only: these CLIs install as .cmd shims, and since
  // CVE-2024-27980 Node refuses to spawn a .cmd without a shell. `bin` is the
  // absolute path onPath() resolved, quoted because shell:true does no quoting;
  // every arg is a constant from HOSTS that tests/install.test.js keeps free of
  // shell metacharacters, so cmd.exe has nothing to reinterpret.
  const win = process.platform === 'win32';
  const r = spawnSync(win ? `"${bin}"` : bin, args, {
    shell: win,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: STEP_TIMEOUT_MS,
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.error) return { ok: false, output: r.error.message };
  return { ok: r.status === 0, output };
}

function parseArgs(argv) {
  const opts = { dryRun: false, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--help') opts.help = true;
    else throw new Error(`unknown flag: ${arg}`);
  }
  return opts;
}

const USAGE = `ponytail installer - installs ponytail into every supported agent found on this machine.

Usage: node scripts/install.js [--dry-run]

  --dry-run   print what would run, change nothing

Docs: ${REPO_URL}#install`;

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const hosts = HOSTS.filter(detect);
  if (hosts.length === 0) {
    console.log('ponytail: found no agent that can be installed machine-wide.');
    console.log(`Hosts configured per project are listed at ${REPO_URL}#install`);
    return 0;
  }

  console.log(`ponytail: found ${hosts.length} agent(s): ${hosts.map((h) => h.id).join(', ')}`);

  let installed = 0;
  const failures = [];
  const notes = [];

  for (const host of hosts) {
    // ASCII only: the Windows console's default codepage renders anything else
    // as mojibake, and a curl-pipe install lands on exactly that console.
    console.log(`\n== ${host.name}`);
    if (host.file) {
      try {
        const { changed, target } = installFile(host, opts.dryRun);
        const verb = changed ? (opts.dryRun ? 'would write' : 'wrote') : 'unchanged';
        console.log(`  ${verb} ${target}`);
        installed++;
      } catch (e) {
        console.log(`  failed: ${e.message}`);
        failures.push(host.id);
      }
      continue;
    }

    const bin = onPath(host.cli);
    const report = (result) => {
      if (!result.ok) {
        console.log(`    ${result.output.split('\n').slice(-3).join('\n    ') || 'failed'}`);
      }
    };
    const show = (args) => {
      const line = `${host.cli} ${args.join(' ')}`;
      console.log(opts.dryRun ? `  would run: ${line}` : `  ${line}`);
    };

    // ponytail: the precondition's exit code is ignored, because one host was
    // measured to report an already-registered marketplace as an error and
    // that is the ordinary second-run path. Its output is still printed, and a
    // failure that was real makes the step depending on it fail too. Ceiling:
    // hosts beyond the three I could run are assumed to exit 0 on a redundant
    // command; if one does not, a rerun reports it failed, which is the
    // visible error rather than the silent one.
    if (host.precondition) {
      show(host.precondition);
      if (!opts.dryRun) report(runStep(bin, host.precondition));
    }

    let ok = true;
    for (const args of host.steps) {
      show(args);
      if (opts.dryRun) continue;
      const result = runStep(bin, args);
      report(result);
      if (!result.ok) {
        ok = false;
        break;
      }
    }
    if (ok) {
      installed++;
      if (host.note) notes.push(`${host.name}: ${host.note}`);
    } else {
      failures.push(host.id);
    }
  }

  console.log(`\nponytail: ${installed} ok, ${failures.length} failed${opts.dryRun ? ' (dry run)' : ''}.`);
  for (const note of notes) console.log(`  next: ${note}`);
  if (failures.length) {
    // Any host that did not install is a failed run — a caller piping this into
    // a script must not read a partial install as success.
    console.error(`ponytail: install by hand for the rest: ${REPO_URL}#install`);
    return 1;
  }
  return 0;
}

// exitCode, not process.exit(): process.exit truncates buffered stdout when
// stdout is a pipe, which is what a PowerShell or shell pipeline gives us.
if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { HOSTS, mergeBlock, parseArgs, detect, onPath, main, BEGIN, END, RULES_FILE };
