// Deterministic code-size metric: non-blank, non-comment lines of code. Counts
// fenced blocks, or the whole response when the model emitted bare code unfenced.
// Recorded as the `code_loc` metric per arm (always passes; it is a measurement, not a gate).
module.exports = (output) => {
  const text = String(output || '');
  const blocks = [...text.matchAll(/```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const code = blocks.length ? blocks.join('\n') : text;
  const loc = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('#') && l !== '*/' && !l.startsWith('/*') && !l.startsWith('*')).length;
  return { pass: true, score: loc, reason: loc + ' code LOC' };
};
