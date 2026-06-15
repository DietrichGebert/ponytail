import { describe, test, expect } from "bun:test";
import { handleMode } from "../commands/mode";
import { handleReview } from "../commands/review";

describe("commands", () => {
  test("handleMode with no args shows current mode", () => {
    const result = handleMode("cmd-session", "");
    expect(result.text).toContain("Mode:");
    expect(result.text).toContain("off");
  });

  test("handleMode sets valid mode", () => {
    const result = handleMode("cmd-session-2", "ultra");
    expect(result.text).toBe("Ponytail mode ultra.");
  });

  test("handleMode rejects invalid mode", () => {
    const result = handleMode("cmd-session-3", "invalid");
    expect(result.text).toContain("Bad mode");
  });

  test("handleMode off returns off message", () => {
    const result = handleMode("cmd-session-4", "off");
    expect(result.text).toBe("Ponytail mode off.");
  });

  test("handleReview returns review instructions", () => {
    const result = handleReview("review-session", "");
    expect(result.text).toContain("over-engineering");
  });
});
