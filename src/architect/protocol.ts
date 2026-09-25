import { z } from "zod";

export const planChangeSchema = z.object({
  path: z.string().min(1),
  action: z.enum(["create", "modify", "delete"]),
  intent: z.string().min(1),
  reason: z.string().min(1),
});

export const planSchema = z.object({
  type: z.literal("PLAN"),
  taskId: z.string().min(1),
  summary: z.string().min(1),
  scope: z.array(z.string()).default([]),
  changes: z.array(planChangeSchema),
  risks: z.array(z.string()).default([]),
  tests: z.array(z.string()).default([]),
});

export type ArchitectPlan = z.infer<typeof planSchema>;

export const reviewIssueSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  path: z.string().optional(),
  problem: z.string().min(1),
  reason: z.string().min(1),
  suggestion: z.string().min(1),
});

export const reviewSchema = z.object({
  type: z.literal("REVIEW"),
  taskId: z.string().min(1),
  decision: z.enum(["APPROVED", "CHANGES_REQUIRED"]),
  summary: z.string().min(1),
  issues: z.array(reviewIssueSchema).default([]),
  tests: z.array(z.string()).default([]),
});

export type ArchitectReview = z.infer<typeof reviewSchema>;

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("Architect returned no valid JSON object");
  }
}
