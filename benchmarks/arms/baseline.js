// Baseline arm: no skill, with a one-line system prompt so the model doesn't ramble.
const system = 'Provide just one example for any given task, and no commentary or usage examples.';
module.exports = ({ vars }) => [
  { role: 'system', content: system },
  { role: 'user', content: vars.task },
];
