import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { buildSkillPromptMessage, getActiveSkills } from "@oh-my-pi/pi-coding-agent/extensibility/skills";
import { createRequire } from "node:module";
import { parsePonytailCommand } from "../pi-extension/index.js";

const require = createRequire(import.meta.url);
const {
  RUNTIME_MODES,
  getDefaultMode,
  getQuietStartup,
  normalizePersistedMode,
  isDeactivationCommand,
  writeDefaultMode,
} = require("../hooks/ponytail-config.js");
const { getPonytailInstructions } = require("../hooks/ponytail-instructions.js");
const MARKER = "<omp-ponytail>";

export default function ponytailExtension(omp: ExtensionAPI) {
  function resolveMode(ctx: ExtensionContext): string {
    const entries = ctx.sessionManager.getBranch();
    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index];
      if (entry.type !== "custom" || entry.customType !== "ponytail-mode") continue;
      if (!entry.data || typeof entry.data !== "object" || !("mode" in entry.data)) continue;
      const mode = normalizePersistedMode(entry.data.mode);
      if (mode) return mode;
    }
    // Pin the initial default to this branch, not mutable extension-global state.
    const mode = getDefaultMode();
    omp.appendEntry("ponytail-mode", { mode });
    return mode;
  }

  function notify(ctx: ExtensionContext, message: string, level: "info" | "warning" | "error" = "info") {
    if (ctx.hasUI) ctx.ui.notify(message, level);
  }

  function setMode(ctx: ExtensionContext, mode: string) {
    omp.appendEntry("ponytail-mode", { mode });
    notify(ctx, `Ponytail mode set to ${mode}.`);
  }

  omp.registerCommand("ponytail", {
    description: "Set Ponytail mode or inspect status; default <mode> changes future sessions",
    handler: async (args, ctx) => {
      const currentMode = resolveMode(ctx);
      const defaultMode = getDefaultMode();
      const parsed = parsePonytailCommand(args, defaultMode);
      if (parsed.type === "status") {
        notify(ctx, `Ponytail: current ${currentMode} • default ${defaultMode}`);
      } else if (parsed.type === "set-mode") {
        setMode(ctx, parsed.mode);
      } else if (parsed.type === "set-default") {
        try {
          const written = writeDefaultMode(parsed.mode);
          if (written) {
            const effective = getDefaultMode();
            notify(ctx, effective === written
              ? `Default Ponytail mode set to ${written}.`
              : `Saved default ${written}, but env override keeps default at ${effective}.`);
          }
        } catch (error) {
          notify(ctx, `Failed to save default mode: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
      } else {
        notify(ctx, `Unknown or unsupported /ponytail mode. Use ${RUNTIME_MODES.join("|")}, status, or default <mode>.`, "warning");
      }
    },
  });

  for (const name of ["ponytail-review", "ponytail-audit", "ponytail-gain", "ponytail-debt", "ponytail-help"]) {
    omp.registerCommand(name, {
      description: `Run the active ${name} skill`,
      handler: async (args, ctx) => {
        const skill = getActiveSkills().find((candidate) => candidate.name === name);
        if (!skill) {
          notify(ctx, `Skill ${name} is unavailable. Enable the Ponytail package skills.`, "warning");
          return;
        }
        if (skill._source?.level === "project" && !ctx.isProjectTrusted()) {
          notify(ctx, `Skill ${name} is project-local and this project is not trusted.`, "warning");
          return;
        }
        try {
          const { message } = await buildSkillPromptMessage(skill, args, "user");
          if (ctx.isIdle()) {
            omp.sendUserMessage(message);
          } else {
            omp.sendUserMessage(message, { deliverAs: "followUp" });
            notify(ctx, `/${name} queued as follow-up.`);
          }
        } catch (error) {
          notify(ctx, `Unable to load skill ${name}: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
      },
    });
  }

  omp.on("session_start", async (_event, ctx) => {
    const mode = resolveMode(ctx);
    if (!getQuietStartup()) notify(ctx, `Ponytail loaded: ${mode}`);
  });
  const restore = async (_event: unknown, ctx: ExtensionContext) => { resolveMode(ctx); };
  omp.on("session_switch", restore);
  omp.on("session_tree", restore);
  omp.on("session_branch", restore);
  omp.on("session_compact", restore);

  omp.on("input", async (event, ctx) => {
    if (event.source === "extension" || !isDeactivationCommand(event.text)) return;
    if (resolveMode(ctx) !== "off") setMode(ctx, "off");
  });

  omp.on("before_agent_start", async (event, ctx) => {
    const blocks = event.systemPrompt.filter((block) => !block.startsWith(MARKER));
    const mode = resolveMode(ctx);
    if (mode === "off") {
      return blocks.length === event.systemPrompt.length ? undefined : { systemPrompt: blocks };
    }
    return { systemPrompt: [...blocks, `${MARKER}\n${getPonytailInstructions(mode)}\n</omp-ponytail>`] };
  });
}
