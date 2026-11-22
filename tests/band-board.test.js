#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const boardTs = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'band', 'board.ts'), 'utf8');

test('board helpers scan each session once and preserve daily totals', () => {
  const helpers = boardTs.match(/^  function (?:add|total)\([^\r\n]+|^  function inDays\([\s\S]+?(?=^  function avg\()/gm);
  assert.equal(helpers?.length, 3);
  const { inDays, perDay } = new Function(`${helpers.join('\n')}\nreturn { inDays, perDay };`)();

  let reads = 0;
  const keys = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const sessions = Array.from({ length: 500 }, (_, i) => {
    const date = keys[i % keys.length];
    // The first day's total depends on the original session order.
    const cost = date === keys[0] ? ([1e16, -1e16, 1][i / keys.length] ?? 0) : 1;
    return { cost, get started() { reads++; return `${date} 10:00`; } };
  });

  const cost = (session) => session.cost;
  assert.deepEqual(perDay(sessions, keys, cost).slice(0, 2), [1, 17]);
  assert.equal(reads, sessions.length, 'perDay must read each session date once');

  const query = [keys[1], '2026-11-01', keys[0], keys[1]];
  assert.deepEqual(perDay(sessions, query, cost), [17, 0, 1, 17]);
  reads = 0;
  assert.deepEqual(perDay(sessions, [], cost), []);
  assert.equal(reads, 0);
  assert.deepEqual(inDays(sessions, query), sessions.filter((_, i) => i % keys.length < 2));
  assert.equal(reads, sessions.length, 'inDays must read each session date once');
});
