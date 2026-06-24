#!/usr/bin/env node
// Publish the generated OpenClaw skills (.openclaw/skills/) to ClawHub.
//
// ClawHub does not sync from GitHub: each skill is pushed explicitly with the
// clawhub CLI and carries its own version. This publishes every generated skill
// in one pass, versioned from the repo's package.json so ClawHub tracks the repo
// instead of drifting (the same drift that hit the plugin manifests in #260).
//
// Prereqs:
//   - `clawhub login` once (registry auth persists)
//   - skills must be current: run `node scripts/build-openclaw-skills.js` first
//     if you changed a skill (CI fails if the committed copies are stale)
//
// Usage:
//   node scripts/publish-openclaw-skills.js            # publish all as latest
//   node scripts/publish-openclaw-skills.js --dry-run  # preview, upload nothing
//   (any extra args are passed through to `clawhub skill publish`)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const skillsDir = path.join(root, '.openclaw', 'skills');

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

// Every generated skill dir with a SKILL.md is publishable. Reading the dir
// (instead of a hardcoded list) covers whatever build-openclaw-skills emits,
// with nothing to keep in sync.
const slugs = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
  .map((e) => e.name)
  .sort();

if (slugs.length === 0) {
  console.error(`No skills under ${path.relative(root, skillsDir)}; run build-openclaw-skills.js first.`);
  process.exit(1);
}

// "ponytail-review" -> "Ponytail Review"
const displayName = (slug) =>
  slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Minimal quoting that satisfies both POSIX sh and cmd.exe: only display names
// (which contain a space) need wrapping; slugs, versions, paths, and flags don't.
const quote = (a) => (/[^\w./-]/.test(a) ? `"${a}"` : a);

const passthrough = process.argv.slice(2);
const extra = passthrough.length ? ` (${passthrough.join(' ')})` : '';
console.log(`Publishing ${slugs.length} skills to ClawHub at version ${version}${extra}:`);

for (const slug of slugs) {
  const args = [
    'clawhub', 'skill', 'publish', `.openclaw/skills/${slug}`,
    '--slug', slug,
    '--name', displayName(slug),
    '--version', version,
    '--tags', 'latest',
    ...passthrough,
  ];
  const cmdline = args.map(quote).join(' ');
  console.log(`\n$ ${cmdline}`);
  const res = spawnSync(cmdline, { stdio: 'inherit', cwd: root, shell: true });
  if (res.status !== 0) {
    console.error(
      `\nPublish failed for "${slug}" (exit ${res.status}). ` +
      `Check that the clawhub CLI is installed and you have run \`clawhub login\`, then re-run. ` +
      `Skills already published in this run are unaffected.`,
    );
    process.exit(res.status || 1);
  }
}

console.log(`\nDone. Published ${slugs.length} skills at ${version}.`);
