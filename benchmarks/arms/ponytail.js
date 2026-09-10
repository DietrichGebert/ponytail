// Ponytail arm: the repo's own full-level ruleset as the system prompt.
// Uses the mode-filtered builder (not the raw SKILL.md, which since #664
// carries the union of all three levels plus gating markers) so the arm
// measures "the enforced default" — the production injection path.
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const system = getPonytailInstructions('full');
module.exports = ({ vars }) => [
  { role: 'system', content: system },
  { role: 'user', content: vars.task },
];
