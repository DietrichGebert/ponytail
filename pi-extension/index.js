import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_MODE,
  RUNTIME_MODES,
  getDefaultMode,
  getQuietStartup,
  getHideStatus,
  normalizeMode,
  normalizePersistedMode,
  isDeactivationCommand,
  writeDefaultMode,
} = require("../hooks/ponytail-config.js");
const { getPonytailInstructions, filterSkillBodyForMode } = require("../hooks/ponytail-instructions.js");

export { filterSkillBodyForMode };
export const readDefaultMode = getDefaultMode;
export const readQuietStartup = getQuietStartup;

const RUNTIME_MODE_LIST = RUNTIME_MODES.join("|");
const PONYTAIL_COMMAND_DESCRIPTION = `Set mode: ${RUNTIME_MODE_LIST}. Commands: status, default <mode>`;

export function resolveSessionMode(entries, fallbackMode = DEFAULT_MODE) {
  const fallback = normalizePersistedMode(fallbackMode) || DEFAULT_MODE;
  if (!Array.isArray(entries)) return fallback;

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.type !== "custom" || entry?.customType !== "ponytail-mode") continue;

    const mode = normalizePersistedMode(entry?.data?.mode);
    if (mode) return mode;
  }

  return fallback;
}

export function parsePonytailCommand(text, defaultMode = DEFAULT_MODE) {
  const fallback = normalizePersistedMode(defaultMode) || DEFAULT_MODE;
  const normalizedText = String(text || "").trim().toLowerCase();

  if (!normalizedText) {
    return { type: "set-mode", mode: fallback === "off" ? "full" : fallback };
  }

  const [primary, secondary] = normalizedText.split(/\s+/);

  if (primary === "status") return { type: "status" };

  if (primary === "default") {
    // ponytail: a default must be a runtime level; review is session-only (#377).
    const mode = normalizeMode(secondary);
    return mode ? { type: "set-default", mode } : { type: "invalid", reason: "invalid-default-mode" };
  }

  const mode = normalizeMode(primary);
  return mode ? { type: "set-mode", mode } : { type: "invalid", reason: "invalid-mode", mode: primary };
}

export { writeDefaultMode };

