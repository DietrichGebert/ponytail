#!/usr/bin/env node
// ponytail — install or remove GigaCode skills.
//
// Personal skills are installed to ~/.gigacode/skills (default) or
// <cwd>/.gigacode/skills (--project).
//
//   node scripts/gigacode-skills.js install [--project]
//   node scripts/gigacode-skills.js uninstall [--project]

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');

function skillsPath(scope) {
  return scope === 'project'
    ? path.join(process.cwd(), '.gigacode', 'skills')
    : path.join(os.homedir(), '.gigacode', 'skills');
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function removePonytailSkills(source, destination) {
  if (!fs.existsSync(destination)) return;

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      removePonytailSkills(
        path.join(source, entry.name),
        destinationPath
      );

      if (fs.existsSync(destinationPath) &&
          fs.readdirSync(destinationPath).length === 0) {
        fs.rmdirSync(destinationPath);
      }
    } else if (entry.isFile()) {
      fs.rmSync(destinationPath, { force: true });
    }
  }
}

function install(scope) {
  const destination = skillsPath(scope);

  copyDirectory(SKILLS_DIR, destination);

  return destination;
}

function uninstall(scope) {
  const destination = skillsPath(scope);

  if (!fs.existsSync(destination)) {
    return null;
  }

  removePonytailSkills(SKILLS_DIR, destination);

  return destination;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const action = args[0];
  const scope = args.includes('--project') ? 'project' : 'user';

  try {
    if (action === 'install') {
      const directory = install(scope);

      console.log('Installed ponytail skills for GigaCode in ' + directory);
    } else if (action === 'uninstall') {
      const directory = uninstall(scope);

      console.log(directory
        ? 'Removed ponytail skills from GigaCode at ' + directory
        : 'No ponytail skills in ' + skillsPath(scope));
    } else {
      console.error(
        'usage: node scripts/gigacode-skills.js install|uninstall [--project]'
      );
      process.exit(1);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = {
  skillsPath,
  install,
  uninstall,
};