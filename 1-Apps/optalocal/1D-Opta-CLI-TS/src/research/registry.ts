import { BraveResearchProvider } from './providers/brave.js';
import { ExaResearchProvider } from './providers/exa.js';
import { GeminiResearchProvider } from './providers/gemini.js';
import { GroqResearchProvider } from './providers/groq.js';
import { TavilyResearchProvider } from './providers/tavily.js';
import { RESEARCH_PROVIDER_IDS } from './types.js';
import type {
  ResearchConfigInput,
  ResearchProvider,
  ResearchProviderConfig,
  ResearchProviderId,
  ResearchProvidersConfig,
} from './types.js';

type ProviderCtor = new (config: ResearchProviderConfig) => ResearchProvider;

const PROVIDER_CTORS: Record<ResearchProviderId, ProviderCtor> = {
  tavily: TavilyResearchProvider,
  gemini: GeminiResearchProvider,
  exa: ExaResearchProvider,
  brave: BraveResearchProvider,
  groq: GroqResearchProvider,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toProviderConfig(raw: unknown): ResearchProviderConfig {
  if (!isRecord(raw)) return {};

  const timeoutMsValue = raw['timeoutMs'];

  return {
    enabled: raw['enabled'] === true,
    apiKey: typeof raw['apiKey'] === 'string' ? raw['apiKey'] : undefined,
    baseUrl: typeof raw['baseUrl'] === 'string' ? raw['baseUrl'] : undefined,
    timeoutMs: typeof timeoutMsValue === 'number' ? timeoutMsValue : undefined,
    model: typeof raw['model'] === 'string' ? raw['model'] : undefined,
  };
}

export function readResearchProviderConfigs(config: ResearchConfigInput | Record<string, unknown> | null | undefined): ResearchProvidersConfig {
  if (!isRecord(config)) return {};

  const research = isRecord(config['research']) ? config['research'] : undefined;
  if (!research) return {};

  const providers = isRecord(research['providers']) ? research['providers'] : undefined;
  if (!providers) return {};

  const output: ResearchProvidersConfig = {};

  for (const id of RESEARCH_PROVIDER_IDS) {
    output[id] = toProviderConfig(providers[id]);
  }

  return output;
}

export function createResearchRegistry(
  config: ResearchConfigInput | Record<string, unknown> | null | undefined,
): ResearchProvider[] {
  const providersConfig = readResearchProviderConfigs(config);
  const providers: ResearchProvider[] = [];

  for (const providerId of RESEARCH_PROVIDER_IDS) {
    const providerConfig = providersConfig[providerId] ?? {};
    if (providerConfig.enabled !== true) continue;

    const Provider = PROVIDER_CTORS[providerId];
    providers.push(new Provider(providerConfig));
  }

  return providers;
}
