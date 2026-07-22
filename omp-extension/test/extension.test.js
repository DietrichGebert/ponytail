import assert from "node:assert/strict";
import test from "node:test";

import ompPonytailExtension from "../index.js";

test("OMP entrypoint labels the extension before loading Ponytail", () => {
  const commands = new Map();
  const labels = [];

  ompPonytailExtension({
    on() {},
    registerCommand(name, options) {
      commands.set(name, options);
    },
    appendEntry() {},
    sendUserMessage() {},
    setLabel(label) {
      labels.push(label);
    },
  });

  assert.deepEqual(labels, ["Ponytail"]);
  assert.ok(commands.has("ponytail"));
});

test("OMP entrypoint does not write Ponytail status to the footer", async () => {
  const events = new Map();
  const statusWrites = [];
  const ctx = {
    sessionManager: { getEntries: () => [] },
    ui: {
      notify() {},
      setStatus: (key, text) => statusWrites.push({ key, text }),
      theme: { fg: (_color, text) => text },
    },
  };

  ompPonytailExtension({
    on(event, handler) {
      events.set(event, handler);
    },
    registerCommand() {},
    appendEntry() {},
    sendUserMessage() {},
    setLabel() {},
  });

  await events.get("session_start")({}, ctx);
  await events.get("agent_start")({}, ctx);

  assert.deepEqual(statusWrites, []);
});
