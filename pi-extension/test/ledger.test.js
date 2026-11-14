import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { ledgerDir, ledgerFile, opener, registerBoard, sessionName, snapshotFrom, testsFrom } from "../ledger.js";

// Stand-ins for the band's TypeScript, which plain Node cannot import.
const band = {
  taskKey: (session, startedAt) => `${session.slice(0, 8)}-${startedAt}`,
  stamp: (ms) => `stamp:${ms}`,
  isTestCommand: (command) => /\bnpm test\b/.test(command),
  testCounts: (output) => ({
    passed: /(\d+) passed/.test(output) ? Number(/(\d+) passed/.exec(output)[1]) : undefined,
    failed: /(\d+) failed/.test(output) ? Number(/(\d+) failed/.exec(output)[1]) : undefined,
  }),
  testsLabel: (t) => t.state,
  upsertCsv: (existing, s) => {
    const rows = existing.split("\n").filter((l) => l && !l.startsWith("key,") && !l.startsWith(`${s.key},`));
    return ["key,agent_minutes", ...rows, `${s.key},${(s.agentMs / 60000).toFixed(1)}`].join("\n") + "\n";
  },
  parseCsv: (text) => text.trim().split("\n").map((l) => l.split(",")),
  tasksFrom: (text) => text.trim().split("\n").slice(1),
  boardHtml: (tasks) => `<board>${tasks.join("|")}</board>`,
};

const HEADER = { type: "session", id: "abcdef1234", timestamp: "2026-11-14T13:39:28.526Z" };
const KEY = `abcdef12-${Date.parse(HEADER.timestamp)}`;
const user = (text) => ({ type: "message", message: { role: "user", content: [{ type: "text", text }] } });
const usage = (n, cost) => ({ input: n, output: 1, cacheRead: 2, cacheWrite: 3, cost: { total: cost } });
const reply = (model, n = 10, cost = 0.5, content = [{ type: "text", text: "ok" }]) =>
  ({ type: "message", message: { role: "assistant", model, usage: usage(n, cost), content } });
const call = (id, name, args) => reply("m", 0, 0, [{ type: "toolCall", id, name, arguments: args }]);
const result = (id, text, isError = false) =>
  ({ type: "message", message: { role: "toolResult", toolCallId: id, content: [{ type: "text", text }], isError } });

const snap = (entries, extra = {}) =>
  snapshotFrom({ entries, header: HEADER, sessionId: HEADER.id, project: "p", named: "", agentMs: 0, level: "full", ...extra }, band);

describe("snapshotFrom", () => {
  test("should sum cost and tokens over every usage-bearing entry when some sit on an abandoned branch", () => {
    const entries = [
      user("hi"),
      reply("a", 10, 0.5),
      { type: "usage", kind: "cache_warm", usage: usage(100, 0.25) },
      { type: "compaction", usage: usage(1000, 1) },
      { type: "branch_summary", usage: usage(10000, 2) },
      { type: "message", message: { role: "toolResult", usage: usage(5, 0.125), content: [] } },
      { ...reply("a", 20, 0.5), parentId: "abandoned" },
    ];

    const s = snap(entries);

    assert.equal(s.cost, 4.375, "cost should sum all usage-bearing entries");
    assert.deepEqual(s.tokens, { input: 11135, output: 6, cacheRead: 12, cacheWrite: 18 }, "tokens should sum per kind");
  });

  test("should count user messages as turns and pick the most frequent model when replies differ", () => {
    const entries = [user("a"), reply("x"), user("b"), reply("y"), reply("y")];

    const s = snap(entries);

    assert.equal(s.turns, 2, "turns should count user messages");
    assert.equal(s.model, "y", "model should be the most frequent one");
  });

  test("should key the row by session id and header time and fill the fixed band fields when given a session", () => {
    const entries = [user("a"), reply("x")];

    const s = snap(entries, { agentMs: 42, level: "lite" });

    assert.equal(s.key, KEY, "key should come from session id and header time");
    assert.equal(s.started, `stamp:${Date.parse(HEADER.timestamp)}`, "started should be the stamped header time");
    assert.deepEqual(
      [s.session, s.agentMs, s.level, s.project, s.reuse, s.reused, s.created, s.callersOpen, s.lastTurn],
      [HEADER.id, 42, "lite", "p", null, 0, 0, 0, null],
      "passed-through and fixed fields should match",
    );
  });

  test("should return null when no assistant message exists", () => {
    const entries = [user("hi")];

    const s = snap(entries);

    assert.equal(s, null, "no reply should mean no row");
  });
});

