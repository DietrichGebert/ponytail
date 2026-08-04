#!/usr/bin/env node
// ponytail — Claude Code SubagentStart hook
//
// SessionStart context is parent-thread only and never reaches subagents, so
// without this every Task-spawned agent runs ponytail-unaware (issue #252).
// When ponytail mode is active, inject the same ruleset into each subagent.
//
// Scoping (opt-in, issue #506): set PONYTAIL_SUBAGENT_MATCHER to a regex and
// the ruleset is injected only into subagents whose agent_type matches. The
// regex is unanchored and case-insensitive — "explore|general" matches either,
// "^general$" is exact. Unset means inject into every subagent, as before.

const { getPonytailInstructions } = require('./ponytail-instructions');
const { readMode, writeHookOutput } = require('./ponytail-runtime');

const mode = readMode();

// Absent flag or off → ponytail isn't active; inject nothing.
if (!mode || mode === 'off') {
  process.exit(0);
}

function inject() {
  try {
    writeHookOutput('SubagentStart', mode, getPonytailInstructions(mode));
  } catch (e) {
    // Silent fail — a stdout error at hook exit must not surface as a hook failure.
  }
}

// A bad regex must never crash the hook; treat it as "no matcher" and inject
// (issue #658). The pattern is operator-controlled, so the guardrail is a
// length cap and a nested-quantifier sniff, not a sandbox; both are tuned to
// refuse obvious footguns without blocking legitimate filters.
const MAX_MATCHER_LEN = 256;
// ReDoS guard: flag unbounded repeated groups with nested quantifiers or
// overlapping alternatives (`(a+)+`, `(a|aa)+`, `(foo(bar+))+$`). Bounded
// repeats are finite work, and a fixed prefix makes direct nesting such as
// `(foo+)+` deterministic. Heuristic, not a proof.
// ponytail: RE2 would fix the whole class, overkill for an opt-in operator
// filter; a false positive just means inject-everywhere plus a warning. A
// same-thread RegExp.test cannot be interrupted by this hook, so a timeout
// needs a child process or a constrained regex engine; reject known shapes
// before test() instead.
// ponytail: branch comparison is O(n^2), bounded by the 256-character cap;
// use RE2 or a full regex parser if matcher scope grows.
function isReDoSSuspect(pattern) {
  let cursor = 0;

  function readQuantifier() {
    const ch = pattern[cursor];
    if (ch === '*') {
      cursor++;
      return { min: 0, max: Infinity, unbounded: true };
    }
    if (ch === '+') {
      cursor++;
      return { min: 1, max: Infinity, unbounded: true };
    }
    if (ch === '?') {
      cursor++;
      return { min: 0, max: 1, unbounded: false };
    }
    if (ch !== '{') return null;

    const match = pattern.slice(cursor).match(/^\{(\d+)(,(\d*)?)?\}/);
    if (!match) return null;
    cursor += match[0].length;
    const min = Number(match[1]);
    const max = match[2] === undefined
      ? min
      : match[3] === undefined || match[3] === ''
        ? Infinity
        : Number(match[3]);
    return { min, max, unbounded: max === Infinity };
  }

  function readGroupPrefix() {
    if (pattern[cursor] !== '?') return false;
    cursor++;
    if (pattern[cursor] === '=' || pattern[cursor] === '!') {
      cursor++;
      return true;
    }
    if (pattern[cursor] === '<' && (pattern[cursor + 1] === '=' || pattern[cursor + 1] === '!')) {
      cursor += 2;
      return true;
    }
    if (pattern[cursor] === '<') {
      const end = pattern.indexOf('>', cursor + 1);
      cursor = end === -1 ? pattern.length : end + 1;
      return false;
    }
    if (pattern[cursor] === ':') {
      cursor++;
      return false;
    }
    // Invalid inline syntax will be rejected by RegExp below. Consume its
    // prefix here so it cannot be mistaken for a quantifier.
    while (cursor < pattern.length && pattern[cursor] !== ':' && pattern[cursor] !== ')') cursor++;
    if (pattern[cursor] === ':') cursor++;
    return false;
  }

  function parseSequence(stop) {
    const alternatives = [[]];
    while (cursor < pattern.length) {
      const ch = pattern[cursor];
      if (ch === stop) {
        cursor++;
        return alternatives;
      }
      if (ch === '|') {
        alternatives.push([]);
        cursor++;
        continue;
      }
      if (ch === '\\') {
        alternatives[alternatives.length - 1].push({ kind: 'literal', text: pattern.slice(cursor, cursor + 2) });
        cursor += 2;
        continue;
      }
      if (ch === '[') {
        cursor++;
        while (cursor < pattern.length) {
          if (pattern[cursor] === '\\') cursor += 2;
          else if (pattern[cursor++] === ']') break;
        }
        alternatives[alternatives.length - 1].push({ kind: 'unknown' });
        continue;
      }
      if (ch === '(') {
        cursor++;
        const group = {
          kind: 'group',
          assertion: readGroupPrefix(),
          alternatives: parseSequence(')'),
          quant: null,
        };
        alternatives[alternatives.length - 1].push(group);
        continue;
      }
      const branch = alternatives[alternatives.length - 1];
      if (ch === '*' || ch === '+' || ch === '?' || ch === '{') {
        const quant = readQuantifier();
        if (quant && branch.length) {
          branch[branch.length - 1].quant = quant;
          if (pattern[cursor] === '?') cursor++;
          continue;
        }
      }
      branch.push({ kind: ch === '^' || ch === '$' ? 'assertion' : 'literal', text: ch });
      cursor++;
    }
    return alternatives;
  }

  const root = { kind: 'root', alternatives: parseSequence(null), quant: null };

  function branchInfo(branch) {
    let prefix = '';
    let nullable = true;
    for (const node of branch) {
      if (node.kind === 'assertion') continue;
      if (node.kind !== 'literal') break;
      if (node.quant && node.quant.min === 0) break;
      prefix += node.text;
      nullable = false;
      if (node.quant && node.quant.unbounded) break;
    }
    return { prefix, nullable };
  }

  function alternativesOverlap(alternatives) {
    const infos = alternatives.map(branchInfo);
    for (let i = 0; i < infos.length; i++) {
      for (let j = i + 1; j < infos.length; j++) {
        const left = infos[i];
        const right = infos[j];
        if (left.nullable || right.nullable || !left.prefix || !right.prefix) return true;
        if (left.prefix.startsWith(right.prefix) || right.prefix.startsWith(left.prefix)) return true;
      }
    }
    return false;
  }

  function hasFixedPrefix(branch, target) {
    let hasPrefix = false;
    for (const node of branch) {
      if (node === target) return hasPrefix;
      if (node.kind !== 'literal' || node.quant) return false;
      hasPrefix = true;
    }
    return false;
  }

  function hasRisk(group, repeatedAncestor, nestedGroup) {
    const repeated = repeatedAncestor || Boolean(group.quant && group.quant.unbounded);
    if (repeated && group.alternatives.length > 1 && alternativesOverlap(group.alternatives)) return true;

    for (const branch of group.alternatives) {
      for (const node of branch) {
        if (node.kind === 'group') {
          if (repeatedAncestor && node.quant && node.quant.unbounded) return true;
          if (hasRisk(node, repeated, nestedGroup || repeated)) return true;
          continue;
        }
        if (!repeated || !node.quant || !node.quant.unbounded) continue;
        if (nestedGroup || !hasFixedPrefix(branch, node)) return true;
      }
    }
    return false;
  }

  return hasRisk(root, false, false);
}
function warn(msg) {
  // Stderr only, stdout is the hook payload and must stay valid JSON.
  try { process.stderr.write('ponytail-subagent: ' + msg + '\n'); } catch (e) {}
}
let matcherRe = null;
try {
  const pattern = process.env.PONYTAIL_SUBAGENT_MATCHER;
  if (pattern) {
    if (pattern.length > MAX_MATCHER_LEN) {
      warn('PONYTAIL_SUBAGENT_MATCHER exceeds ' + MAX_MATCHER_LEN + ' chars; ignoring');
    } else if (isReDoSSuspect(pattern)) {
      warn('PONYTAIL_SUBAGENT_MATCHER has nested quantifiers (ReDoS risk); ignoring');
    } else {
      matcherRe = new RegExp(pattern, 'i');
    }
  }
} catch (e) {
  warn('PONYTAIL_SUBAGENT_MATCHER is invalid (' + (e && e.message) + '); ignoring');
  matcherRe = null;
}

// No matcher → keep the original synchronous, stdin-independent path. On Windows
// the PowerShell `if {}` wrapper can swallow the piped JSON so stdin 'end' never
// fires (#443); the default path must not wait on stdin or it would stall every
// subagent spawn.
if (!matcherRe) {
  inject();
  process.exit(0);
}

// Matcher set → read agent_type from stdin and skip only on a definite
// mismatch. Missing/unparseable agent_type, a stdin error, or the timeout all
// fail open (inject), so scoping never silently drops the persona.
let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;

  let agentType = '';
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    agentType = String(JSON.parse(input.replace(/^\uFEFF/, '')).agent_type || '').trim();
  } catch (e) {
    // Unparseable payload — fall through and inject to be safe.
  }
  if (agentType && !matcherRe.test(agentType)) {
    process.exit(0);
  }
  inject();
}

process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', finish);
// Never block the session (#443): recover on stdin error or a short fallback.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
