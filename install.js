#!/usr/bin/env node
/**
 * ponytail — System-wide installer for all agentic workflows (Node.js)
 *
 * Usage:
 *   node install.js [options]
 *
 * Options:
 *   --all                 Install for all detected agents (default)
 *   --agent <name>        Install for a specific agent (repeatable)
 *   --repo <path>         Path to ponytail repo (default: parent of this script)
 *   --uninstall           Remove all ponytail symlinks and configs
 *   --list                Show installation status for each agent
 *   --dry-run             Show what would be done without doing it
 *   --yes, -y             Non-interactive (skip prompts)
 *   --help                Show this help
 *
 * Supported agents:
 *   claude, codex, copilot, opencode, cursor, windsurf, cline,
 *   kiro, openclaw, gemini, pi, antigravity, codewhale, kilo
 */
const { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync, copyFileSync, rmSync } = require("fs");
const { homedir, platform, EOL } = require("os");
const { join, dirname, basename, resolve, relative } = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = resolve(__dirname);
const CONFIG_DIR = join(homedir(), '.config', 'ponytail');

const isWin = platform() === 'win32';

// ANSI colors
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
};

function log(msg)   { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
function info(msg)  { console.log(`  ${C.cyan}→${C.reset} ${msg}`); }
function warn(msg)  { console.error(`  ${C.yellow}⚠${C.reset} ${msg}`); }
function err(msg)   { console.error(`  ${C.red}✗${C.reset} ${msg}`); }
function hdr(msg)   { console.log(`\n${C.bold}${msg}${C.reset}\n  ${'─'.repeat(msg.length)}`); }

// =========================================================================
//  AGENT DEFINITIONS
// =========================================================================
const AGENTS = [
  {
    name: 'claude',
    label: 'Claude Code',
    detectDir: join(homedir(), '.claude'),
    srcDir: '.claude-plugin',
    linkPath: join(homedir(), '.claude', 'plugins', 'ponytail'),
    detectLabel: 'binary/config/npm',
  },
  {
    name: 'codex',
    label: 'Codex',
    detectDir: join(homedir(), '.codex'),
    srcDir: '.codex-plugin',
    linkPath: join(homedir(), '.codex', 'plugins', 'ponytail'),
    detectLabel: 'binary/config',
  },
  {
    name: 'copilot',
    label: 'GitHub Copilot CLI',
    detectDir: join(homedir(), '.copilot'),
    srcDir: '.github/copilot-instructions.md',
    linkPath: join(homedir(), '.copilot', 'copilot-instructions.md'),
    detectLabel: 'binary/gh-ext/vscode-ext',
  },
  {
    name: 'opencode',
    label: 'OpenCode',
    detectDir: join(homedir(), '.config', 'opencode'),
    srcDir: '.opencode/plugins/ponytail.mjs',
    linkPath: join(homedir(), '.config', 'opencode', 'plugins', 'ponytail.mjs'),
    detectLabel: 'binary/config/npm',
  },
  {
    name: 'cursor',
    label: 'Cursor',
    detectDir: join(homedir(), '.cursor'),
    srcDir: '.cursor/rules/ponytail.mdc',
    linkPath: join(homedir(), '.cursor', 'rules', 'ponytail.mdc'),
    detectLabel: 'binary/config/app',
  },
  {
    name: 'windsurf',
    label: 'Windsurf',
    detectDir: join(homedir(), '.windsurf'),
    srcDir: '.windsurf/rules/ponytail.md',
    linkPath: join(homedir(), '.windsurf', 'rules', 'ponytail.md'),
    detectLabel: 'binary/config/app',
  },
  {
    name: 'cline',
    label: 'Cline / Roo Code',
    detectDir: join(homedir(), '.clinerules'),
    srcDir: '.clinerules/ponytail.md',
    linkPath: join(homedir(), '.clinerules', 'ponytail.md'),
    detectLabel: 'vscode-ext/config',
  },
  {
    name: 'kiro',
    label: 'Kiro',
    detectDir: join(homedir(), '.kiro'),
    srcDir: '.kiro/steering/ponytail.md',
    linkPath: join(homedir(), '.kiro', 'steering', 'ponytail.md'),
    detectLabel: 'binary/config/npm',
  },
  {
    name: 'openclaw',
    label: 'OpenClaw',
    detectDir: join(homedir(), '.openclaw'),
    srcDir: '.openclaw/skills',
    linkPath: join(homedir(), '.openclaw', 'skills', 'ponytail'),
    detectLabel: 'binary/config',
  },
  {
    name: 'gemini',
    label: 'Gemini CLI / Antigravity',
    detectDir: join(homedir(), '.local', 'share', 'gemini'),
    srcDir: 'gemini-extension.json',
    linkPath: '',
    detectLabel: 'binary/config',
  },
  {
    name: 'pi',
    label: 'Pi agent',
    detectDir: join(homedir(), '.pi'),
    srcDir: 'pi-extension',
    linkPath: join(homedir(), '.pi', 'extensions', 'ponytail'),
    detectLabel: 'binary/config/cargo',
  },
  {
    name: 'antigravity',
    label: 'Antigravity CLI',
    detectDir: join(homedir(), '.agents'),
    srcDir: '.agents/rules/ponytail.md',
    linkPath: join(homedir(), '.agents', 'rules', 'ponytail.md'),
    detectLabel: 'binary',
  },
  {
    name: 'kilo',
    label: 'Kilo Code',
    detectDir: join(homedir(), '.kilocode'),
    srcDir: '.opencode/plugins/ponytail.mjs',
    linkPath: join(homedir(), '.config', 'kilo', 'plugins', 'ponytail.mjs'),
    detectLabel: 'binary/config',
  },
  {
    name: 'codewhale',
    label: 'CodeWhale',
    detectDir: '/usr/local/bin/codewhale',
    srcDir: 'AGENTS.md',
    linkPath: '',
    detectLabel: 'binary/npm',
  },
];

// =============================================================================
//  UTILITY FUNCTIONS
// =============================================================================

function detectAgent(agent) {
  // Shared helpers
  const binInPath = (name) => {
    try { execSync(`command -v ${name}`, { stdio: 'ignore' }); return true; }
    catch { return false; }
  };
  const npmGlobal = (pkg) => {
    try {
      if (!binInPath('npm')) return false;
      execSync(`npm ls -g ${pkg}`, { stdio: 'ignore' });
      return true;
    } catch { return false; }
  };
  const vscodeExt = (pattern) => {
    try {
      if (!binInPath('code')) return false;
      const out = execSync('code --list-extensions', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return new RegExp(pattern, 'i').test(out);
    } catch { return false; }
  };
  const ghExt = (pattern) => {
    try {
      if (!binInPath('gh')) return false;
      const out = execSync('gh extension list', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return new RegExp(pattern, 'i').test(out);
    } catch { return false; }
  };
  const cargoPkg = (name) => {
    try {
      if (!binInPath('cargo')) return false;
      const out = execSync('cargo install --list', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return out.includes(name);
    } catch { return false; }
  };
  const vscodeExtDir = (pattern) => {
    for (const base of [join(homedir(), '.vscode', 'extensions'),
                        join(homedir(), '.vscode-server', 'extensions'),
                        join(homedir(), '.vscode-remote', 'extensions')]) {
      try {
        if (!existsSync(base)) continue;
        const entries = readdirSync(base);
        if (entries.some(e => pattern.test(e))) return true;
      } catch {}
    }
    return false;
  };

  switch (agent.name) {
    case 'claude':
      return binInPath('claude') ||
        existsSync(agent.detectDir) ||
        npmGlobal('@anthropic-ai/claude-code') ||
        existsSync('/usr/local/bin/claude') ||
        existsSync('/opt/homebrew/bin/claude');

    case 'codex':
      return binInPath('codex') ||
        existsSync(agent.detectDir) ||
        existsSync(join(homedir(), '.config', 'codex'));

    case 'copilot':
      return binInPath('copilot') ||
        existsSync(agent.detectDir) ||
        ghExt('copilot') ||
        vscodeExt('github.copilot');

    case 'opencode':
      return binInPath('opencode') ||
        existsSync(join(homedir(), '.config', 'opencode', 'opencode.json')) ||
        npmGlobal('opencode');

    case 'cursor':
      return binInPath('cursor') ||
        existsSync(agent.detectDir) ||
        existsSync('/usr/bin/cursor') ||
        existsSync('/opt/cursor/cursor') ||
        existsSync('/Applications/Cursor.app');

    case 'windsurf':
      return binInPath('windsurf') ||
        existsSync(agent.detectDir) ||
        existsSync('/Applications/Windsurf.app');

    case 'cline':
      return existsSync(agent.detectDir) ||
        vscodeExt('saoudrizwan.claude-dev|cline') ||
        vscodeExtDir(/claude-dev|cline/i);

    case 'kiro':
      return binInPath('kiro') ||
        existsSync(agent.detectDir) ||
        npmGlobal('kiro');

    case 'openclaw':
      return binInPath('clawhub');

    case 'gemini':
      return binInPath('gemini') ||
        binInPath('agy') ||
        npmGlobal('@google/gemini-cli');

    case 'pi':
      return binInPath('pi') ||
        existsSync(agent.detectDir) ||
        cargoPkg('pi-agent');

    case 'antigravity':
      return binInPath('agy') ||
        existsSync('/usr/local/bin/agy') ||
        existsSync('/opt/homebrew/bin/agy');

    case 'kilo':
      return binInPath('kilo') ||
        existsSync(join(homedir(), '.config', 'kilo', 'kilo.json')) ||
        vscodeExt('kilo') ||
        vscodeExtDir(/kilo/i) ||
        existsSync(join(agent.detectDir, 'rules.json')) ||
        existsSync(join(agent.detectDir, 'config.json')) ||
        existsSync(join(agent.detectDir, 'plugins'));

    case 'codewhale':
      return binInPath('codewhale') ||
        existsSync('/usr/local/bin/codewhale') ||
        existsSync('/opt/homebrew/bin/codewhale') ||
        npmGlobal('codewhale');

    default:
      return existsSync(agent.detectDir);
  }
}

function ensureRepo(repoPath) {
  // Check if path is valid
  const agentsMd = join(repoPath, 'AGENTS.md');
  const pkgJson = join(repoPath, 'package.json');
  if (existsSync(agentsMd) && existsSync(pkgJson)) {
    info(`Using ponytail repo: ${repoPath}`);
    return repoPath;
  }
  // Check CONFIG_DIR
  if (existsSync(join(CONFIG_DIR, 'AGENTS.md'))) {
    info(`Using existing install: ${CONFIG_DIR}`);
    return CONFIG_DIR;
  }
  // Need to download
  warn('Ponytail not found locally. Downloading...');
  mkdirSync(CONFIG_DIR, { recursive: true });
  try {
    execSync('git clone --depth 1 https://github.com/DietrichGebert/ponytail.git /tmp/ponytail-install', { stdio: 'pipe' });
    copyDirContents('/tmp/ponytail-install', CONFIG_DIR);
    rmSync('/tmp/ponytail-install', { recursive: true, force: true });
    log('Downloaded ponytail');
    return CONFIG_DIR;
  } catch {
    try {
      execSync('curl -fsSL https://github.com/DietrichGebert/ponytail/archive/refs/heads/main.tar.gz | tar -xz -C /tmp/ponytail-tar --strip-components=1', { stdio: 'pipe' });
      copyDirContents('/tmp/ponytail-tar', CONFIG_DIR);
      rmSync('/tmp/ponytail-tar', { recursive: true, force: true });
      log('Downloaded ponytail');
      return CONFIG_DIR;
    } catch {
      err('Failed to download ponytail. Specify --repo <path> or check network.');
      process.exit(1);
    }
  }
}

function copyDirContents(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) {
      copyDirContents(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

function syncFiles(repoRoot) {
  hdr('Syncing ponytail files');
  mkdirSync(CONFIG_DIR, { recursive: true });

  const items = [
    'AGENTS.md', 'gemini-extension.json', 'package.json',
    'hooks', 'skills', 'commands', 'docs', 'assets',
    '.cursor', '.windsurf', '.clinerules', '.kiro',
    '.openclaw', '.opencode', '.github', '.agents',
    '.claude-plugin', '.codex-plugin', 'pi-extension',
  ];

  for (const item of items) {
    const src = join(repoRoot, item);
    const dest = join(CONFIG_DIR, item);
    if (!existsSync(src)) continue;
    if (statSync(src).isDirectory()) {
      copyDirContents(src, dest);
    } else {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
  }
  log('Files synced');

  // Create hooks symlink inside .claude-plugin so plugin.json can find them
  const claudePluginHooks = join(CONFIG_DIR, '.claude-plugin', 'hooks');
  const codexPluginHooks = join(CONFIG_DIR, '.codex-plugin', 'hooks');
  const hooksDir = join(CONFIG_DIR, 'hooks');
  if (existsSync(join(CONFIG_DIR, '.claude-plugin')) && existsSync(hooksDir) && !existsSync(claudePluginHooks)) {
    try { mkdirSync(dirname(claudePluginHooks), { recursive: true }); symlinkSync(hooksDir, claudePluginHooks, 'dir'); } catch {}
  }
  if (existsSync(join(CONFIG_DIR, '.codex-plugin')) && existsSync(hooksDir) && !existsSync(codexPluginHooks)) {
    try { mkdirSync(dirname(codexPluginHooks), { recursive: true }); symlinkSync(hooksDir, codexPluginHooks, 'dir'); } catch {}
  }
}

function symlinkAgent(agent, dryRun) {
  const srcPath = join(CONFIG_DIR, agent.srcDir);
  const linkPath = agent.linkPath;

  if (!linkPath) {
    // Special handling
    if (agent.name === 'gemini') {
      info(`Gemini: run "gemini extensions install https://github.com/DietrichGebert/ponytail"`);
      return true;
    }
    if (agent.name === 'codewhale') {
      info(`CodeWhale: copy AGENTS.md into your project root.`);
      return true;
    }
    return true;
  }

  if (!existsSync(srcPath)) {
    warn(`Source not found: ${srcPath}`);
    return false;
  }

  if (dryRun) {
    info(`[dry-run] Would symlink: ${srcPath} → ${linkPath}`);
    return true;
  }

  try {
    // Special handling for Claude Code and Codex: use their CLI marketplace mechanism
    // They don't scan directories — they require `plugin marketplace add` + `plugin install`
    if (agent.name === 'claude' || agent.name === 'codex') {
      const bin = agent.name === 'claude' ? 'claude' : 'codex';
      const installCmd = agent.name === 'claude' ? 'plugin install ponytail@ponytail' : 'plugin add ponytail@ponytail';
      if (dryRun) {
        info(`[dry-run] Would run: ${bin} plugin marketplace add <repo> && ${bin} ${installCmd}`);
        return true;
      }
      try {
        execSync(`${bin} plugin marketplace add "${REPO_ROOT}"`, { stdio: 'ignore' });
      } catch {}
      try {
        execSync(`${bin} ${installCmd}`, { stdio: 'ignore' });
        log(`${agent.label}: ponytail plugin installed`);
        return true;
      } catch (e) {
        warn(`${agent.label}: plugin install failed — run: ${bin} ${installCmd}`);
        return false;
      }
    }

    // Special handling for Kilo Code (fork of OpenCode): needs plugin entry in kilo.json
    if (agent.name === 'kilo') {
      const kiloConfig = join(homedir(), '.config', 'kilo', 'kilo.json');
      const ponytailMjs = join(CONFIG_DIR, '.opencode', 'plugins', 'ponytail.mjs');
      if (!existsSync(ponytailMjs)) {
        warn(`${agent.label}: ponytail.mjs not found`);
        return false;
      }
      if (dryRun) {
        info(`[dry-run] Would symlink ponytail.mjs and add plugin to kilo.json`);
        return true;
      }
      mkdirSync(dirname(linkPath), { recursive: true });
      if (existsSync(linkPath)) rmSync(linkPath, { recursive: true, force: true });
      execSync(`ln -sf "${ponytailMjs}" "${linkPath}"`);
      // Add plugin entry to kilo.json
      try {
        const s = JSON.parse(readFileSync(kiloConfig, 'utf8'));
        s.plugin = s.plugin || [];
        if (!s.plugin.includes(linkPath)) {
          s.plugin.push(linkPath);
          writeFileSync(kiloConfig, JSON.stringify(s, null, 2));
        }
        log(`${agent.label}: plugin added to kilo.json`);
      } catch (e) {
        warn(`${agent.label}: failed to update kilo.json: ${e.message}`);
      }
      return true;
    }

    mkdirSync(dirname(linkPath), { recursive: true });
    if (existsSync(linkPath)) {
      rmSync(linkPath, { recursive: true, force: true });
    }

    // Use junction on Windows for dirs, symlink on Unix
    if (isWin && statSync(srcPath).isDirectory()) {
      execSync(`mklink /J "${linkPath}" "${srcPath}"`, { stdio: 'ignore' });
    } else {
      const rel = relative(dirname(linkPath), srcPath);
      // Create relative symlink for portability
      const target = rel.startsWith('.') ? rel : relative(dirname(linkPath), srcPath);
      mkdirSync(dirname(linkPath), { recursive: true });
      // On unix use symlink, on windows try symlink dir
      execSync(`ln -sf "${target}" "${linkPath}"`);
    }
    log(`Linked: ${agent.label}`);
    return true;
  } catch (e) {
    err(`Failed to symlink ${agent.label}: ${e.message}`);
    return false;
  }
}

function removeSymlink(agent) {
  // For Claude/Codex, use CLI to uninstall
  if (agent.name === 'claude' || agent.name === 'codex') {
    const bin = agent.name === 'claude' ? 'claude' : 'codex';
    const removeCmd = agent.name === 'claude' ? 'plugin uninstall ponytail' : 'plugin remove ponytail';
    try {
      execSync(`${bin} ${removeCmd}`, { stdio: 'ignore' });
      log(`Uninstalled: ${agent.label}`);
    } catch {}
    try {
      execSync(`${bin} plugin marketplace remove ponytail`, { stdio: 'ignore' });
    } catch {}
    return true;
  }
  // For Kilo Code, remove plugin entry from kilo.json
  if (agent.name === 'kilo') {
    const kiloConfig = join(homedir(), '.config', 'kilo', 'kilo.json');
    if (agent.linkPath && existsSync(agent.linkPath)) rmSync(agent.linkPath, { force: true });
    try {
      const s = JSON.parse(readFileSync(kiloConfig, 'utf8'));
      s.plugin = (s.plugin || []).filter(p => !p.includes('ponytail'));
      writeFileSync(kiloConfig, JSON.stringify(s, null, 2));
      log(`Removed: ${agent.label}`);
    } catch {}
    return true;
  }
  if (!agent.linkPath) return true;
  if (!existsSync(agent.linkPath) && !isSymlink(agent.linkPath)) return true;
  try {
    rmSync(agent.linkPath, { recursive: true, force: true });
    log(`Removed: ${agent.label}`);
    return true;
  } catch (e) {
    warn(`Could not remove ${agent.linkPath}: ${e.message}`);
    return false;
  }
}

function isSymlink(p) {
  try { return statSync(p).isSymbolicLink(); } catch { return false; }
}

function installHooks(dryRun) {
  // Hooks are now managed by the plugin itself via plugin.json → hooks/claude-codex-hooks.json
  // Remove any legacy manually-added ponytail hooks from settings.json
  removeLegacyHooks(dryRun);
}

function removeLegacyHooks(dryRun) {
  const claudeSettings = join(homedir(), '.claude', 'settings.json');
  if (!existsSync(claudeSettings)) return;
  if (dryRun) return;
  try {
    const raw = readFileSync(claudeSettings, 'utf8');
    const s = JSON.parse(raw);
    let changed = false;
    for (const key of ['SessionStart', 'UserPromptSubmit']) {
      const hooks = s.hooks?.[key] || [];
      const filtered = hooks.filter(h => !JSON.stringify(h).includes('ponytail'));
      if (filtered.length !== hooks.length) {
        s.hooks[key] = filtered;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(claudeSettings, JSON.stringify(s, null, 2));
      log('Removed legacy ponytail hooks from settings.json');
    }
  } catch {}
}

function removeHooks() {
  hdr('Removing lifecycle hooks');
  const claudeSettings = join(homedir(), '.claude', 'settings.json');
  if (existsSync(claudeSettings)) {
    try {
      const raw = readFileSync(claudeSettings, 'utf8');
      const s = JSON.parse(raw);
      let changed = false;
      for (const key of ['SessionStart', 'UserPromptSubmit']) {
        const hooks = s.hooks?.[key] || [];
        const filtered = hooks.filter(h => !JSON.stringify(h).includes('ponytail'));
        if (filtered.length !== hooks.length) {
          s.hooks[key] = filtered;
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(claudeSettings, JSON.stringify(s, null, 2));
        log('Claude Code hooks removed');
      }
    } catch (e) {
      warn(`Failed to update Claude hooks: ${e.message}`);
    }
  }
}

// =============================================================================
//  MAIN CLI
// =============================================================================
function showHelp() {
  const help = `
${C.bold}ponytail — System-wide installer${C.reset}

${C.bold}Usage:${C.reset}
  node install.js [options]

${C.bold}Options:${C.reset}
  --all                 Install for all detected agents (default)
  --agent <name>        Install for a specific agent (repeatable)
  --repo <path>         Path to ponytail repo (default: parent of this script)
  --uninstall           Remove all ponytail symlinks and configs
  --list                Show installation status for each agent
  --dry-run             Show what would be done without doing it
  --yes, -y             Non-interactive (skip prompts)
  --help                Show this help

${C.bold}Supported agents:${C.reset}
${AGENTS.map(a => `  ${a.name.padEnd(15)} ${a.label}`).join('\n')}
`;
  console.log(help);
  process.exit(0);
}

function listStatus(repoRoot) {
  hdr('Ponytail installation status');
  console.log(`  Config dir: ${CONFIG_DIR}`);
  console.log(`  Repo:        ${repoRoot}\n`);

  for (const agent of AGENTS) {
    const detected = detectAgent(agent) ? `${C.green}yes${C.reset}` : `${C.dim}no${C.reset}`;
    let installed;
    if (!agent.linkPath) {
      installed = `${C.gray}N/A${C.reset}`;
    } else if (isSymlink(agent.linkPath)) {
      installed = `${C.green}symlink${C.reset}`;
    } else if (existsSync(agent.linkPath)) {
      installed = `${C.yellow}file${C.reset}`;
    } else {
      installed = `${C.dim}no${C.reset}`;
    }
    console.log(`  ${agent.label.padEnd(22)} detected: ${detected} (${agent.detectLabel})  installed: ${installed}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  let doAll = false;
  let doUninstall = false;
  let doList = false;
  let dryRun = false;
  let interactive = true;
  let repoPath = REPO_ROOT;
  const targetAgents = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all': case '-a': doAll = true; break;
      case '--agent': targetAgents.push(args[++i]); break;
      case '--repo': repoPath = args[++i]; break;
      case '--uninstall': doUninstall = true; break;
      case '--list': case '--status': doList = true; break;
      case '--dry-run': dryRun = true; break;
      case '--yes': case '-y': interactive = false; break;
      case '--help': case '-h': showHelp(); break;
      default: err(`Unknown option: ${args[i]}`); showHelp();
    }
  }

  // Resolve repo
  repoPath = resolve(repoPath);

  // --list
  if (doList) {
    listStatus(repoPath);
    process.exit(0);
  }

  // --uninstall
  if (doUninstall) {
    hdr('Uninstalling ponytail');
    for (const agent of AGENTS) {
      removeSymlink(agent);
    }
    removeHooks();
    log(`Config dir: ${CONFIG_DIR}`);
    warn(`Run "rm -rf ${CONFIG_DIR}" to remove all ponytail files.`);
    log('Uninstall complete');
    process.exit(0);
  }

  // Ensure source files
  repoPath = ensureRepo(repoPath);

  // Sync files
  if (!dryRun) {
    syncFiles(repoPath);
  } else {
    info('[dry-run] Would sync files to ' + CONFIG_DIR);
  }

  // Determine agents
  let agentsToInstall;
  if (targetAgents.length > 0) {
    agentsToInstall = AGENTS.filter(a => targetAgents.includes(a.name));
    const unknown = targetAgents.filter(t => !AGENTS.find(a => a.name === t));
    if (unknown.length > 0) {
      warn(`Unknown agents: ${unknown.join(', ')}`);
    }
  } else {
    agentsToInstall = AGENTS;
  }

  // Install for each agent
  hdr('Installing agent integrations');
  for (const agent of agentsToInstall) {
    const detected = detectAgent(agent);
    if (!detected && interactive) {
      warn(`${agent.label}: not detected. Use --yes to skip detection.`);
      continue;
    }
    symlinkAgent(agent, dryRun);
  }

  // Install hooks
  installHooks(dryRun);

  // Summary
  console.log('\n─── Done ───');
  console.log(`  Config: ${CONFIG_DIR}`);
  console.log(`  Restart your agents to apply ponytail.\n`);
  console.log(`  ${C.bold}Commands:${C.reset}`);
  console.log('  /ponytail [lite|full|ultra|off]  — Set mode');
  console.log('  /ponytail-review                  — Review diff for over-engineering');
  console.log('  /ponytail-gain                    — Show token savings\n');
  console.log(`  See status:  node install.js --list`);
  console.log(`  Uninstall:   node install.js --uninstall`);
}

main();
