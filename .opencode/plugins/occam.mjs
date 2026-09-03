/**
 * OCCAM-CORE: Native OpenCode High-Performance Plugin
 * Injects the exact 42-token JIT Micro-Grammar and intercepts over-engineering.
 */

const OCCAM_JIT_KERNEL = `
[OCCAM-CORE: JIT ACTIVE]
1. Invariant Safety: Boundary/RFC/Error checks are mandatory. Penalty for omission is infinite.
2. Stdlib Dominance: Always select stdlib/native over third-party dependencies or custom classes.
3. Parsimony: Minimize AST depth and Halstead Volume. No boilerplate.
`.trim();

export default {
  name: "occam-core",
  version: "2.0.0",

  async "chat.system.transform"(event) {
    try {
      if (!event || typeof event.systemPrompt !== "string") {
        return event;
      }
      event.systemPrompt = `${OCCAM_JIT_KERNEL}\n\n${event.systemPrompt}`;
      return event;
    } catch (err) {
      console.error("[OCCAM-CORE ERROR] System prompt transform degraded safely:", err);
      return event;
    }
  },

  async "tool.execute.before"(event) {
    if (event.tool === "edit_file" || event.tool === "write_file") {
      const content = event.args?.content || "";
      if (content.includes("class Node") && content.includes("self.prev")) {
        throw new Error("[OCCAM-CORE INTERCEPT] Over-engineering detected: Use collections.OrderedDict or native structures instead of manual linked lists.");
      }
    }
    return event;
  }
};
