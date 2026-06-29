#!/usr/bin/env node
// Graybeard MCP server: serves the stack-aware senior-dev ruleset over stdio as a
// prompt (user-invoked) and a tool (for hosts that pull context via tools).
// It does NOT replace the always-on adapters; it's the clean option for hosts
// whose only injection point is the prompt menu (see #70).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { MODES, buildInstructions, resolveMode } from "./instructions.js";

const server = new McpServer({ name: "graybeard", version: "0.1.0" });

const modeArg = z
  .enum(MODES)
  .optional()
  .describe("Graybeard intensity: advisory, balanced, or strict. Omit for the configured default.");

server.registerPrompt(
  "graybeard",
  {
    title: "Graybeard mode",
    description: "Stack-aware senior dev instructions: framework-native, maintainable, tested changes.",
    argsSchema: { mode: modeArg },
  },
  ({ mode }) => ({
    messages: [{ role: "user", content: { type: "text", text: buildInstructions(mode) } }],
  }),
);

server.registerTool(
  "graybeard_instructions",
  {
    title: "Graybeard instructions",
    description: "Return the Graybeard ruleset for the given intensity (advisory, balanced, or strict).",
    inputSchema: { mode: modeArg },
    outputSchema: { mode: z.string(), instructions: z.string() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ({ mode }) => {
    const resolvedMode = resolveMode(mode);
    const instructions = buildInstructions(resolvedMode);
    const structuredContent = { mode: resolvedMode, instructions };
    return { content: [{ type: "text", text: instructions }], structuredContent };
  },
);

await server.connect(new StdioServerTransport());
