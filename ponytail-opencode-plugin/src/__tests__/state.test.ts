import { describe, test, expect } from "bun:test";
import { getMode, setMode } from "../state";

describe("state", () => {
  test("getMode returns off for new session", () => {
    expect(getMode("new-session")).toBe("off");
  });

  test("setMode updates mode for session", () => {
    setMode("test-session", "ultra");
    expect(getMode("test-session")).toBe("ultra");
  });

  test("different sessions have independent state", () => {
    setMode("session-a", "lite");
    setMode("session-b", "ultra");
    expect(getMode("session-a")).toBe("lite");
    expect(getMode("session-b")).toBe("ultra");
  });
});
