import type { LLMProvider, ModelInfo, ChatMessage, ToolDefinition, StreamChunk } from './base.js';
import { debug } from '../core/debug.js';

const CONTEXT_LIMIT_TABLE: Record<string, number> = {
  'glm-4.7-flash': 128_000,
  'qwen2.5-72b': 32_768,
  'step-3.5-flash': 32_768,
  'qwq-32b': 32_768,
  'deepseek-r1-distill': 32_768,
  'wizardlm': 4_096,
  'gemma-3-4b': 8_192,
};

export class LMStudioProvider implements LLMProvider {
  name = 'lmstudio';
  private client!: import('openai').default;
  readonly host: string;
  readonly port: number;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  private async getClient(): Promise<import('openai').default> {
    if (!this.client) {
      const { default: OpenAI } = await import('openai');
      this.client = new OpenAI({
        baseURL: `http://${this.host}:${this.port}/v1`,
        apiKey: 'lm-studio',
      });
    }
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = await this.getClient();
      debug(`Checking availability at ${this.host}:${this.port}`);
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const client = await this.getClient();
    const response = await client.models.list();
    const models: ModelInfo[] = [];

    for await (const model of response) {
      const contextLength = this.lookupContextLimit(model.id);
      models.push({
        id: model.id,
        name: model.id,
        loaded: true,
        contextLength,
      });
      debug(`Found model: ${model.id} (context: ${contextLength ?? 'unknown'})`);
    }

    return models;
  }

  async validate(modelId: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      debug(`Validating model ${modelId} with test completion`);
      await client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      });
      return true;
    } catch (err) {
      debug(`Validation failed: ${err}`);
      return false;
    }
  }

  lookupContextLimit(modelId: string): number | undefined {
    const lower = modelId.toLowerCase();
    for (const [pattern, limit] of Object.entries(CONTEXT_LIMIT_TABLE)) {
      if (lower.includes(pattern)) return limit;
    }
    return undefined;
  }

  async *chat(
    _messages: ChatMessage[],
    _tools?: ToolDefinition[]
  ): AsyncIterable<StreamChunk> {
    // Phase 3 implementation — streaming agent loop
    yield { type: 'done' };
  }
}
