/**
 * Provider abstraction — common interface for LLM providers.
 *
 * All providers expose the same methods so agent.ts doesn't need to
 * know which backend (LMX, Anthropic, etc.) is active.
 */

export interface ProviderModelInfo {
  id: string;
  name?: string;
  contextLength?: number;
}

export interface ProviderHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface ProviderClient {
  /** Provider identifier (e.g., 'lmx', 'anthropic'). */
  readonly name: string;

  /**
   * Returns an OpenAI-compatible client for use with the agent loop.
   * The agent loop uses OpenAI SDK types, so providers must return
   * a client that speaks the OpenAI chat completions API.
   */
  getClient(): Promise<import('openai').default>;

  /** List available models from this provider. */
  listModels(): Promise<ProviderModelInfo[]>;

  /** Health check — returns connectivity status. */
  health(): Promise<ProviderHealthResult>;
}
