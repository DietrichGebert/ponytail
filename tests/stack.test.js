#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { detectStack, getStackContext } = require('../hooks/graybeard-stack');

test('detectStack reads package.json framework hints', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graybeard-stack-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      dependencies: { next: '^15.0.0', react: '^19.0.0' },
      devDependencies: { vitest: '^3.0.0' },
    }));

    assert.deepEqual(detectStack(dir), ['JavaScript/TypeScript', 'Next.js', 'React', 'Vitest']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getStackContext has an unknown fallback', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graybeard-stack-empty-'));
  try {
    assert.match(getStackContext(dir), /unknown/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
