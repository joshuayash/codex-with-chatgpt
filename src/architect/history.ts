import fs from "node:fs";
import path from "node:path";
import { ensureDir, getStateDir } from "../config/paths.js";
import type { ArchitectPlan, ArchitectReview } from "./protocol.js";
import type { ProviderUsage } from "../providers/provider.js";

export interface ArchitectRunMeta {
  provider: string;
  toolCalls: number;
  usage?: ProviderUsage;
  timestamp: string;
}

function taskDir(workspaceId: string, taskId: string): string {
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return ensureDir(path.join(getStateDir(), "architect-runs", workspaceId, safeTaskId));
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

export function recordPlan(
  workspaceId: string,
  goal: string,
  plan: ArchitectPlan,
  meta: ArchitectRunMeta
): void {
  const dir = taskDir(workspaceId, plan.taskId);
  writeJson(path.join(dir, "task.json"), { taskId: plan.taskId, goal, createdAt: meta.timestamp });
  writeJson(path.join(dir, "plan.json"), plan);
  writeJson(path.join(dir, "plan-meta.json"), meta);
}

export function recordReview(
  workspaceId: string,
  review: ArchitectReview,
  meta: ArchitectRunMeta
): string {
  const dir = taskDir(workspaceId, review.taskId);
  let iteration = 1;
  while (fs.existsSync(path.join(dir, `review-${iteration}.json`))) iteration++;
  writeJson(path.join(dir, `review-${iteration}.json`), review);
  writeJson(path.join(dir, `review-${iteration}-meta.json`), meta);
  return path.join(dir, `review-${iteration}.json`);
}

export function readPlan(workspaceId: string, taskId: string): ArchitectPlan | null {
  const file = path.join(taskDir(workspaceId, taskId), "plan.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as ArchitectPlan;
}
