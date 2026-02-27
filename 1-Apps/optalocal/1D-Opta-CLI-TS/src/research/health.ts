import { createResearchRegistry } from './registry.js';
import { makeProviderError, toErrorMessage } from './providers/shared.js';
import type {
  ResearchConfigInput,
  ResearchProvider,
  ResearchProviderHealth,
  ResearchProviderId,
} from './types.js';

export interface ResearchHealthCheckOptions {
  config?: ResearchConfigInput | Record<string, unknown> | null;
  providers?: ResearchProvider[];
}

export interface ResearchHealthSummary {
  ok: boolean;
  checks: ResearchProviderHealth[];
}

export async function checkResearchProviderHealth(
  options: ResearchHealthCheckOptions = {},
): Promise<ResearchHealthSummary> {
  const providers = options.providers ?? createResearchRegistry(options.config);

  const checks = await Promise.all(
    providers.map(async (provider): Promise<ResearchProviderHealth> => {
      try {
        return await provider.healthCheck();
      } catch (error) {
        return {
          provider: provider.id,
          status: 'unhealthy',
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
          error: makeProviderError(
            provider.id as ResearchProviderId,
            'UNKNOWN_ERROR',
            `Health check failed unexpectedly: ${toErrorMessage(error, 'unknown error')}`,
          ),
        };
      }
    }),
  );

  return {
    ok: checks.length > 0 && checks.every((check) => check.status !== 'unhealthy'),
    checks,
  };
}
