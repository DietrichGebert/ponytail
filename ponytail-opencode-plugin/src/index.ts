import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { loadConfig } from "./config";
import { getMode, setMode } from "./state";
import { getPonytailInstructions } from "./skills/ponytail";
import { handleMode } from "./commands/mode";
import { handleReview } from "./commands/review";
import type { PonytailMode } from "./config";

const ponytailPlugin: Plugin = async () => {
  const hooks: Hooks = {
    config: async (opencodeConfig: any) => {
      opencodeConfig.command ??= {};
      opencodeConfig.command["ponytail"] = {
        template: "",
        description: "Switch ponytail mode (off/lite/full/ultra)",
      };
      opencodeConfig.command["ponytail-review"] = {
        template: "",
        description: "Run ponytail over-engineering review",
      };
    },

    "experimental.chat.system.transform": async (input, output) => {
      const cfg = loadConfig();
      if (!cfg.enabled || !cfg.features.ponytail) return;

      const sessionID = input.sessionID;
      if (!sessionID) return;

      let mode = getMode(sessionID);

      if (mode === "off" || !mode) {
        mode = cfg.defaultMode;
        if (mode !== "off") {
          setMode(sessionID, mode as PonytailMode);
        } else {
          return;
        }
      }

      output.system.push(getPonytailInstructions(mode as PonytailMode));
    },

    "command.execute.before": async (input, output) => {
      const cmd = input.command;
      const args = input.arguments.trim();
      const sessionID = input.sessionID;

      if (cmd === "ponytail") {
        const result = handleMode(sessionID, args);
        output.parts = [{ type: "text", text: result.text } as any];
        return;
      }

      if (cmd === "ponytail-review") {
        const result = handleReview(sessionID, args);
        output.parts = [{ type: "text", text: result.text } as any];
        return;
      }
    },
  };

  return hooks;
};

export default ponytailPlugin;
