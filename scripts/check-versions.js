#!/usr/bin/env node
// Version-consistency guard: package.json must be pinned X.Y.Z semver, and on
// a release-tag CI run must equal the tag (#260, #262).

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const PINNED_SEMVER = /^\d+\.\d+\.\d+$/;

// Every file that declares the project version, and who reads it. Add new host
// manifests here so a future ecosystem can't drift unnoticed.
const VERSION_FILES = [
  'package.json',                // opencode plugin version
];

function readVersion(relPath) {
  try {
    // Strip a UTF-8 BOM some Windows editors prepend (breaks JSON.parse).
    const raw = fs.readFileSync(path.join(root, relPath), 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw).version;
  } catch (e) {
    throw new Error(`${relPath}: ${e.message}`);
  }
}

let failed = false;
const versions = VERSION_FILES.map((relPath) => {
  const version = readVersion(relPath);
  if (typeof version !== 'string' || !PINNED_SEMVER.test(version)) {
    console.error(`${relPath}: version must be a pinned X.Y.Z semver, got ${JSON.stringify(version)}`);
    failed = true;
  }
  return [relPath, version];
});

// Every file must declare the same version.
const distinct = [...new Set(versions.map(([, v]) => v))];
if (distinct.length > 1) {
  console.error('Version mismatch — every manifest must share one version:');
  for (const [relPath, version] of versions) console.error(`  ${version}\t${relPath}`);
  failed = true;
}
const shared = distinct.length === 1 ? distinct[0] : null;

// On a release-tag push CI sets GITHUB_REF_TYPE=tag and GITHUB_REF_NAME=vX.Y.Z.
// The shared version must equal the tag — this catches tagging a release whose
// version files were never bumped, which mutual agreement alone cannot.
if (shared && process.env.GITHUB_REF_TYPE === 'tag') {
  const tag = process.env.GITHUB_REF_NAME || '';
  const tagVersion = tag.replace(/^v/, '');
  if (PINNED_SEMVER.test(tagVersion) && tagVersion !== shared) {
    console.error(`release tag ${tag} does not match version ${shared}; bump the version files before tagging`);
    failed = true;
  }
}

if (failed) {
  console.error('Align the version fields (see issue #260) so every manifest shares one version.');
  process.exit(1);
}

console.log(`All ${VERSION_FILES.length} version files pinned at ${shared}.`);
