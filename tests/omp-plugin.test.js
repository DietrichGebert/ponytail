#!/usr/bin/env node
// OMP (oh-my-pi) loads Ponytail as an installed plugin: the extension module
// comes from package.json#omp.extensions (legacy pi.extensions also accepted),
// and skills/ is discovered by convention next to the package. The marketplace
// catalog is the Claude-compatible .claude-plugin/marketplace.json, which omp
// reads as a fallback.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('OMP manifest declares the shared pi extension module', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.omp.extensions, ['./pi-extension/index.js']);
  assert.ok(fs.existsSync(path.join(root, 'pi-extension', 'index.js')));
});

test('OMP marketplace catalog resolves the repo root as plugin source', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(catalog.name, 'ponytail');
  const entry = catalog.plugins.find((p) => p.name === 'ponytail');
  assert.ok(entry, 'ponytail entry present');
  assert.equal(entry.source, './');
});

test('Bundled skills carry the description omp skill discovery requires', () => {
  const skillsDir = path.join(root, 'skills');
  const names = fs.readdirSync(skillsDir).filter((n) =>
    fs.existsSync(path.join(skillsDir, n, 'SKILL.md')),
  );
  assert.ok(names.length >= 6, 'all six ponytail skills present');
  for (const name of names) {
    const skill = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
    // omp's omp-plugins provider passes requireDescription: true.
    assert.match(
      skill,
      /^description: >\n(?:[ \t]+\S[^\n]*\n)+/m,
      `${name} must declare a non-empty description for omp discovery`,
    );
  }
});
