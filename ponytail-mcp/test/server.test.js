import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

test("server version is read from ponytail-mcp/package.json", () => {
  assert.ok(
    serverSource.includes('new URL("./package.json", import.meta.url)'),
    "MCP server must use ponytail-mcp/package.json, not the repo root package.json",
  );
});
