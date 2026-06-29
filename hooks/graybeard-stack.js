const fs = require('fs');
const path = require('path');

const MANIFESTS = {
  'package.json': detectPackage,
  'Gemfile': () => ['Ruby', 'Rails/Rack'],
  'pyproject.toml': detectPyproject,
  'requirements.txt': () => ['Python'],
  'Cargo.toml': () => ['Rust'],
  'go.mod': () => ['Go'],
  'Package.swift': () => ['SwiftPM', 'Swift'],
  'pom.xml': () => ['Java', 'Maven'],
  'build.gradle': () => ['Java/Kotlin', 'Gradle'],
  'composer.json': () => ['PHP'],
};

function findUp(start = process.cwd(), maxDepth = 4) {
  let dir = path.resolve(start);
  const found = [];
  for (let i = 0; i <= maxDepth; i += 1) {
    for (const name of Object.keys(MANIFESTS)) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) found.push(file);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

function detectPackage(file) {
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
    const out = ['JavaScript/TypeScript'];
    if (deps.next) out.push('Next.js');
    if (deps.react) out.push('React');
    if (deps.vue) out.push('Vue');
    if (deps.svelte) out.push('Svelte');
    if (deps.express) out.push('Express');
    if (deps.vitest) out.push('Vitest');
    if (deps.jest) out.push('Jest');
    if (deps.playwright) out.push('Playwright');
    return out;
  } catch (e) {
    return ['JavaScript/TypeScript'];
  }
}

function detectPyproject(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = ['Python'];
  if (/django/i.test(text)) out.push('Django');
  if (/fastapi/i.test(text)) out.push('FastAPI');
  if (/pytest/i.test(text)) out.push('pytest');
  return out;
}

function detectStack(start) {
  const labels = new Set();
  for (const file of findUp(start)) {
    const detector = MANIFESTS[path.basename(file)];
    for (const label of detector(file)) labels.add(label);
  }
  return [...labels];
}

function getStackContext(start) {
  const stack = detectStack(start);
  if (!stack.length) {
    return 'Detected stack: unknown. Inspect repo manifests and existing patterns before advising.';
  }
  return 'Detected stack: ' + stack.slice(0, 8).join(', ') + '. Use this as a hint, then verify against repo code.';
}

module.exports = { detectStack, getStackContext };
