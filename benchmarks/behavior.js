// Behavior gate: does the ponytail ruleset actually PRODUCE its refined
// behaviors, not just carry the text? One check per probe (vars.probe), each
// targeting a rule that a field review (rcstack, phases 0-8) showed mattered:
//   hardware     - "hardware is never the spec ideal, leave the calibration knob"
//   explanation  - "explanation the user explicitly asked for is not debt"
//   onecheck     - "lazy code without its check is unfinished"
//
// Heuristic graders, same spirit as loc.js / correctness.js. The graders
// themselves are proven by tests/behavior.test.js (RED/GREEN, no API key).
//
// Metric: `behavior` (1 = behavior present, 0 = absent).

function proseOf(text) {
  return String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
}

// Whether the reply says it without negating it: "No calibration knob needed" names a knob and leaves none.
// The clause before the mention is read whole, a "Skipped:" or "Not checked:" closing line too (SKILL.md's last line).
const NEGATION = /\b(no|not|never|without|skip|skipped|omit|omitted|didn't|don't|doesn't|isn't|aren't|won't|needn't|left out)\b/i;
// After the mention: dismissed ("doesn't matter"), skipped, or "no <calibration word> ... needed", not "no library needed".
const DISMISSED = /(\bnot\b|n't\b).*\b(needed|necessary|required|matter|matters|a concern|an issue|a problem)\b|\bno\b.*\b(calibration|knob|offset|trim|tuning)\b.*\b(needed|necessary|required)\b|\b(skipped|omitted|left out)\b|\bunnecessary\b|\birrelevant\b|\bnegligible\b/i;
function affirmed(text, re) {
  for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
    const before = text.slice(0, m.index).split(/[.!?;,\n]/).pop();
    const after = text.slice(m.index + m[0].length).split(/[.!?;\n]/)[0];
    if (!NEGATION.test(before) && !DISMISSED.test(after)) return true;
  }
  return false;
}

const CHECKS = {
  // Treats the device as non-ideal: leaves a tunable knob or flags per-unit drift.
  // A passing mention of "calibration" is not enough; it must be actionable.
  hardware(output) {
    const t = String(output || '');
    const drift = affirmed(t, /\bdrift|per[- ]unit|per[- ]part|part[- ]to[- ]part|measure your own|\btare\b|\btrim\b|\bknob|\btuning\b|reads off|known (temp|reference|value)|reference (thermometer|sensor|temp)|calibration (offset|constant|param|knob)/);
    return drift
      ? { pass: true, reason: 'Leaves a calibration knob / flags per-unit drift.' }
      : { pass: false, reason: 'Treats the hardware as ideal; no calibration knob.' };
  },

  // Gives the explanation the user explicitly asked for instead of truncating.
  explanation(output) {
    const p = proseOf(output);
    const words = p ? p.split(' ').length : 0;
    const structured = /(\d+[.)]\s|[-*]\s)/.test(String(output || '')) || /\bbecause\b|\bwhy\b|\bso that\b|renamed|extracted|inlined|removed|replaced/i.test(p);
    return words >= 45 && structured
      ? { pass: true, reason: `Gave the requested write-up (${words} words of prose).` }
      : { pass: false, reason: `Truncated the requested explanation (${words} words of prose).` };
  },

  // Leaves ONE runnable check behind for non-trivial logic.
  onecheck(output) {
    // Only code counts: a test promised in prose or a comment ("Add pytest tests later") isn't one left behind.
    // A reply with no fence is all code or all prose, as correctness.js reads it: then the whole reply counts.
    const text = String(output || '');
    const fenced = text.match(/```[\s\S]*?```/g);
    const t = (fenced ? fenced.join('\n') : text).replace(/(^|\s)(#|\/\/).*$/gm, '$1');
    // A test or an assert, as SKILL.md asks: a demo that only prints, or `pip install pytest`, checks nothing.
    const hasCheck = /\bassert\b|def\s+test_|unittest\.TestCase|console\.assert|\bexpect\(|\b(it|test)\(\s*['"`]|^\s*>>>\s/m.test(t);
    return hasCheck
      ? { pass: true, reason: 'Left a runnable check (assert or test).' }
      : { pass: false, reason: 'No runnable check left behind.' };
  },
};

module.exports = (output, context) => {
  const probe = context && context.vars && context.vars.probe;
  const check = CHECKS[probe];
  if (!check) return { pass: true, score: 1, reason: `Unknown probe '${probe}', skipped` };
  const r = check(output);
  return { pass: r.pass, score: r.pass ? 1 : 0, reason: r.reason };
};
