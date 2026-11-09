// Pure CSV + script-JSON helpers for the band board.
// Kept as plain JS so Node CI can test them without Claude Code's TS loader.

/** @typedef {{
 *   started: string,
 *   project: string,
 *   name: string,
 *   cost: number,
 *   turns: number,
 *   agentMinutes: number,
 *   tokens: number,
 *   reuse: number | null,
 *   tests: string,
 *   level: string,
 *   model: string,
 * }} Task */

// RFC 4180 rows: quoted fields may hold commas, doubled quotes and line breaks.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

/** @param {string} text @returns {Task[]} */
function tasksFrom(text) {
  const [head, ...rows] = parseCsv(text);
  if (!head || !head.includes('key')) return [];
  const at = (row, col) => row[head.indexOf(col)] ?? '';
  const num = (row, col) => Number(at(row, col)) || 0;
  return rows.map(row => ({
    started: at(row, 'started'),
    project: at(row, 'project'),
    name: at(row, 'name'),
    cost: num(row, 'cost_usd'),
    turns: num(row, 'turns'),
    agentMinutes: num(row, 'agent_minutes'),
    tokens: num(row, 'tokens_total'),
    reuse: at(row, 'reuse_pct') === '' ? null : num(row, 'reuse_pct'),
    tests: at(row, 'tests'),
    level: at(row, 'level'),
    model: at(row, 'model'),
  }));
}

// JSON inside a <script> block: "<" is escaped so no name can close the block.
function escapeJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

module.exports = { parseCsv, tasksFrom, escapeJsonForScript };
