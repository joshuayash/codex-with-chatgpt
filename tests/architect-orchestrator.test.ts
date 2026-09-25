import { afterEach, describe, expect, it } from "vitest";
import { ArchitectOrchestrator } from "../src/architect/orchestrator.js";
import type { ArchitectProvider, ArchitectProviderResponse } from "../src/providers/provider.js";
import { Workspace } from "../src/workspace/manager.js";
import { cleanup, isolateStateDir, makeGitRepo, makeTmpDir } from "./helpers.js";

const dirs: string[] = [];

class FakeProvider implements ArchitectProvider {
  readonly name = "fake";
  calls = 0;

  async complete(input: {
    system: string;
    user: string;
    tools: Parameters<ArchitectProvider["complete"]>[0]["tools"];
  }): Promise<ArchitectProviderResponse> {
    this.calls++;
    expect(input.tools.length).toBeGreaterThan(0);
    if (this.calls === 1) {
      return {
        content: JSON.stringify({
          type: "PLAN",
          taskId: "task_1",
          summary: "Change the answer",
          scope: ["src"],
          changes: [
            {
              path: "src/index.ts",
              action: "modify",
              intent: "Update answer",
              reason: "Requested behavior",
            },
          ],
          risks: [],
          tests: ["run unit tests"],
        }),
        toolCalls: 2,
        usage: { totalTokens: 100 },
      };
    }
    return {
      content: JSON.stringify({
        type: "REVIEW",
        taskId: "task_1",
        decision: "APPROVED",
        summary: "Implementation matches the plan",
        issues: [],
        tests: ["unit tests passed"],
      }),
      toolCalls: 3,
      usage: { totalTokens: 120 },
    };
  }
}

afterEach(() => {
  while (dirs.length) cleanup(dirs.pop()!);
  delete process.env.C2C_STATE_DIR;
});

describe("ArchitectOrchestrator", () => {
  it("records a plan and can review the same task", async () => {
    const state = isolateStateDir();
    dirs.push(state);
    const root = makeTmpDir("architect-repo");
    dirs.push(root);
    makeGitRepo(root);

    const provider = new FakeProvider();
    const orchestrator = new ArchitectOrchestrator(new Workspace(root), provider);

    const plan = await orchestrator.plan("Update the answer", "task_1");
    expect(plan.type).toBe("PLAN");
    expect(plan.taskId).toBe("task_1");

    const review = await orchestrator.review("task_1");
    expect(review.type).toBe("REVIEW");
    expect(review.decision).toBe("APPROVED");
    expect(provider.calls).toBe(2);
  });
});
