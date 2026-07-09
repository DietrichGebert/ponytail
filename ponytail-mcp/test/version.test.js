import assert from "node:assert/strict";
import test from "node:test";

import { getVersion } from "../version.js";

test("getVersion reads the version from ponytail-mcp/package.json, not a hardcoded string", () => {
  assert.equal(getVersion(), "4.8.4");
});
