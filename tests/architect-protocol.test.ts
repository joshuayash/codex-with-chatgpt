import { describe, expect, it } from "vitest";
import { parseJsonObject, planSchema, reviewSchema } from "../src/architect/protocol.js";

describe("architect protocol", () => {
  it("parses a valid plan", () => {
    const value = planSchema.parse({
      type: "PLAN",
      taskId: "c2c_1234",
      summary: "Do the thing",
      scope: ["src"],
      changes: [
        { path: "src/a.ts", action: "modify", intent: "change A", reason: "needed" },
      ],
      risks: [],
      tests: ["unit tests"],
    });
    expect(value.taskId).toBe("c2c_1234");
  });

  it("parses fenced json defensively", () => {
    expect(parseJsonObject('\\`\\`\\`json\n{"type":"x"}\n\\`\\`\\`')).toEqual({ type: "x" });
  });

  it("rejects an invalid review decision", () => {
    expect(() =>
      reviewSchema.parse({
        type: "REVIEW",
        taskId: "x",
        decision: "MAYBE",
        summary: "x",
        issues: [],
        tests: [],
      })
    ).toThrow();
  });
});
