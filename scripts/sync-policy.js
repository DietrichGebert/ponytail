#!/usr/bin/env node
// Materialize the configured external policy into instruction-only adapters.
// Runtime hook/plugin consumers read the policy on every turn; static adapters
// need this explicit sync after a policy change.

const fs = require('fs');
const path = require('path');
const {
  getDefaultMode,
  getPolicyFile,
  normalizeMode,
} = require('../hooks/ponytail-config');

const START = '<!-- ponytail:external-policy:start -->';
const END = '<!-- ponytail:external-policy:end -->';

// Hosts with native skill/hook registration are intentionally absent: their
// runtime adapters already consume POLICY.md. These are instruction-only or
// generated/copy surfaces.
const STATIC_ADAPTERS = [
  ['AGENTS.md', 'AGENTS.md'],
  ['.cursor/rules/ponytail.mdc', '.cursor/rules/ponytail.mdc'],
  ['.windsurf/rules/ponytail.md', '.windsurf/rules/ponytail.md'],
  ['.clinerules/ponytail.md', '.clinerules/ponytail.md'],
  ['.github/copilot-instructions.md', '.github/copilot-instructions.md'],
  ['.kiro/steering/ponytail.md', '.kiro/steering/ponytail.md'],
  ['.junie/guidelines.md', 'AGENTS.md'],
  ['.agents/rules/ponytail.md', '.agents/rules/ponytail.md'],
  ['.qoder/rules/ponytail.md', '.qoder/rules/ponytail.md'],
];

function readPolicy() {
  const file = getPolicyFile();
  if (!file) return null;
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text || null;
  } catch (_) {
    return null;
  }
}

function removeManagedPolicy(text) {
  const escapedStart = START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\n?${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, 'g'), '').replace(/\n{3,}/g, '\n\n');
}

function addManagedPolicy(text, policy) {
  const base = removeManagedPolicy(String(text || '').replace(/\r\n/g, '\n')).trimEnd();
  if (!policy) return base + (base ? '\n' : '');
  const safePolicy = String(policy)
    .split(START).join(`${START}&#45;&#45;>`)
    .split(END).join(`${END.slice(0, -3)}&#45;&#45;>`);
  return `${base}\n\n${START}\n## External policy\n\n${safePolicy}\n${END}\n`;
}

function sourceFor(root, source) {
  const file = path.join(__dirname, '..', source);
  return fs.readFileSync(file, 'utf8');
}

function hasSymlinkComponent(root, destination) {
  let current = root;
  try {
    if (fs.lstatSync(current).isSymbolicLink()) return true;
  } catch (_) {
    return true;
  }
  const relative = path.relative(root, path.dirname(destination));
  for (const component of relative ? relative.split(path.sep) : []) {
    current = path.join(current, component);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) return true;
    } catch (error) {
      if (error.code !== 'ENOENT') return true;
      break;
    }
  }
  try { return fs.lstatSync(destination).isSymbolicLink(); } catch (error) { return error.code !== 'ENOENT'; }
}

function isPathLike(value) {
  return path.isAbsolute(value) || value.startsWith('~/') || value.startsWith('./') || value.startsWith('../') || value.endsWith('.md');
}

function normalizeExplicitPolicy(policy) {
  if (typeof policy !== 'string') return policy;
  if (fs.existsSync(policy)) {
    try { return fs.readFileSync(policy, 'utf8').trim(); } catch (_) { return null; }
  }
  return isPathLike(policy) ? null : policy;
}

function syncPolicy({ project = process.cwd(), policy = readPolicy(), mode = getDefaultMode() } = {}) {
  const root = path.resolve(project);
  const configuredPolicy = normalizeExplicitPolicy(policy);
  const policyText = typeof configuredPolicy === 'string' ? configuredPolicy.trim() : null;
  const effectiveMode = normalizeMode(mode) || 'full';
  const results = [];
  // Missing policy is a no-op. This keeps the feature opt-in and avoids
  // materializing adapter files merely because a user ran the command.
  if (!policyText && effectiveMode !== 'off') return { policy: false, mode: effectiveMode, files: results };
  for (const [target, source] of STATIC_ADAPTERS) {
    const destination = path.join(root, target);
    const exists = fs.existsSync(destination);
    if (!exists && effectiveMode === 'off') continue;
    if (hasSymlinkComponent(root, destination)) continue;
    let original;
    try { original = fs.readFileSync(destination, 'utf8'); } catch (_) { original = sourceFor(root, source); }
    const rendered = addManagedPolicy(original, effectiveMode === 'off' ? null : policyText);
    if (rendered !== original.replace(/\r\n/g, '\n')) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (hasSymlinkComponent(root, destination)) continue;
      fs.writeFileSync(destination, rendered, 'utf8');
      results.push(target);
    }
  }

  // OpenClaw's existing generator produces one SKILL.md per skill. Keep those
  // generated files usable by appending the same managed block, without
  // altering canonical skills/ or pretending OpenClaw has a host hook API.
  const openclaw = path.join(root, '.openclaw', 'skills');
  if (fs.existsSync(openclaw)) {
    for (const entry of fs.readdirSync(openclaw, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const destination = path.join(openclaw, entry.name, 'SKILL.md');
      if (!fs.existsSync(destination)) continue;
      if (hasSymlinkComponent(root, destination)) continue;
      const original = fs.readFileSync(destination, 'utf8');
      const rendered = addManagedPolicy(original, effectiveMode === 'off' ? null : policyText);
      if (rendered !== original.replace(/\r\n/g, '\n')) {
        if (hasSymlinkComponent(root, destination)) continue;
        fs.writeFileSync(destination, rendered, 'utf8');
        results.push(path.relative(root, destination).replace(/\\/g, '/'));
      }
    }
  }
  return { policy: Boolean(policy), mode: effectiveMode, files: results };
}

module.exports = { END, START, STATIC_ADAPTERS, addManagedPolicy, removeManagedPolicy, readPolicy, syncPolicy };

if (require.main === module) {
  const args = process.argv.slice(2);
  const projectIndex = args.indexOf('--project');
  const project = projectIndex >= 0 ? args[projectIndex + 1] : process.cwd();
  if (projectIndex >= 0 && (!project || project.startsWith('--'))) {
    console.error('Usage: npm run sync-policy -- [--project PATH]');
    process.exit(2);
  }
  const result = syncPolicy({ project });
  if (!result.policy && result.mode !== 'off') {
    console.error('No readable policy configured; nothing changed. Set PONYTAIL_POLICY_FILE or config.policyFile.');
    process.exit(1);
  }
  console.log(`${result.mode === 'off' ? 'Removed' : 'Synced'} external policy in ${result.files.length} static adapter file(s).`);
}
