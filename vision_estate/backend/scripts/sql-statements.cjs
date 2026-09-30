// Split migration SQL while preserving quoted strings, identifiers and PL/pgSQL bodies.
module.exports = function statements(sql) {
  const result = []; let start = 0, quote = '', dollar = '', comment = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (dollar) { if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = ''; } continue; }
    if (quote) { if (c === quote) { if (sql[i+1] === quote) i++; else quote = ''; } continue; }
    if (c === '-' && sql[i+1] === '-') { comment = true; i++; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '$') { const m = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/); if (m) { dollar = m[0]; i += dollar.length - 1; continue; } }
    if (c === ';') { result.push(sql.slice(start, i + 1)); start = i + 1; }
  }
  if (sql.slice(start).trim()) result.push(sql.slice(start));
  return result.filter(s => s.replace(/--[^\n]*/g, '').trim());
};
