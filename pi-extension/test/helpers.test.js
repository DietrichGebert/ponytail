import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  filterSkillBodyForMode,
  parseGraybeardCommand,
  readDefaultMode,
  resolveSessionMode,
  writeDefaultMode,
} from "../index.js";

test("parseGraybeardCommand falls back to balanced when invoked bare and default is off", () => {
  assert.deepEqual(parseGraybeardCommand("", "off"), { type: "set-mode", mode: "balanced" });
});

test("parseGraybeardCommand parses modes, status, and default subcommand", () => {
  assert.deepEqual(parseGraybeardCommand("strict", "balanced"), { type: "set-mode", mode: "strict" });
  assert.deepEqual(parseGraybeardCommand("status", "balanced"), { type: "status" });
  assert.deepEqual(parseGraybeardCommand("default advisory", "balanced"), { type: "set-default", mode: "advisory" });
});

test("resolveSessionMode prefers latest persisted session mode", () => {
  const entries = [
    { type: "custom", customType: "graybeard-mode", data: { mode: "advisory" } },
    { type: "custom", customType: "graybeard-mode", data: { mode: "strict" } },
  ];

  assert.equal(resolveSessionMode(entries, "balanced"), "strict");
});

test("resolveSessionMode returns fallback when entries is not an array", () => {
  assert.equal(resolveSessionMode(null, "strict"), "strict");
  assert.equal(resolveSessionMode(undefined, "advisory"), "advisory");
  assert.equal(resolveSessionMode({}, "balanced"), "balanced");
  assert.equal(resolveSessionMode("not an array"), "balanced"); // DEFAULT_MODE fallback
});

test("readDefaultMode and writeDefaultMode use XDG config path", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "graybeard-config-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousDefault = process.env.GRAYBEARD_DEFAULT_MODE;
  const configPath = join(tempDir, "graybeard", "config.json");
  process.env.XDG_CONFIG_HOME = tempDir;
  delete process.env.GRAYBEARD_DEFAULT_MODE;

  try {
    assert.equal(readDefaultMode(), "balanced");
    assert.equal(writeDefaultMode("strict"), "strict");
    assert.equal(readDefaultMode(), "strict");
    assert.ok(existsSync(configPath));
    assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), { defaultMode: "strict" });
  } finally {
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    if (previousDefault === undefined) delete process.env.GRAYBEARD_DEFAULT_MODE;
    else process.env.GRAYBEARD_DEFAULT_MODE = previousDefault;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("filterSkillBodyForMode keeps only requested mode rows", () => {
  const body = `---\nname: graybeard\n---\n| **advisory** | keep advisory |\n| **balanced** | keep balanced |\n| **strict** | keep strict |\n- advisory: Advisory example\n- balanced: Balanced example\n- strict: Strict example\nOther line`;

  const filtered = filterSkillBodyForMode(body, "strict");

  assert.ok(!filtered.includes("keep advisory"));
  assert.ok(!filtered.includes("keep balanced"));
  assert.ok(filtered.includes("keep strict"));
  assert.ok(!filtered.includes("Advisory example"));
  assert.ok(filtered.includes("Strict example"));
  assert.ok(filtered.includes("Other line"));
});

test("filterSkillBodyForMode keeps normal rule bullets that contain a colon", () => {
  const skillPath = new URL("../../skills/graybeard/SKILL.md", import.meta.url);
  const body = readFileSync(skillPath, "utf8");

  const filtered = filterSkillBodyForMode(body, "balanced");

  assert.ok(filtered.includes("Ground every recommendation"));
  assert.ok(filtered.includes("Never weaken input validation"));
  assert.ok(filtered.includes("balanced"));
  assert.ok(!filtered.includes("Suggest the stack-native approach"));
  assert.ok(!filtered.includes("Challenge weak requirements"));
});
