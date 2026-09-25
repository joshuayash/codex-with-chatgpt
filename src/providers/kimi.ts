import type {
  ArchitectProvider,
  ArchitectProviderResponse,
  ArchitectTool,
  ProviderUsage,
} from "./provider.js";

type KimiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: KimiToolCall[];
};

type KimiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

interface KimiChoice {
  message: KimiMessage;
  finish_reason?: string | null;
}

interface KimiResponse {
  choices?: KimiChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

export interface KimiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  reasoningEffort: "low" | "high" | "max";
  maxToolCalls: number;
}

export function kimiConfigFromEnv(env = process.env): KimiConfig {
  const apiKey = env.KIMI_API_KEY?.trim();
  if (!apiKey) throw new Error("KIMI_API_KEY is required");
  const effort = (env.KIMI_REASONING_EFFORT ?? "high").trim().toLowerCase();
  if (!["low", "high", "max"].includes(effort)) {
    throw new Error("KIMI_REASONING_EFFORT must be low, high, or max");
  }
  return {
    apiKey,
    baseUrl: (env.KIMI_BASE_URL ?? "https://api.kimi.ai/coding/v1").replace(/\/$/, ""),
    model: env.KIMI_MODEL?.trim() || "k3-256k",
    reasoningEffort: effort as KimiConfig["reasoningEffort"],
    maxToolCalls: Math.max(1, Math.min(64, Number(env.KIMI_MAX_TOOL_CALLS ?? 24) || 24)),
  };
}

function toUsage(raw: KimiResponse["usage"]): ProviderUsage | undefined {
  if (!raw) return undefined;
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    totalTokens: raw.total_tokens,
  };
}

export class KimiArchitectProvider implements ArchitectProvider {
  readonly name = "kimi";
  constructor(private readonly config: KimiConfig = kimiConfigFromEnv()) {}

  async complete(input: {
    system: string;
    user: string;
    tools: ArchitectTool[];
  }): Promise<ArchitectProviderResponse> {
    const messages: KimiMessage[] = [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ];
    const toolMap = new Map(input.tools.map((tool) => [tool.name, tool]));
    let toolCalls = 0;
    let lastUsage: ProviderUsage | undefined;

    for (;;) {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "codex-with-chatgpt-phase1/0.1.3",
        },
        body: JSON.stringify({
          model: this.config.model,
          reasoning_effort: this.config.reasoningEffort,
          messages,
          tools: input.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
          tool_choice: "auto",
        }),
      });

      const raw = (await response.json()) as KimiResponse;
      if (!response.ok) {
        throw new Error(raw.error?.message ?? `Kimi API request failed with HTTP ${response.status}`);
      }
      lastUsage = toUsage(raw.usage) ?? lastUsage;
      const message = raw.choices?.[0]?.message;
      if (!message) throw new Error("Kimi API returned no assistant message");
      messages.push(message);

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        const content = typeof message.content === "string" ? message.content : "";
        if (!content.trim()) throw new Error("Kimi API returned an empty final response");
        return { content, usage: lastUsage, toolCalls };
      }

      for (const call of calls) {
        toolCalls++;
        if (toolCalls > this.config.maxToolCalls) {
          throw new Error(`Architect exceeded maximum tool calls (${this.config.maxToolCalls})`);
        }
        const tool = toolMap.get(call.function.name);
        if (!tool) throw new Error(`Architect requested unknown tool: ${call.function.name}`);
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await tool.execute(args);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : String(error) };
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
  }
}
