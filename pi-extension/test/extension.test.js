import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import ponytailExtension from "../index.js";

function createPiHarness() {
  const events = new Map();
  const commands = new Map();
  const appendedEntries = [];
  const sentUserMessages = [];

  const pi = {
    on(eventName, handler) {
      events.set(eventName, handler);
    },
    registerCommand(name, options) {
      commands.set(name, options);
    },
    appendEntry(customType, data) {
      appendedEntries.push({ customType, data });
    },
    sendUserMessage(text, options) {
      sentUserMessages.push({ text, options });
    },
  };

  ponytailExtension(pi);
  return { events, commands, appendedEntries, sentUserMessages };
}

function createCommandContext(overrides = {}) {
  return {
    isIdle: () => true,
    sessionManager: { getEntries: () => [] },
    ui: { notify() {} },
    ...overrides,
  };
}

function withTempConfig(fn) {
  const tempConfigHome = mkdtempSync(join(tmpdir(), "ponytail-test-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousHide = process.env.PONYTAIL_HIDE_STATUS;
  process.env.XDG_CONFIG_HOME = tempConfigHome;
  delete process.env.PONYTAIL_HIDE_STATUS;

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousXdg;
      if (previousHide === undefined) delete process.env.PONYTAIL_HIDE_STATUS;
      else process.env.PONYTAIL_HIDE_STATUS = previousHide;
      rmSync(tempConfigHome, { recursive: true, force: true });
    });
}

test("extension registers Ponytail commands", () => {
  const { commands } = createPiHarness();

  assert.deepEqual([...commands.keys()].sort(), ["ponytail", "ponytail-audit", "ponytail-debt", "ponytail-gain", "ponytail-help", "ponytail-review"]);
});

test("/ponytail updates session mode and injects instructions", async () => withTempConfig(async () => {
  const { commands, events, appendedEntries } = createPiHarness();
  const ctx = createCommandContext();

  await events.get("session_start")({ reason: "startup" }, ctx);
  await commands.get("ponytail").handler("ultra", ctx);

  assert.deepEqual(appendedEntries.at(-1), {
    customType: "ponytail-mode",
    data: { mode: "ultra" },
  });

  const result = await events.get("before_agent_start")({ systemPrompt: "BASE" }, ctx);
  assert.ok(result.systemPrompt.includes("PONYTAIL MODE ACTIVE"));
  assert.ok(result.systemPrompt.includes("ultra"));
}));

test("before_agent_start guards missing event and missing systemPrompt (#439, #440)", async () => withTempConfig(async () => {
  const { events } = createPiHarness();
  const ctx = createCommandContext();
  await events.get("session_start")({ reason: "startup" }, ctx); // currentMode -> default (full)

  // #439: a null/undefined event must not crash, and still injects the ruleset.
  for (const bad of [undefined, null]) {
    const r = await events.get("before_agent_start")(bad, ctx);
    assert.ok(r.systemPrompt.includes("PONYTAIL MODE ACTIVE"));
    assert.ok(!r.systemPrompt.includes("undefined"), "must not contain the literal 'undefined'");
  }

  // #440: an event without a systemPrompt must not prepend the literal "undefined".
  const empty = await events.get("before_agent_start")({}, ctx);
  assert.ok(empty.systemPrompt.includes("PONYTAIL MODE ACTIVE"));
  assert.ok(!empty.systemPrompt.startsWith("undefined"), "must not start with 'undefined'");

  // A real base prompt is still preserved and prepended.
  const withBase = await events.get("before_agent_start")({ systemPrompt: "BASE" }, ctx);
  assert.ok(withBase.systemPrompt.startsWith("BASE\n\n"));
  assert.ok(withBase.systemPrompt.includes("PONYTAIL MODE ACTIVE"));
}));

test("session_start restores latest persisted mode", async () => withTempConfig(async () => {
  const { events } = createPiHarness();
  const ctx = createCommandContext({
    sessionManager: {
      getEntries: () => [
        { type: "custom", customType: "ponytail-mode", data: { mode: "lite" } },
      ],
    },
  });

  await events.get("session_start")({ reason: "resume" }, ctx);
  const result = await events.get("before_agent_start")({ systemPrompt: "BASE" }, ctx);

  assert.ok(result.systemPrompt.includes("lite"));
}));

test("skill alias commands delegate to Pi skill commands", async () => {
  const { commands, sentUserMessages } = createPiHarness();
  const ctx = createCommandContext();

  await commands.get("ponytail-review").handler("", ctx);
  await commands.get("ponytail-audit").handler("", ctx);
  await commands.get("ponytail-debt").handler("", ctx);
  await commands.get("ponytail-gain").handler("", ctx);
  await commands.get("ponytail-help").handler("", ctx);

  assert.deepEqual(sentUserMessages.map((entry) => entry.text), [
    "/skill:ponytail-review",
    "/skill:ponytail-audit",
    "/skill:ponytail-debt",
    "/skill:ponytail-gain",
    "/skill:ponytail-help",
  ]);
});

