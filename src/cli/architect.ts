import path from "node:path";
import type { Command } from "commander";
import { Workspace } from "../workspace/manager.js";
import { ArchitectOrchestrator } from "../architect/orchestrator.js";

const say = (value: string): void => process.stdout.write(value + "\n");

function workspacePath(value?: string): string {
  return path.resolve(value ?? process.cwd());
}

function printError(error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  if (json) say(JSON.stringify({ ok: false, error: message }));
  else say(`✗ ${message}`);
  process.exitCode = 1;
}

export function registerArchitectCommands(program: Command): void {
  const architect = program
    .command("architect")
    .description("Phase 1 Kimi K3 read-only Architect / Reviewer");

  architect
    .command("plan")
    .description("Ask Kimi K3 to inspect the repository and produce a structured implementation PLAN")
    .requiredOption("--goal <text>", "development goal")
    .option("--task <id>", "optional task id; generated automatically when omitted")
    .option("-w, --workspace <path>", "workspace root (defaults to current directory)")
    .option("--json", "machine-readable output", false)
    .action(async (opts: { goal: string; task?: string; workspace?: string; json: boolean }) => {
      try {
        const ws = new Workspace(workspacePath(opts.workspace));
        const orchestrator = new ArchitectOrchestrator(ws);
        const plan = await orchestrator.plan(opts.goal, opts.task);
        if (opts.json) say(JSON.stringify({ ok: true, plan }));
        else say(JSON.stringify(plan, null, 2));
      } catch (error) {
        printError(error, opts.json);
      }
    });

  architect
    .command("review")
    .description("Ask Kimi K3 to review Codex's current diff against a recorded PLAN")
    .requiredOption("--task <id>", "task id returned by architect plan")
    .option("-w, --workspace <path>", "workspace root (defaults to current directory)")
    .option("--json", "machine-readable output", false)
    .action(async (opts: { task: string; workspace?: string; json: boolean }) => {
      try {
        const ws = new Workspace(workspacePath(opts.workspace));
        const orchestrator = new ArchitectOrchestrator(ws);
        const review = await orchestrator.review(opts.task);
        if (opts.json) say(JSON.stringify({ ok: true, review }));
        else say(JSON.stringify(review, null, 2));
      } catch (error) {
        printError(error, opts.json);
      }
    });
}
