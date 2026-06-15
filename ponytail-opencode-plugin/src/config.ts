import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { cwd } from "process";

export type PonytailMode = "off" | "lite" | "full" | "ultra" | "review";

export interface PonytailConfig {
  enabled: boolean;
  defaultMode: PonytailMode;
  features: {
    ponytail: boolean;
    review: boolean;
  };
}

const defaults: PonytailConfig = {
  enabled: true,
  defaultMode: "full",
  features: {
    ponytail: true,
    review: true,
  },
};

function loadConfigFile(filePath: string): Partial<PonytailConfig> | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function loadConfig(): PonytailConfig {
  const paths = [
    join(cwd(), "ponytail.json"),
    join(homedir(), ".config", "opencode", "ponytail.json"),
  ];

  for (const p of paths) {
    const cfg = loadConfigFile(p);
    if (cfg) {
      return {
        ...defaults,
        ...cfg,
        features: { ...defaults.features, ...cfg.features },
      };
    }
  }

  return defaults;
}

export const VALID_MODES: PonytailMode[] = ["off", "lite", "full", "ultra", "review"];
export const RUNTIME_MODES: PonytailMode[] = ["off", "lite", "full", "ultra"];

export function isValidMode(mode: string): mode is PonytailMode {
  return VALID_MODES.includes(mode as PonytailMode);
}

export function isRuntimeMode(mode: string): mode is PonytailMode {
  return RUNTIME_MODES.includes(mode as PonytailMode);
}
