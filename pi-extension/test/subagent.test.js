import assert from "node:assert/strict";
import test from "node:test";

import ponytailExtension, { childMode, subagentName } from "../index.js";

const argv = (name) => ["node", "pi", "--system-prompt", `/tmp/x/prompt-${name}.md`];

test("subagentName parses pi-code's prompt file name", () => {
  assert.equal(subagentName(argv("swarm-worker")), "swarm-worker");
  assert.equal(subagentName(["node", "pi"]), null);
  assert.equal(subagentName(["--system-prompt", "/tmp/other.md"]), null);
});

test("childMode inherits the parent mode and applies the matcher", () => {
  const base = { argv: argv("swarm-worker"), fallback: "full" };
  assert.equal(childMode({ ...base }), "full");
  assert.equal(childMode({ ...base, parentMode: "ultra" }), "ultra");
  assert.equal(childMode({ ...base, parentMode: "off", matcher: "swarm" }), "off");
  assert.equal(childMode({ ...base, parentMode: "lite", matcher: "SWARM" }), "lite");
  assert.equal(childMode({ ...base, matcher: "^explore$" }), "off");
});

test("childMode fails open on bad regex, unknown agent or a matcher that times out", () => {
  assert.equal(childMode({ argv: argv("a"), fallback: "full", matcher: "(" }), "full");
  assert.equal(childMode({ argv: ["node"], fallback: "full", matcher: "zzz" }), "full");
  // Catastrophic backtracking (#658): the 100 ms vm timeout aborts the match and the mode is kept.
  assert.equal(childMode({ argv: argv(`${"a".repeat(40)}!`), fallback: "full", matcher: "^(a+)+$" }), "full");
});

test("a child session_start follows the parent mode and does not persist it", async () => {
  const saved = { ...process.env };
  const savedArgv = process.argv;
  const events = new Map();
  const appended = [];
  try {
    process.env.PI_CODE_SUBAGENT = "1";
    process.env.PONYTAIL_PARENT_MODE = "lite";
    process.env.PONYTAIL_SUBAGENT_MATCHER = "^other$";
    process.argv = argv("swarm-worker");
    ponytailExtension({
      on: (n, h) => events.set(n, h),
      registerCommand() {},
      appendEntry: (...a) => appended.push(a),
      sendUserMessage() {},
    });
    await events.get("session_start")({}, { sessionManager: { getEntries: () => [] }, ui: { notify() {} } });
    const ev = { systemPrompt: "base", systemPromptOptions: { sections: {} } };
    await events.get("before_agent_start")(ev);
    assert.equal(ev.systemPromptOptions.sections.ponytail, undefined);
    assert.equal(process.env.PONYTAIL_PARENT_MODE, "off");
    assert.deepEqual(appended, []);
  } finally {
    process.argv = savedArgv;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
