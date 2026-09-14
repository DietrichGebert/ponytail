const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

test('publishes a literal shell-substitution skill slug without executing it', () => {
  const markerName = `ponytail-openclaw-shell-injection-${process.pid}`;
  const markerPath = path.join(root, markerName);
  const maliciousSlug = `test-shell-$(touch ${markerName})`;
  const skillPath = path.join(root, '.openclaw', 'skills', maliciousSlug);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-clawhub-'));
  const binDir = path.join(tempDir, 'bin');
  const capturePath = path.join(tempDir, 'clawhub-argv.jsonl');
  const markerExisted = fs.existsSync(markerPath);

  fs.mkdirSync(binDir);
  fs.mkdirSync(skillPath);
  fs.writeFileSync(path.join(skillPath, 'SKILL.md'), '---\nname: test-shell\n---\n');
  fs.writeFileSync(
    path.join(binDir, 'clawhub'),
    `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.CLAWHUB_CAPTURE, JSON.stringify(process.argv.slice(2)) + '\\n');
`,
    { mode: 0o755 },
  );

  try {
    assert.equal(markerExisted, false, 'test marker must not already exist');

    for (const passthrough of [[], ['--dry-run']]) {
      const result = spawnSync(
        process.execPath,
        [path.join(root, 'scripts', 'publish-openclaw-skills.js'), ...passthrough],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
            CLAWHUB_CAPTURE: capturePath,
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
    }
    assert.equal(fs.existsSync(markerPath), false, 'shell substitution must not execute');

    const calls = fs.readFileSync(capturePath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.ok(
      calls.some((args) => args.includes(maliciousSlug) && !args.includes('--dry-run')),
      'clawhub must receive the literal slug during a normal publish',
    );
    assert.ok(
      calls.some((args) => args.includes(maliciousSlug) && args.includes('--dry-run')),
      'clawhub must receive the literal slug and dry-run argument',
    );
  } finally {
    fs.rmSync(skillPath, { recursive: true, force: true });
    if (!markerExisted) fs.rmSync(markerPath, { force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
