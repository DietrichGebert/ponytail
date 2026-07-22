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
