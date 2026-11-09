#!/usr/bin/env node
// Pure band board helpers (CSV + script-JSON escape). These used to live only in
// tests/band.test.tsx, which needs Claude Code's test runner and never ran in CI.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseCsv, tasksFrom, escapeJsonForScript } = require('../hooks/band/csv');

const CSV = 'key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,reuse_pct,reused,new,callers_open,tests,level\n' +
  'a-1,2026-10-15 12:00,shop,"Fix ""cart"", totals\nand tax",3.10,6,26.0,1200000,85000,83,5,1,0,14 passed,full\n' +
  'b-2,2026-10-14 09:30,shop,<script>alert(1)</script>,0.50,2,1.5,40000,900,,0,0,0,not run,lite\n';

test('parseCsv reads quoted fields with commas, quotes and line breaks', () => {
  const rows = parseCsv(CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][3], 'Fix "cart", totals\nand tax');
});

test('tasksFrom maps columns and keeps a null reuse when the field is empty', () => {
  const tasks = tasksFrom(CSV);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].name, 'Fix "cart", totals\nand tax');
  assert.equal(tasks[0].cost, 3.1);
  assert.equal(tasks[0].reuse, 83);
  assert.equal(tasks[1].name, '<script>alert(1)</script>');
  assert.equal(tasks[1].reuse, null);
});

test('escapeJsonForScript blocks script breakout via angle brackets', () => {
  const payload = escapeJsonForScript({
    now: 1,
    tasks: [{ name: '<script>alert(1)</script>' }],
  });
  assert.equal(payload.includes('<'), false);
  assert.ok(payload.includes('\\u003cscript>alert(1)\\u003c/script>'));
  assert.deepEqual(JSON.parse(payload), {
    now: 1,
    tasks: [{ name: '<script>alert(1)</script>' }],
  });
});

test('board.html builder wires the shared escape helper into board-data', () => {
  const board = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'band', 'board.ts'), 'utf8');
  assert.match(board, /from '\.\/csv\.js'/);
  assert.match(board, /const json = escapeJsonForScript/);
  assert.match(board, /id="board-data">\$\{json\(\{ now, tasks \}\)\}/);
});
