import { createResearchRegistry } from './registry.js';
import { makeProviderError, makeProviderFailure, toErrorMessage } from './providers/shared.js';
import type {
  ResearchConfigInput,
  ResearchProvider,
  ResearchProviderId,
  ResearchProviderResult,
  ResearchQuery,
  ResearchQueryIntent,
  ResearchRouteAttempt,
  ResearchRouteResult,
} from './types.js';

const INTENT_FALLBACK_ORDER: Record<ResearchQueryIntent, ResearchProviderId[]> = {
  general: ['tavily', 'exa', 'brave', 'gemini', 'groq'],
  news: ['tavily', 'brave', 'exa', 'gemini', 'groq'],
  academic: ['exa', 'tavily', 'gemini', 'brave', 'groq'],
  coding: ['tavily', 'groq', 'gemini', 'exa', 'brave'],
};

export interface RouteResearchOptions {
  config?: ResearchConfigInput | Record<string, unknown> | null;
  providers?: ResearchProvider[];
  providerOrder?: ResearchProviderId[];
}

function uniqueOrder(input: ResearchProviderId[]): ResearchProviderId[] {
  const seen = new Set<ResearchProviderId>();
  const output: ResearchProviderId[] = [];

  for (const providerId of input) {
    if (seen.has(providerId)) continue;
    seen.add(providerId);
    output.push(providerId);
  }

  return output;
}

function resolveOrderedProviders(
  providers: ResearchProvider[],
  intent: ResearchQueryIntent,
  explicitOrder?: ResearchProviderId[],
): ResearchProvider[] {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  if (enabledProviders.length === 0) return [];

  const providerMap = new Map<ResearchProviderId, ResearchProvider>();
  for (const provider of enabledProviders) {
    providerMap.set(provider.id, provider);
  }

  const fallbackOrder = INTENT_FALLBACK_ORDER[intent] ?? INTENT_FALLBACK_ORDER.general;
  const preferredOrder = explicitOrder && explicitOrder.length > 0
    ? uniqueOrder([...explicitOrder, ...fallbackOrder])
    : uniqueOrder([...fallbackOrder]);

  const orderedProviders: ResearchProvider[] = [];

  for (const providerId of preferredOrder) {
    const provider = providerMap.get(providerId);
    if (!provider) continue;
    orderedProviders.push(provider);
    providerMap.delete(providerId);
  }

  for (const provider of providerMap.values()) {
    orderedProviders.push(provider);
  }

  return orderedProviders;
}

async function executeWithTimeout(
  provider: ResearchProvider,
  query: ResearchQuery,
): Promise<ResearchProviderResult> {
  const timeoutMs = provider.timeoutMs > 0 ? provider.timeoutMs : 10_000;

  return new Promise<ResearchProviderResult>((resolve) => {
    let settled = false;

    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(
        makeProviderFailure(
          provider.id,
          'TIMEOUT',
          `Provider ${provider.id} timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);

    provider
      .search(query)
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        resolve(result);
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        resolve(
          makeProviderFailure(
            provider.id,
            'UNKNOWN_ERROR',
            `Provider threw an unexpected error: ${toErrorMessage(error, 'unknown error')}`,
          ),
        );
      });
  });
}

export async function routeResearchQuery(
  query: ResearchQuery,
  options: RouteResearchOptions = {},
): Promise<ResearchRouteResult> {
  const availableProviders = options.providers ?? createResearchRegistry(options.config);
  const orderedProviders = resolveOrderedProviders(availableProviders, query.intent, options.providerOrder);

  if (orderedProviders.length === 0) {
    return {
      ok: false,
      error: makeProviderError('router', 'NO_PROVIDERS_ENABLED', 'No enabled research providers are configured.', {
        retryable: false,
      }),
      attempts: [],
    };
  }

  const attempts: ResearchRouteAttempt[] = [];

  for (const provider of orderedProviders) {
    const result = await executeWithTimeout(provider, query);

    if (result.ok) {
      return {
        ok: true,
        provider: result.provider,
        result: result.result,
        attempts,
      };
    }

    attempts.push({
      provider: provider.id,
      error: result.error,
    });
  }

  const attemptedProviders = attempts.map((attempt) => attempt.provider).join(', ');

  return {
    ok: false,
    error: makeProviderError(
      'router',
      'ALL_PROVIDERS_FAILED',
      attemptedProviders
        ? `All providers failed for query "${query.query}": ${attemptedProviders}.`
        : `All providers failed for query "${query.query}".`,
    ),
    attempts,
  };
}
