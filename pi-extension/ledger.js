import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { readDefaultMode, resolveSessionMode } from "./index.js";

const messagesOf = (entries) => entries.filter((e) => e?.type === "message" && e.message).map((e) => e.message);

const textOf = (message) => {
  const content = message?.content;
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.filter((c) => c?.type === "text").map((c) => c.text).join("\n") : "";
};

export function sessionName(named, entries) {
  const first = messagesOf(entries).find((m) => m.role === "user");
  return String(named || textOf(first) || "").replace(/\s*[\r\n]+\s*/g, " ").trim().slice(0, 60);
}

export function testsFrom(entries, band) {
  const messages = messagesOf(entries);
  const calls = messages.flatMap((m) => (m.role === "assistant" && Array.isArray(m.content) ? m.content.filter((c) => c?.type === "toolCall") : []));
  const last = calls.findLastIndex((c) => c.name === "bash" && band.isTestCommand(String(c.arguments?.command ?? "")));
  if (last < 0) return { state: "none" };
  const result = messages.find((m) => m.role === "toolResult" && m.toolCallId === calls[last].id);
  const counts = band.testCounts(textOf(result));
  // A run with no result was cut off, so it proves nothing passed.
  const failed = !result || result.isError || counts.failed > 0;
  const stale = calls.slice(last + 1).some((c) => c.name === "edit" || c.name === "write");
  return { state: stale ? "stale" : failed ? "fail" : "pass", ...counts };
}

export function snapshotFrom({ entries, header, sessionId, project, named, agentMs, level }, band) {
  const messages = messagesOf(entries);
  const replies = messages.filter((m) => m.role === "assistant");
  if (replies.length === 0) return null;

  // Every entry, abandoned branches included: those tokens were still spent.
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let cost = 0;
  for (const e of entries) {
    const u = e?.type === "message" ? e.message?.usage : e?.usage;
    if (!u) continue;
    for (const k of Object.keys(tokens)) tokens[k] += Number(u[k]) || 0;
    cost += Number(u.cost?.total) || 0;
  }

  const counts = new Map();
  for (const m of replies) if (m.model) counts.set(m.model, (counts.get(m.model) ?? 0) + 1);
  const model = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const startedAt = Date.parse(header?.timestamp);
  return {
    key: band.taskKey(sessionId, startedAt),
    started: band.stamp(startedAt),
    project,
    name: sessionName(named, entries),
    session: sessionId,
    level,
    model,
    cost: +cost.toFixed(4),
    lastTurn: null,
    turns: messages.filter((m) => m.role === "user").length,
    agentMs,
    tokens,
    reuse: null,
    reused: 0,
    created: 0,
    callersOpen: 0,
    tests: band.testsLabel(testsFrom(entries, band)),
  };
}

// Same place as the band's ledger, so pi and Claude Code share one board.
export const ledgerDir = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "ponytail", "band");

export const ledgerFile = (dir, project) => join(dir, `${project.replace(/[^\w.-]/g, "_")}.csv`);

export const opener = (platform, file) =>
  platform === "win32" ? ["cmd", ["/c", "start", "", file]] : [platform === "darwin" ? "open" : "xdg-open", [file]];

// mode applies only when the file is created, so existing files keep theirs.
const write = (file, text) => writeFileSync(file, text, { mode: 0o600 });

function writeBoard(band) {
  const dir = ledgerDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const texts = readdirSync(dir).filter((f) => f.endsWith(".csv")).map((f) => readFileSync(join(dir, f), "utf8"));
  const file = join(dir, "board.html");
  write(file, band.boardHtml(texts.flatMap(band.tasksFrom), Date.now()));
  return file;
}

export function registerBoard(pi, band) {
  let project = "";
  let agentMs = 0;
  let runStart = 0;
  let warned = false;

  const keyOf = (ctx) => band.taskKey(ctx?.sessionManager?.getSessionId?.() ?? "", Date.parse(ctx?.sessionManager?.getHeader?.()?.timestamp));

  const warn = (ctx, error) => {
    if (warned) return;
    warned = true;
    ctx?.ui?.notify?.(`ponytail board: could not write the ledger (${error?.message ?? error})`, "warning");
  };

  async function projectOf(ctx) {
    const git = await pi.exec?.("git", ["rev-parse", "--show-toplevel"], { cwd: ctx?.cwd }).catch(() => undefined);
    return basename(git?.code === 0 && git.stdout.trim() ? git.stdout.trim() : ctx?.cwd ?? process.cwd());
  }

  // A reload or resume picks the agent time up from the session's own row, as the band's resume does.
  function readAgentMs(ctx) {
    const file = ledgerFile(ledgerDir(), project);
    if (!existsSync(file)) return 0;
    const [head, ...rows] = band.parseCsv(readFileSync(file, "utf8"));
    const key = keyOf(ctx);
    const row = head && rows.find((r) => r[head.indexOf("key")] === key);
    return (Number(row?.[head.indexOf("agent_minutes")]) || 0) * 60000;
  }

  pi.on("session_start", async (_event, ctx) => {
    warned = false;
    agentMs = 0;
    runStart = 0;
    try {
      project = await projectOf(ctx);
      agentMs = readAgentMs(ctx);
    } catch (e) {
      warn(ctx, e);
    }
  });

  pi.on("agent_start", async () => {
    runStart = Date.now();
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (runStart) agentMs += Date.now() - runStart;
    runStart = 0;
    try {
      project ||= await projectOf(ctx);
      const sm = ctx?.sessionManager;
      const entries = sm?.getEntries?.() ?? [];
      const snapshot = snapshotFrom({
        entries,
        header: sm?.getHeader?.(),
        sessionId: sm?.getSessionId?.() ?? "",
        project,
        named: pi.getSessionName?.(),
        agentMs,
        level: resolveSessionMode(entries, readDefaultMode()),
      }, band);
      if (!snapshot) return;
      const dir = ledgerDir();
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const file = ledgerFile(dir, project);
      write(file, band.upsertCsv(existsSync(file) ? readFileSync(file, "utf8") : "", snapshot));
      writeBoard(band);
    } catch (e) {
      warn(ctx, e);
    }
  });

  pi.registerCommand("ponytail-board", {
    description: "Rebuild and open the ponytail board",
    handler: async (_args, ctx) => {
      const file = join(ledgerDir(), "board.html");
      try {
        const [cmd, args] = opener(process.platform, writeBoard(band));
        const opened = await pi.exec(cmd, args);
        if (opened?.code === 0) return;
      } catch {}
      ctx?.ui?.notify?.(`ponytail board: open ${file} in a browser`, "warning");
    },
  });
}
