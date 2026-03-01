/**
 * Anthropic provider — uses the Anthropic SDK with an OpenAI-compatible wrapper.
 *
 * The agent loop uses OpenAI SDK types, so we use Anthropic's OpenAI compatibility
 * layer (@anthropic-ai/sdk provides an OpenAI-compatible client) rather than
 * converting message formats manually.
 */

import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { errorMessage } from '../utils/errors.js';

type AnthropicKeySource = 'config' | 'env' | 'keychain' | 'cloud' | 'none';

export class AnthropicProvider implements ProviderClient {
  readonly name = 'anthropic';
  private client: import('openai').default | null = null;
  private config: OptaConfig;

  constructor(config: OptaConfig) {
    this.config = config;
  }

  private async resolveApiKey(): Promise<{ apiKey: string; source: AnthropicKeySource }> {
    const configuredKey = this.config.provider.anthropic.apiKey?.trim();
    if (configuredKey) return { apiKey: configuredKey, source: 'config' };

    const envKey = process.env['ANTHROPIC_API_KEY']?.trim();
    if (envKey) return { apiKey: envKey, source: 'env' };

    try {
      const { getAnthropicKey } = await import('../keychain/api-keys.js');
      const keychainKey = (await getAnthropicKey())?.trim();
      if (keychainKey) return { apiKey: keychainKey, source: 'keychain' };
    } catch {
      // Keychain unavailable/errored: continue and check cloud.
    }

    // 4. Opta Accounts cloud key — mirrors the LMX resolution chain so that
    //    keys stored via the Opta Accounts portal work for Anthropic too.
    try {
      const { loadAccountState } = await import('../accounts/storage.js');
      const { resolveCloudApiKey } = await import('../accounts/cloud.js');
      const state = await loadAccountState();
      const cloudKey = (await resolveCloudApiKey(state, 'anthropic'))?.trim();
      if (cloudKey) return { apiKey: cloudKey, source: 'cloud' };
    } catch {
      // Cloud lookup unavailable — fall through to none.
    }

    return { apiKey: '', source: 'none' };
  }

  async getClient(): Promise<import('openai').default> {
    if (this.client) return this.client;

    const { default: OpenAI } = await import('openai');
    const { apiKey } = await this.resolveApiKey();

    if (!apiKey) {
      throw new Error(
        'Anthropic API key required.\n\n' +
          'Set it via:\n' +
          '  opta config set provider.anthropic.apiKey sk-ant-...\n' +
          '  or export ANTHROPIC_API_KEY=sk-ant-...\n' +
          '  or opta keychain set-anthropic sk-ant-...\n' +
          '  or add an Anthropic key in your Opta Account at accounts.optalocal.com'
      );
    }

    // Use Anthropic's OpenAI-compatible endpoint
    this.client = new OpenAI({
      baseURL: 'https://api.anthropic.com/v1/',
      apiKey,
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
    });
    return this.client;
  }

  listModels(): Promise<ProviderModelInfo[]> {
    // Anthropic doesn't have a models list endpoint; return known models
    return Promise.resolve([
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextLength: 200000 },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', contextLength: 200000 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextLength: 200000 },
    ]);
  }

  async health(): Promise<ProviderHealthResult> {
    const start = Date.now();
    const { apiKey, source } = await this.resolveApiKey();

    if (!apiKey) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error:
          'No API key configured (checked config, ANTHROPIC_API_KEY, keychain, and Opta Accounts cloud)',
      };
    }

    if (!apiKey.startsWith('sk-ant-') && !apiKey.startsWith('sk-')) {
      const sourceLabel = source === 'none' ? 'resolved key' : `${source} key`;
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: `Invalid API key format (${sourceLabel}) — expected sk-ant-...`,
      };
    }

    try {
      // Use GET /v1/models — lightweight connectivity + auth check with zero token spend.
      // (The previous POST to /v1/messages cost tokens on every health probe.)
      const res = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(10000),
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: errorMessage(err),
      };
    }
  }
}