test("normal mode disables persistent instructions", async () => withTempConfig(async () => {
  const { commands, events } = createPiHarness();
  const ctx = createCommandContext();

  await events.get("session_start")({ reason: "startup" }, ctx);
  await commands.get("ponytail").handler("ultra", ctx);
  await events.get("input")({ text: "normal mode", source: "interactive" }, ctx);

  const disabled = await events.get("before_agent_start")({ systemPrompt: "BASE" }, ctx);
  assert.equal(disabled, undefined);
}));

test("a request mentioning normal mode stays active", async () => withTempConfig(async () => {
  const { commands, events } = createPiHarness();
  const ctx = createCommandContext();

  await events.get("session_start")({ reason: "startup" }, ctx);
  await commands.get("ponytail").handler("ultra", ctx);
  await events.get("input")({ text: "add a normal mode toggle next to dark mode", source: "interactive" }, ctx);

  const result = await events.get("before_agent_start")({ systemPrompt: "BASE" }, ctx);
  assert.match(result.systemPrompt, /PONYTAIL MODE ACTIVE/);
}));

test("status bar renders the mode and flips active on agent_start", async () => withTempConfig(async () => {
  const { events } = createPiHarness();
  const statusWrites = [];
  const ctx = createCommandContext({
    sessionManager: { getEntries: () => [{ type: "custom", customType: "ponytail-mode", data: { mode: "ultra" } }] },
    ui: { notify() {}, setStatus: (key, text) => statusWrites.push({ key, text }), theme: { fg: (_color, text) => text } },
  });

  await events.get("session_start")({ reason: "resume" }, ctx);
  await events.get("agent_start")({}, ctx);

  assert.equal(statusWrites.at(-2).key, "ponytail");
  assert.match(statusWrites.at(-2).text, /○.*ULTRA/);
  assert.match(statusWrites.at(-1).text, /●.*ULTRA/);
}));

test("status bar stays silent when ui lacks a theme", async () => withTempConfig(async () => {
  const { events } = createPiHarness();
  const calls = [];
  const ctx = createCommandContext({
    sessionManager: { getEntries: () => [{ type: "custom", customType: "ponytail-mode", data: { mode: "ultra" } }] },
    ui: { notify() {}, setStatus: (_key, text) => calls.push(text) }, // setStatus present, theme absent
  });

  await events.get("session_start")({ reason: "resume" }, ctx);
  await events.get("agent_start")({}, ctx);

  assert.deepEqual(calls, []);
}));

test("PONYTAIL_HIDE_STATUS hides the indicator but keeps ponytail active (#324)", async () => withTempConfig(async () => {
  process.env.PONYTAIL_HIDE_STATUS = "1";
  const { events } = createPiHarness();
  const statusWrites = [];
  const ctx = createCommandContext({
    sessionManager: { getEntries: () => [{ type: "custom", customType: "ponytail-mode", data: { mode: "ultra" } }] },
    ui: { notify() {}, setStatus: (key, text) => statusWrites.push({ key, text }), theme: { fg: (_c, t) => t } },
  });

  await events.get("session_start")({ reason: "resume" }, ctx);
  await events.get("agent_start")({}, ctx);
  const injected = await events.get("before_agent_start")({ systemPrompt: "BASE" }, ctx);

  assert.deepEqual(statusWrites, [], "status bar must not be drawn when hidden");
  assert.match(injected.systemPrompt, /PONYTAIL MODE ACTIVE/, "ruleset must still inject while status is hidden");
}));

test("config.hideStatus hides the indicator but keeps ponytail active (#324)", async () => withTempConfig(async () => {
  mkdirSync(join(process.env.XDG_CONFIG_HOME, "ponytail"), { recursive: true });
  writeFileSync(join(process.env.XDG_CONFIG_HOME, "ponytail", "config.json"), JSON.stringify({ hideStatus: true }));
  const { events } = createPiHarness();
  const statusWrites = [];
  const ctx = createCommandContext({
    ui: { notify() {}, setStatus: (key, text) => statusWrites.push({ key, text }), theme: { fg: (_c, t) => t } },
  });

  await events.get("session_start")({ reason: "startup" }, ctx);
  await events.get("agent_start")({}, ctx);
  const injected = await events.get("before_agent_start")({ systemPrompt: "BASE" }, ctx);

  assert.deepEqual(statusWrites, [], "config.hideStatus must suppress the status bar");
  assert.match(injected.systemPrompt, /PONYTAIL MODE ACTIVE/, "ruleset must still inject while status is hidden");
}));

test("PONYTAIL_HIDE_STATUS=0 does not hide the indicator", async () => withTempConfig(async () => {
  process.env.PONYTAIL_HIDE_STATUS = "0";
  const { events } = createPiHarness();
  const statusWrites = [];
  const ctx = createCommandContext({
    sessionManager: { getEntries: () => [{ type: "custom", customType: "ponytail-mode", data: { mode: "ultra" } }] },
    ui: { notify() {}, setStatus: (key, text) => statusWrites.push({ key, text }), theme: { fg: (_c, t) => t } },
  });

  await events.get("session_start")({ reason: "resume" }, ctx);
  await events.get("agent_start")({}, ctx);

  assert.ok(statusWrites.length > 0, "0 must be treated as 'do not hide'");
}));
