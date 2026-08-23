import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  filterSkillBodyForMode,
  parsePonytailCommand,
  readDefaultMode,
  readQuietStartup,
  resolveSessionMode,
  writeDefaultMode,
} from "../index.js";

test("parsePonytailCommand falls back to full when invoked bare and default is off", () => {
  assert.deepEqual(parsePonytailCommand("", "off"), { type: "set-mode", mode: "full" });
});

test("parsePonytailCommand parses modes, status, and default subcommand", () => {
  assert.deepEqual(parsePonytailCommand("ultra", "full"), { type: "set-mode", mode: "ultra" });
  assert.deepEqual(parsePonytailCommand("status", "full"), { type: "status" });
  assert.deepEqual(parsePonytailCommand("default lite", "full"), { type: "set-default", mode: "lite" });
});

test("parsePonytailCommand rejects review as a default (session-only mode, #377)", () => {
  assert.deepEqual(parsePonytailCommand("default review", "full"), { type: "invalid", reason: "invalid-default-mode" });
});

test("resolveSessionMode still honors review as a session mode (not a default)", () => {
  const entries = [{ type: "custom", customType: "ponytail-mode", data: { mode: "review" } }];
  assert.equal(resolveSessionMode(entries, "full"), "review");
});

test("resolveSessionMode prefers latest persisted session mode", () => {
  const entries = [
    { type: "custom", customType: "ponytail-mode", data: { mode: "lite" } },
    { type: "custom", customType: "ponytail-mode", data: { mode: "ultra" } },
  ];

  assert.equal(resolveSessionMode(entries, "full"), "ultra");
});

test("resolveSessionMode returns fallback when entries is not an array", () => {
  assert.equal(resolveSessionMode(null, "ultra"), "ultra");
  assert.equal(resolveSessionMode(undefined, "lite"), "lite");
  assert.equal(resolveSessionMode({}, "full"), "full");
  assert.equal(resolveSessionMode("not an array"), "full"); // DEFAULT_MODE fallback
});

test("readDefaultMode and writeDefaultMode use XDG config path", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ponytail-config-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousDefault = process.env.PONYTAIL_DEFAULT_MODE;
  const configPath = join(tempDir, "ponytail", "config.json");
  process.env.XDG_CONFIG_HOME = tempDir;
  delete process.env.PONYTAIL_DEFAULT_MODE;

  try {
    assert.equal(readDefaultMode(), "full");
    assert.equal(writeDefaultMode("ultra"), "ultra");
    assert.equal(readDefaultMode(), "ultra");
    assert.ok(existsSync(configPath));
    assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), { defaultMode: "ultra" });
  } finally {
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    if (previousDefault === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
    else process.env.PONYTAIL_DEFAULT_MODE = previousDefault;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("readQuietStartup resolves env var, config file, and default in that order", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ponytail-quiet-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousEnv = process.env.PONYTAIL_QUIET_STARTUP;
  const configDir = join(tempDir, "ponytail");
  const configPath = join(configDir, "config.json");
  process.env.XDG_CONFIG_HOME = tempDir;
  delete process.env.PONYTAIL_QUIET_STARTUP;

  try {
    // No env, no config -> default false (toast still shows)
    assert.equal(readQuietStartup(), false);

    // Config file true -> respected
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ quietStartup: true }), "utf8");
    assert.equal(readQuietStartup(), true);

    // Env var overrides config
    process.env.PONYTAIL_QUIET_STARTUP = "false";
    assert.equal(readQuietStartup(), false);
    process.env.PONYTAIL_QUIET_STARTUP = "1";
    assert.equal(readQuietStartup(), true);
  } finally {
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    if (previousEnv === undefined) delete process.env.PONYTAIL_QUIET_STARTUP;
    else process.env.PONYTAIL_QUIET_STARTUP = previousEnv;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("filterSkillBodyForMode keeps only requested intensity examples and rows", () => {
  // Examples are quoted in the real SKILL.md (`- lite: "..."`) — match that
  // shape here too; see the next test for why the quote is load-bearing.
  const body = `---\nname: ponytail\n---\n| **lite** | keep lite |\n| **full** | keep full |\n| **ultra** | keep ultra |\n- lite: "Lite example"\n- full: "Full example"\n- ultra: "Ultra example"\nOther line`;

  const filtered = filterSkillBodyForMode(body, "ultra");

  assert.ok(!filtered.includes("keep lite"));
  assert.ok(!filtered.includes("keep full"));
  assert.ok(filtered.includes("keep ultra"));
  assert.ok(!filtered.includes("Lite example"));
  assert.ok(filtered.includes("Ultra example"));
  assert.ok(filtered.includes("Other line"));
});

test("filterSkillBodyForMode does not drop a rule bullet whose label matches a mode name", () => {
  // A rule bullet like "- Full: ..." has the same "label: text" shape as a
  // worked example, but isn't one — it must survive in every mode. Only the
  // quoted, `- lite: "..."`-style bullets are real per-mode examples.
  const body = `- Full: do not confuse this rule label with the mode name.\n- Lite: same risk, this is a real rule bullet.\n- lite: "real worked example"\n- ultra: "real worked example"`;

  const filtered = filterSkillBodyForMode(body, "ultra");

  assert.ok(filtered.includes("Full: do not confuse"), "an unquoted rule bullet must not be treated as a mode example");
  assert.ok(filtered.includes("Lite: same risk"), "an unquoted rule bullet must not be treated as a mode example");
  assert.ok(!filtered.includes("- lite:"), "the real quoted lite example must still be filtered out in ultra mode");
  assert.ok(filtered.includes('ultra: "real worked example"'));
});

test("filterSkillBodyForMode keeps rule bullets that contain a colon", () => {
  // Regression: rule bullets outside the Intensity section (e.g. the
  // "No unrequested abstractions:" rule or the `ponytail:` comment convention)
  // contain a colon and must not be mistaken for mode-example lines.
  const skillPath = new URL("../../skills/ponytail/SKILL.md", import.meta.url);
  const body = readFileSync(skillPath, "utf8");

  const filtered = filterSkillBodyForMode(body, "full");

  assert.ok(filtered.includes("No unrequested abstractions"));
  assert.ok(filtered.includes("Mark deliberate simplifications that cut a real corner"));
  assert.ok(filtered.includes("`ponytail:` comment naming the ceiling and upgrade path"));
  // The Intensity examples are still filtered down to the active mode.
  assert.ok(filtered.includes('full: "`@lru_cache'));
  assert.ok(!filtered.includes('lite: "Done'));
  assert.ok(!filtered.includes('ultra: "No cache'));
});