describe("sessionName", () => {
  test("should use the session name when one is set", () => {
    assert.equal(sessionName("Named", [user("prompt")]), "Named", "session name should win");
  });

  test("should use the first prompt when no session name is set", () => {
    assert.equal(sessionName(undefined, [user("first"), user("second")]), "first", "first prompt should be the fallback");
  });

  test("should flatten CR/LF to one space when the name has line breaks", () => {
    assert.equal(sessionName("a\r\n  b\nc", []), "a b c", "line breaks should become one space");
  });

  test("should cut to 60 characters when the name is longer", () => {
    assert.equal(sessionName("x".repeat(80), []).length, 60, "name should be 60 characters");
  });
});

describe("testsFrom", () => {
  test("should report none when no test command ran", () => {
    const entries = [call("1", "bash", { command: "ls" }), result("1", "")];

    assert.deepEqual(testsFrom(entries, band), { state: "none" }, "state should be none");
  });

  test("should report pass with the count when the last test run succeeded", () => {
    const entries = [call("1", "bash", { command: "npm test" }), result("1", "3 passed")];

    assert.deepEqual(testsFrom(entries, band), { state: "pass", passed: 3, failed: undefined }, "state should be pass with 3");
  });

  test("should report fail when the test result is an error", () => {
    const entries = [call("1", "bash", { command: "npm test" }), result("1", "boom", true)];

    assert.equal(testsFrom(entries, band).state, "fail", "error result should be fail");
  });

  test("should report fail with the count when the output has failures", () => {
    const entries = [call("1", "bash", { command: "npm test" }), result("1", "2 passed 1 failed")];

    assert.deepEqual(testsFrom(entries, band), { state: "fail", passed: 2, failed: 1 }, "failed count should make it fail");
  });

  test("should report stale when an edit or write follows the last test run", () => {
    const entries = [call("1", "bash", { command: "npm test" }), result("1", "3 passed"), call("2", "write", { path: "x" })];

    assert.equal(testsFrom(entries, band).state, "stale", "later write should make it stale");
  });
});

describe("ledger paths", () => {
  test("should use XDG_CONFIG_HOME when set and ~/.config otherwise", () => {
    const previous = process.env.XDG_CONFIG_HOME;
    try {
      process.env.XDG_CONFIG_HOME = "/x";
      const withXdg = ledgerDir();
      delete process.env.XDG_CONFIG_HOME;
      const without = ledgerDir();

      assert.equal(withXdg, join("/x", "ponytail", "band"), "dir should follow XDG_CONFIG_HOME");
      assert.equal(without, join(homedir(), ".config", "ponytail", "band"), "dir should fall back to ~/.config");
    } finally {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previous;
    }
  });

  test("should map characters outside [\\w.-] to _ when naming the CSV", () => {
    assert.equal(ledgerFile("/d", "my repo/ü.x-1"), join("/d", "my_repo__.x-1.csv"), "unsafe characters should become _");
  });

  test("should pick the platform's open command for each platform", () => {
    assert.deepEqual(opener("win32", "f"), ["cmd", ["/c", "start", "", "f"]], "Windows should use start");
    assert.deepEqual(opener("darwin", "f"), ["open", ["f"]], "macOS should use open");
    assert.deepEqual(opener("linux", "f"), ["xdg-open", ["f"]], "others should use xdg-open");
  });
});

function harness({ entries, exec } = {}) {
  const events = new Map();
  const commands = new Map();
  const execs = [];
  const notes = [];
  const pi = {
    on: (name, fn) => events.set(name, fn),
    registerCommand: (name, opts) => commands.set(name, opts),
    getSessionName: () => "",
    exec: async (cmd, args) => {
      execs.push([cmd, ...args]);
      return exec ? exec(cmd, args) : { code: 1, stdout: "", stderr: "" };
    },
  };
  const ctx = {
    cwd: "/work/proj",
    sessionManager: { getEntries: () => entries ?? [user("hi"), reply("m")], getHeader: () => HEADER, getSessionId: () => HEADER.id },
    ui: { notify: (text, level) => notes.push({ text, level }) },
  };
  registerBoard(pi, band);
  const start = () => events.get("session_start")({}, ctx);
  const run = async () => {
    await events.get("agent_start")({}, ctx);
    await events.get("agent_end")({}, ctx);
  };
  return { events, commands, execs, notes, ctx, start, run };
}

async function withLedger(fn) {
  const home = mkdtempSync(join(tmpdir(), "ponytail-ledger-"));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    await fn(join(home, "ponytail", "band"));
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
}

