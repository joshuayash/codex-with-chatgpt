import { Workspace } from "../workspace/manager.js";
import { gitDiff, gitStatus } from "../workspace/git.js";
import { searchWorkspace } from "../workspace/search.js";
import { readExecutionRecords, latestExecutionRecord } from "../execution/records.js";
import type { ArchitectTool } from "../providers/provider.js";

const stringArg = (args: Record<string, unknown>, key: string, fallback = ""): string =>
  typeof args[key] === "string" ? (args[key] as string) : fallback;

const numberArg = (args: Record<string, unknown>, key: string, fallback: number): number =>
  typeof args[key] === "number" && Number.isFinite(args[key]) ? (args[key] as number) : fallback;

export function createArchitectTools(workspace: Workspace): ArchitectTool[] {
  return [
    {
      name: "repo_tree",
      description: "List the repository tree. Use this to understand project structure before planning.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repository-relative directory, default ." },
          depth: { type: "number", description: "Traversal depth, 1-4" },
          limit: { type: "number", description: "Maximum entries, up to 1000" },
        },
      },
      execute: async (args) =>
        workspace.listDirectory(stringArg(args, "path", "."), {
          depth: numberArg(args, "depth", 3),
          limit: numberArg(args, "limit", 400),
        }),
    },
    {
      name: "search_code",
      description: "Search text or regex across repository files. Prefer this before guessing file paths.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          path: { type: "string" },
          glob: { type: "string" },
          regex: { type: "boolean" },
          limit: { type: "number" },
        },
      },
      execute: async (args) =>
        searchWorkspace(workspace, {
          query: stringArg(args, "query"),
          path: stringArg(args, "path", "."),
          glob: stringArg(args, "glob") || undefined,
          regex: args.regex === true,
          limit: numberArg(args, "limit", 50),
        }),
    },
    {
      name: "read_file",
      description: "Read a UTF-8 text file inside the repository. Sensitive/ignored files are blocked.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" },
          startLine: { type: "number" },
          endLine: { type: "number" },
        },
      },
      execute: async (args) =>
        workspace.readFile(stringArg(args, "path"), {
          startLine: numberArg(args, "startLine", 1),
          endLine: typeof args.endLine === "number" ? args.endLine : undefined,
        }),
    },
    {
      name: "find_references",
      description: "Find textual references to a symbol or identifier across the repository.",
      parameters: {
        type: "object",
        required: ["symbol"],
        properties: {
          symbol: { type: "string" },
          path: { type: "string" },
          limit: { type: "number" },
        },
      },
      execute: async (args) =>
        searchWorkspace(workspace, {
          query: stringArg(args, "symbol"),
          path: stringArg(args, "path", "."),
          limit: numberArg(args, "limit", 100),
        }),
    },
    {
      name: "git_status",
      description: "Read current git status for the workspace. This tool never mutates git.",
      parameters: { type: "object", properties: {} },
      execute: async () => gitStatus(workspace),
    },
    {
      name: "git_diff",
      description: "Read current git diff. Use mode=head to review all working-tree changes against HEAD.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["unstaged", "staged", "head"] },
          path: { type: "string" },
          offset: { type: "number" },
          maxBytes: { type: "number" },
        },
      },
      execute: async (args) =>
        gitDiff(
          workspace,
          {
            mode:
              args.mode === "staged" || args.mode === "head" || args.mode === "unstaged"
                ? args.mode
                : "head",
            path: stringArg(args, "path") || undefined,
            offset: numberArg(args, "offset", 0),
            maxBytes: numberArg(args, "maxBytes", 64 * 1024),
          },
          stringArg(args, "path") || undefined
        ),
    },
    {
      name: "test_status",
      description: "Read the latest execution/test record written by the Codex executor.",
      parameters: { type: "object", properties: {} },
      execute: async () => latestExecutionRecord(workspace.id),
    },
    {
      name: "execution_summary",
      description: "Read recent execution summaries written by the Codex executor.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
      execute: async (args) => readExecutionRecords(workspace.id, numberArg(args, "limit", 10)),
    },
  ];
}
