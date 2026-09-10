// Quick regex pre-filter for known over-engineering patterns before the LLM
// does deeper analysis. Returns actionable findings that map to ladder rungs.
//
//   detectOverEngineering(sourceCode)
//   -> [{ pattern, alternative, snippet, line }]
//
// This is a complement, not a replacement — regex catches import-level signals;
// the LLM catches architectural over-engineering that regex can't see.
//
// ponytail: import-level scan only; LLM still needed for design-level over-engineering.

// ponytail: regex handles both ESM import and CJS require patterns
const REQUIRE_RE = /(?:import\s+(?:.*\s+from\s+)?|require\s*\(\s*)['"]/;
const PATTERNS = [
  { re: /(?:import\s+(?:.*\s+from\s+)?|require\s*\(\s*)['"](moment|dayjs|date-fns|luxon)['"]/g, label: 'date-lib', alternative: 'Intl.DateTimeFormat / native Date' },
  { re: /(?:import\s+(?:.*\s+from\s+)?|require\s*\(\s*)['"](lodash|ramda|underscore)['"]/g, label: 'util-lib', alternative: 'native Array/Object methods' },
  { re: /(?:import\s+(?:.*\s+from\s+)?|require\s*\(\s*)['"](axios|node-fetch|got|superagent)['"]/g, label: 'http-lib', alternative: 'native fetch()' },
  { re: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(/g, label: 'deep-clone', alternative: 'structuredClone()' },
  { re: /new\s+Date\s*\(\s*\)\s*\.toISOString\s*\(\s*\)/g, label: 'timestamp', alternative: 'Date.now()' },
];

function detectOverEngineering(text) {
  const findings = [];
  const lines = String(text || '').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    for (const { re, label, alternative } of PATTERNS) {
      re.lastIndex = 0;
      const match = re.exec(trimmed);
      if (match) {
        findings.push({
          pattern: label,
          alternative,
          snippet: trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed,
          line: i + 1,
        });
      }
    }

    // Class with only trivial getters/setters (multi-line check)
    // ponytail: naive heuristic — only matches single-line getter/setter bodies
    if (/^\s*(?:export\s+)?(?:default\s+)?class\s+\w+/.test(line)) {
      let j = i + 1;
      const classBody = [];
      while (j < lines.length && !/^\s*\}?\s*$/.test(lines[j])) {
        classBody.push(lines[j]);
        j++;
      }
      const trivialRe = /^\s*(?:get|set)\s+\w+\s*\([^)]*\)\s*\{/;
      const ctorRe = /^\s*constructor\s*\([^)]*\)\s*\{/;
      const nonTrivial = classBody.filter(l => {
        const t = l.trim();
        return t && !t.startsWith('//') && !t.startsWith('*') && !/^\s*\}?$/.test(t) && !trivialRe.test(l) && !ctorRe.test(l);
      });
      if (classBody.length > 0 && nonTrivial.length === 0) {
        findings.push({
          pattern: 'trivial-class',
          alternative: 'direct property access or plain object',
          snippet: (line + (lines[i + 1] || '') + (lines[i + 2] || '')).trim(),
          line: i + 1,
        });
      }
    }

    // Function that just wraps a single expression (e.g., const f = (x) => g(x))
    if (/^\s*(const|let|var|function)\s+\w+\s*[=(]/.test(trimmed)) {
      const matchWrapper = trimmed.match(/=>\s*(\w[\w.]*)\s*\(\s*([^)]*)\s*\)\s*$/);
      if (matchWrapper) {
        const [_, callee, args] = matchWrapper;
        const argList = args.split(',').map(a => a.trim()).filter(Boolean);
        // ponytail: only flag wrappers where args pass through unchanged
        const paramMatch = trimmed.match(/^.*?(?:\(([^)]*)\)|(\w+))\s*=>/);
        if (paramMatch) {
          const params = (paramMatch[1] || paramMatch[2] || '').split(',').map(p => p.trim()).filter(Boolean);
          if (params.length === argList.length && params.every((p, idx) => p === argList[idx])) {
            findings.push({
              pattern: 'trivial-wrapper',
              alternative: `inline ${callee}(...) directly`,
              snippet: trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed,
              line: i + 1,
            });
          }
        }
      }
    }
  }

  return findings;
}

module.exports = { detectOverEngineering, PATTERNS };
