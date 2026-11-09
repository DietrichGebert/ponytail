// Host capabilities for lifecycle hooks.
// Detection stays in ponytail-runtime.js; this module names what each host
// needs from UserPromptSubmit / mode switching so callers do not nest
// isQoder / isCursor / isCodex branches.

const {
  isCodeBuddy,
  isCodex,
  isCopilot,
  isCursor,
  isQoder,
} = require('./ponytail-runtime');

function caps(id, overrides = {}) {
  return {
    id,
    // Qoder has no SessionStart: inject the ruleset on every prompt.
    injectRulesEveryPrompt: false,
    // Qoder allows one JSON on stdout per turn: fold notices into that ruleset.
    foldNoticesIntoRuleset: false,
    // Codex/Cursor have no skill reload on /ponytail: send the new level's body.
    deliverRulesetOnModeSwitch: false,
    // Qoder keeps an explicit "off" flag so the next prompt stays off.
    persistOffAsFlag: false,
    // Claude Code band UI only.
    supportsBand: false,
    // Claude Code statusLine nudge / copy refresh on SessionStart.
    supportsStatuslineNudge: false,
    // Cursor always-on .cursor/rules/ponytail.mdc owns the ruleset when present.
    respectsAlwaysOnRule: false,
    ...overrides,
  };
}

function resolveHost() {
  if (isCopilot) return caps('copilot');
  if (isCodex) return caps('codex', { deliverRulesetOnModeSwitch: true });
  if (isQoder) {
    return caps('qoder', {
      injectRulesEveryPrompt: true,
      foldNoticesIntoRuleset: true,
      persistOffAsFlag: true,
    });
  }
  if (isCodeBuddy) return caps('codebuddy');
  if (isCursor) {
    return caps('cursor', {
      deliverRulesetOnModeSwitch: true,
      respectsAlwaysOnRule: true,
    });
  }
  return caps('claude', { supportsBand: true, supportsStatuslineNudge: true });
}

module.exports = { resolveHost };
