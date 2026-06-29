import assert from "node:assert/strict";
import test from "node:test";

import { MODES, resolveMode, buildInstructions } from "../instructions.js";

test.beforeEach(() => {
  delete process.env.PONYTAIL_DEFAULT_MODE;
});

test("resolveMode keeps valid intensities", () => {
  for (const mode of MODES) assert.equal(resolveMode(mode), mode);
});

test("resolveMode falls back to a runtime intensity for off/unknown/empty", () => {
  // PONYTAIL_DEFAULT_MODE could be anything in CI, so just assert the contract:
  // never returns "off", "review", or junk — always one of the served modes.
  for (const input of ["off", "review", "nonsense", "", undefined, null]) {
    assert.ok(MODES.includes(resolveMode(input)), `resolveMode(${input}) must be a served mode`);
  }
});

test("resolveMode uses the configured default when no served mode is requested", () => {
  process.env.PONYTAIL_DEFAULT_MODE = "lite";
  assert.equal(resolveMode(undefined), "lite");
  assert.equal(resolveMode("off"), "lite");

  process.env.PONYTAIL_DEFAULT_MODE = "off";
  assert.equal(resolveMode(undefined), "full");
});

test("buildInstructions returns the ruleset tagged with the resolved mode", () => {
  const text = buildInstructions("ultra");
  assert.match(text, /PONYTAIL MODE ACTIVE/);
  assert.match(text, /ultra/);
});

test("buildInstructions serves the shared Ponytail rules, not a stub", () => {
  const text = buildInstructions("lite");
  assert.match(text, /lazy senior developer/i);
  assert.match(text, /input validation at trust boundaries/);
  assert.match(text, /ONE runnable check/);
});
