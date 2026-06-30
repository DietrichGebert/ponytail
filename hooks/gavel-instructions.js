#!/usr/bin/env node
// gavel — instruction builder
//
// Builds the QA ruleset text for injection into system prompts.
// Reads AGENTS.md and returns it with mode-specific filtering.

const fs = require('fs');
const path = require('path');

function getGavelInstructions(mode) {
  const agentsPath = path.resolve(__dirname, '..', 'AGENTS.md');

  try {
    const content = fs.readFileSync(agentsPath, 'utf8');
    const header = `# Gavel QA Rules (mode: ${mode})\n\n`;

    if (mode === 'lite') {
      return header +
        '**Mode: lite** — Suggest improvements, don\'t block.\n\n' +
        'Apply the QA ladder as suggestions. Flag violations but don\'t refuse to proceed.\n\n' +
        content;
    }

    if (mode === 'strict') {
      return header +
        '**Mode: strict** — Zero tolerance. Reject any Test Constitution violation.\n\n' +
        content;
    }

    // full (default)
    return header + content;
  } catch (e) {
    // AGENTS.md not found — return minimal rules
    return `# Gavel QA Rules (mode: ${mode})

## QA Ladder
1. Does this test need to exist? (YAGNI)
2. Already in this suite? Reuse.
3. Framework handles it? Use built-in.
4. Native locator strategy? Accessibility-first.
5. Existing page object covers it? Extend.
6. One assertion captures the bug? One assertion.
7. Only then: the minimum test.

## Test Constitution
- DI via fixtures, not direct instantiation
- Accessibility-first locators > data-testid > CSS > XPath
- Factory data, never hardcoded
- Framework-native assertions, no manual sleeps
- Every test passes or is a bug
- Verify after changes (compile + lint + test)
`;
  }
}

module.exports = { getGavelInstructions };
