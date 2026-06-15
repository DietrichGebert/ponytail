import { describe, test, expect } from "bun:test";
import { loadConfig, isValidMode, isRuntimeMode } from "../config";

describe("config", () => {
  test("loadConfig returns defaults when no config file", () => {
    const cfg = loadConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.defaultMode).toBe("full");
    expect(cfg.features.ponytail).toBe(true);
  });

  test("isValidMode accepts valid modes", () => {
    expect(isValidMode("off")).toBe(true);
    expect(isValidMode("lite")).toBe(true);
    expect(isValidMode("full")).toBe(true);
    expect(isValidMode("ultra")).toBe(true);
    expect(isValidMode("review")).toBe(true);
  });

  test("isValidMode rejects invalid modes", () => {
    expect(isValidMode("invalid")).toBe(false);
    expect(isValidMode("")).toBe(false);
  });

  test("isRuntimeMode excludes review", () => {
    expect(isRuntimeMode("full")).toBe(true);
    expect(isRuntimeMode("review")).toBe(false);
  });
});
