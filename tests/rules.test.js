#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getFallbackInstructions } = require('../hooks/ponytail-instructions');

const root = path.join(__dirname, '..');
const SECURITY_EXCEPTION = /Security-sensitive\s+paths are exempt from that one-check ceiling[\s\S]*trust boundary and abuse case/;

test('security paths are not limited to one runnable check', () => {
  // 安全规则回归：安全路径必须覆盖受影响边界，而不是只留下一个检查。
  const skill = fs.readFileSync(path.join(root, 'skills', 'ponytail', 'SKILL.md'), 'utf8');
  const fallback = getFallbackInstructions('full');

  for (const instructions of [skill, fallback]) {
    assert.match(instructions, /ordinary non-trivial logic[\s\S]*ONE runnable check/i);
    assert.match(instructions, SECURITY_EXCEPTION);
  }
});
