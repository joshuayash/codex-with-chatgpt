export type ArchitectTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<unknown>;
};

export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ArchitectProviderResponse {
  content: string;
  usage?: ProviderUsage;
  toolCalls: number;
}

export interface ArchitectProvider {
  readonly name: string;
  complete(input: {
    system: string;
    user: string;
    tools: ArchitectTool[];
  }): Promise<ArchitectProviderResponse>;
}