describe("registerBoard agent_end", () => {
  test("should upsert into the existing CSV and rebuild board.html when run twice", () => withLedger(async (dir) => {
    const h = harness({ exec: (cmd) => (cmd === "git" ? { code: 0, stdout: "/repos/my-repo\n" } : { code: 1 }) });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "my-repo.csv"), "key,agent_minutes\nforeign,1.0\n");
    await h.start();

    await h.run();
    await h.run();

    assert.equal(readFileSync(join(dir, "my-repo.csv"), "utf8"), `key,agent_minutes\nforeign,1.0\n${KEY},0.0\n`, "foreign row should stay and own row appear once");
    assert.equal(readFileSync(join(dir, "board.html"), "utf8"), `<board>foreign,1.0|${KEY},0.0</board>`, "board should be rebuilt from the CSV");
  }));

  test("should name the CSV after the cwd when git has no repo", () => withLedger(async (dir) => {
    const h = harness();
    await h.start();

    await h.run();

    assert.ok(readFileSync(join(dir, "proj.csv"), "utf8").includes(KEY), "row should be in the cwd-named file");
  }));

  test("should add runs on top of the row's own agent time when the session restarts", () => withLedger(async (dir) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proj.csv"), `key,agent_minutes\n${KEY},2.0\n`);
    const h = harness();
    const realNow = Date.now;
    let now = 1000;
    Date.now = () => now;

    try {
      await h.start();
      for (let i = 0; i < 2; i += 1) {
        await h.events.get("agent_start")({}, h.ctx);
        now += 30000;
        await h.events.get("agent_end")({}, h.ctx);
      }
    } finally {
      Date.now = realNow;
    }

    assert.ok(readFileSync(join(dir, "proj.csv"), "utf8").includes(`${KEY},3.0`), "2 min from the row plus 2 × 30 s should be 3.0");
  }));

  test("should write no row when no assistant message exists", () => withLedger(async (dir) => {
    const h = harness({ entries: [user("hi")] });
    await h.start();

    await h.run();

    assert.equal(existsSync(join(dir, "proj.csv")), false, "no CSV should exist");
  }));

  test("should create the dir 0700 and files 0600 when they are new", { skip: process.platform === "win32" }, () => withLedger(async (dir) => {
    const h = harness();
    await h.start();

    await h.run();

    assert.equal(statSync(dir).mode & 0o777, 0o700, "dir should be 0700");
    assert.equal(statSync(join(dir, "proj.csv")).mode & 0o777, 0o600, "csv should be 0600");
    assert.equal(statSync(join(dir, "board.html")).mode & 0o777, 0o600, "board should be 0600");
  }));

  test("should keep an existing file's mode when it rewrites the file", { skip: process.platform === "win32" }, () => withLedger(async (dir) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proj.csv"), "");
    chmodSync(join(dir, "proj.csv"), 0o644);
    const h = harness();
    await h.start();

    await h.run();

    assert.equal(statSync(join(dir, "proj.csv")).mode & 0o777, 0o644, "existing file should keep 0644");
  }));

  test("should warn once per session and not throw when the write fails", () => withLedger(async (dir) => {
    mkdirSync(join(dir, "proj.csv"), { recursive: true });
    const h = harness();
    const warnings = () => h.notes.filter((n) => n.level === "warning").length;
    await h.start();

    await h.run();
    await h.run();
    const firstSession = warnings();
    await h.start();
    await h.run();

    assert.equal(firstSession, 1, "one warning in the first session");
    assert.equal(warnings(), 2, "a new session should warn again");
  }));
});

describe("/ponytail-board", () => {
  test("should rebuild the page and run the platform's opener when no CSV exists", () => withLedger(async (dir) => {
    const h = harness({ exec: () => ({ code: 0 }) });
    const file = join(dir, "board.html");
    const [cmd, args] = opener(process.platform, file);

    await h.commands.get("ponytail-board").handler("", h.ctx);

    assert.equal(readFileSync(file, "utf8"), "<board></board>", "page should be rebuilt");
    assert.deepEqual(h.execs.at(-1), [cmd, ...args], "opener should run with the file");
    assert.equal(h.notes.length, 0, "success should not notify");
  }));

  test("should notify the file path when the opener exits non-zero", () => withLedger(async (dir) => {
    const h = harness({ exec: () => ({ code: 3 }) });

    await h.commands.get("ponytail-board").handler("", h.ctx);

    assert.ok(h.notes.at(-1)?.text.includes(join(dir, "board.html")), "notification should carry the path");
  }));

  test("should notify the file path when the opener throws", () => withLedger(async (dir) => {
    const h = harness({ exec: () => { throw new Error("ENOENT"); } });

    await h.commands.get("ponytail-board").handler("", h.ctx);

    assert.ok(h.notes.at(-1)?.text.includes(join(dir, "board.html")), "notification should carry the path");
  }));
});
