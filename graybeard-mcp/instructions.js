// Pure instruction selection for the Graybeard MCP server. No MCP/SDK imports,
// so this stays unit-testable on its own. Reuses the same builder the Claude
// hooks and Pi extension use, so every host emits identical rules.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getGraybeardInstructions } = require("../hooks/graybeard-instructions.js");
const { getDefaultMode, normalizeMode } = require("../hooks/graybeard-config.js");

// The three intensities the server offers. "off" has no instructions to serve.
export const MODES = ["advisory", "balanced", "strict"];

// Resolve a requested mode to a runtime intensity. Unknown, empty, or "off"
// falls back to the configured default, then to "balanced".
// graybeard: keep the surface to these three; "off"/"review" aren't served here.
export function resolveMode(requested) {
  const asked = normalizeMode(requested);
  if (asked && asked !== "off") return asked;

  const fallback = normalizeMode(getDefaultMode());
  return fallback && fallback !== "off" ? fallback : "balanced";
}

export function buildInstructions(requested) {
  return getGraybeardInstructions(resolveMode(requested));
}
