import { loadConfig, isValidMode, VALID_MODES, type PonytailMode } from "../config";
import { getMode, setMode } from "../state";

export interface CommandResult {
  text: string;
}

export function handleMode(sessionId: string, args: string): CommandResult {
  const cfg = loadConfig();

  if (!cfg.features.ponytail) {
    return { text: "ponytail feature disabled." };
  }

  const requested = args.toLowerCase().trim();

  if (!requested) {
    const current = getMode(sessionId);
    return { text: `Mode: ${current}. Use /ponytail ${VALID_MODES.join("|")}` };
  }

  if (!isValidMode(requested)) {
    return { text: `Bad mode. Valid: ${VALID_MODES.join(", ")}` };
  }

  setMode(sessionId, requested as PonytailMode);

  if (requested === "off") {
    return { text: "Ponytail mode off." };
  }

  return { text: `Ponytail mode ${requested}.` };
}