export default function ponytailExtension(pi) {
  let currentMode = DEFAULT_MODE;
  let configuredDefaultMode = getDefaultMode();
  let hideStatus = getHideStatus();
  let isActive = false;
  let lastCtx = null;

  // -- Status line --
  // "🐴 <mode>" — accent while the agent runs, muted when idle. null hides.
  function ponytailStatus(themeOf) {
    if (currentMode === "off" || hideStatus) return null;
    const plain = "🐴 " + currentMode;
    try {
      const theme = themeOf?.();
      return theme?.fg ? "🐴 " + theme.fg(isActive ? "accent" : "muted", currentMode) : plain;
    } catch {
      return plain; // theme proxy can throw before initTheme
    }
  }

  // Register a real segment in the host's status-line registry — pi.pi is the
  // host's own module namespace, so this is the object the bar renders from —
  // and ride the built-in presets so no user config is needed. The ascii
  // preset stays emoji-free.
  // Custom-preset hosts bypass the preset tables (they read
  // statusLine.leftSegments from settings), so also append via a runtime
  // override — override() is explicitly non-persisted; set() would write the
  // user's config file.
  // ponytail: unofficial seam — omp has no extension-segment API as of
  // 17.4.0; SEGMENTS/presets/settings.override are root exports, so this
  // breaks if omp stops exporting them. Replace when an official API ships.
  const hostSegments = pi.pi?.SEGMENTS;
  if (hostSegments && pi.pi?.STATUS_LINE_PRESETS && !hostSegments.ponytail) {
    hostSegments.ponytail = {
      id: "ponytail",
      render: () => {
        const text = ponytailStatus(() => pi.pi.theme);
        return { content: text ?? "", visible: text !== null };
      },
    };
    for (const [name, preset] of Object.entries(pi.pi.STATUS_LINE_PRESETS)) {
      if (name === "ascii" || !Array.isArray(preset?.leftSegments) || preset.leftSegments.includes("ponytail")) continue;
      const after = preset.leftSegments.indexOf("mode");
      preset.leftSegments.splice(after === -1 ? preset.leftSegments.length : after + 1, 0, "ponytail");
    }
    const hostSettings = pi.pi.settings;
    if (
      typeof hostSettings?.isConfigured === "function" &&
      hostSettings.get("statusLine.preset") === "custom" &&
      hostSettings.isConfigured("statusLine.leftSegments")
    ) {
      const segments = hostSettings.get("statusLine.leftSegments");
      if (Array.isArray(segments) && segments.length > 0 && !segments.includes("ponytail")) {
        const after = segments.indexOf("mode");
        const next = [...segments.slice(0, after + 1), "ponytail", ...segments.slice(after + 1)];
        hostSettings.override("statusLine.leftSegments", after === -1 ? [...segments, "ponytail"] : next);
      }
    }
  }

  function syncStatus(ctx) {
    if (ctx) lastCtx = ctx;
    const c = ctx || lastCtx;
    if (!c?.ui?.setStatus) return;
    // Segment hosts render lazily from the registry above; this only nudges a
    // repaint and clears any legacy hook line. Legacy hosts get a hook line.
    const text = hostSegments ? undefined : ponytailStatus(() => c.ui?.theme);
    c.ui.setStatus("ponytail", text ?? undefined);
  }

  const setMode = (mode, ctx) => {
    const normalized = normalizePersistedMode(mode);
    if (!normalized) return;

    currentMode = normalized;
    pi.appendEntry("ponytail-mode", { mode: normalized });
    syncStatus(ctx);
    ctx?.ui?.notify?.(`Ponytail mode set to ${normalized}.`, "info");
  };

  const sendAlias = (skillName, args, ctx) => {
    const normalized = String(args || "").trim();
    const message = normalized ? `${skillName} ${normalized}` : skillName;

    if (ctx?.isIdle?.() === false) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx?.ui?.notify?.(`${skillName} queued as follow-up.`, "info");
      return;
    }

    pi.sendUserMessage(message);
  };

  pi.registerCommand("ponytail", {
    description: PONYTAIL_COMMAND_DESCRIPTION,
    handler: async (args, ctx) => {
      const parsed = parsePonytailCommand(args, configuredDefaultMode);

      if (parsed.type === "status") {
        ctx?.ui?.notify?.(`Ponytail: current ${currentMode} • default ${configuredDefaultMode}`, "info");
        return;
      }

      if (parsed.type === "set-default") {
        try {
          const written = writeDefaultMode(parsed.mode);
          if (written) {
            configuredDefaultMode = getDefaultMode();
            const message = configuredDefaultMode === written
              ? `Default Ponytail mode set to ${written}.`
              : `Saved default ${written}, but env override keeps default at ${configuredDefaultMode}.`;
            ctx?.ui?.notify?.(message, "info");
          }
        } catch (e) {
          ctx?.ui?.notify?.(`Failed to save default mode: ${e.message}`, "error");
        }
        return;
      }

      if (parsed.type === "set-mode") {
        setMode(parsed.mode, ctx);
        return;
      }

      ctx?.ui?.notify?.("Unknown or unsupported /ponytail mode.", "warning");
    },
  });

  pi.registerCommand("ponytail-review", {
    description: "Run /skill:ponytail-review",
    handler: (_args, ctx) => sendAlias("/skill:ponytail-review", "", ctx),
  });

  pi.registerCommand("ponytail-audit", {
    description: "Run /skill:ponytail-audit",
    handler: (_args, ctx) => sendAlias("/skill:ponytail-audit", "", ctx),
  });

  pi.registerCommand("ponytail-gain", {
    description: "Run /skill:ponytail-gain",
    handler: (_args, ctx) => sendAlias("/skill:ponytail-gain", "", ctx),
  });

  pi.registerCommand("ponytail-debt", {
    description: "Run /skill:ponytail-debt",
    handler: (_args, ctx) => sendAlias("/skill:ponytail-debt", "", ctx),
  });

  pi.registerCommand("ponytail-help", {
    description: "Run /skill:ponytail-help",
    handler: (_args, ctx) => sendAlias("/skill:ponytail-help", "", ctx),
  });

  pi.on("input", async (event) => {
    if (event?.source === "extension") return;

    const text = String(event?.text || "");
    if (currentMode !== "off" && isDeactivationCommand(text)) {
      setMode("off");
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx?.sessionManager?.getBranch?.() || ctx?.sessionManager?.getEntries?.() || [];
    configuredDefaultMode = getDefaultMode();
    hideStatus = getHideStatus();
    currentMode = resolveSessionMode(entries, configuredDefaultMode);
    syncStatus(ctx);
    if (!getQuietStartup()) {
      ctx?.ui?.notify?.(`Ponytail loaded: ${currentMode}`, "info");
    }
  });

  pi.on("agent_start", async (_event, ctx) => {
    isActive = true;
    syncStatus(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    isActive = false;
    syncStatus(ctx);
  });

  pi.on("before_agent_start", async (event) => {
    if (!currentMode || currentMode === "off") return;
    // Guard a null/undefined event or a missing systemPrompt: don't crash, and
    // don't prepend the literal string "undefined" to the prompt (#439, #440).
    const base = event?.systemPrompt ? `${event.systemPrompt}\n\n` : "";
    return { systemPrompt: `${base}${getPonytailInstructions(currentMode)}` };
  });
}
