import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readText(relativeToThisFile: string): string {
  return readFileSync(new URL(relativeToThisFile, import.meta.url), 'utf8');
}

describe('LMX route parity', () => {
  const clientSource = readText('../../src/lmx/client.ts');
  const commandSurface = [
    readText('../../src/index.ts'),
    readText('../../src/commands/sessions.ts'),
    readText('../../src/commands/embed.ts'),
    readText('../../src/commands/rerank.ts'),
    readText('../../src/commands/slash/session.ts'),
    readText('../../src/commands/slash/lmx/index.ts'),
    readText('../../src/commands/slash/lmx/types.ts'),
    readText('../../src/commands/slash/lmx/status.ts'),
    readText('../../src/commands/slash/lmx/lifecycle.ts'),
    readText('../../src/commands/slash/lmx/models.ts'),
    readText('../../src/commands/slash/lmx/config.ts'),
    readText('../../src/tui/OptaMenuOverlay.tsx'),
  ].join('\n');

  it('includes wrapper methods for required LMX routes', () => {
    const requiredRoutes = [
      '/admin/sessions',
      '/admin/sessions/search',
      '/v1/embeddings',
      '/v1/rerank',
      '/admin/benchmark/run',
      '/admin/benchmark/results',
      '/v1/agents/runs',
      '/v1/skills',
      '/v1/rag',
      '/v1/messages',
    ];

    for (const route of requiredRoutes) {
      expect(clientSource, `Missing LmxClient wrapper route ${route}`).toContain(route);
    }
  });

  it('maps key wrapped routes to at least one CLI/menu command path', () => {
    const routeCoverageChecks: Array<{ route: string; evidence: RegExp }> = [
      { route: '/admin/sessions', evidence: /\/sessions(?:\s+list)?\b|opta sessions\b/ },
      { route: '/admin/sessions/search', evidence: /\/sessions\s+search\b|opta sessions search\b/ },
      { route: '/admin/sessions/{id}', evidence: /\/sessions\s+(resume|delete|export)\b|opta sessions (resume|delete|export)\b/ },
      { route: '/v1/embeddings', evidence: /\/embed\b|opta embed\b/ },
      { route: '/v1/rerank', evidence: /\/rerank\b|opta rerank\b/ },
      { route: '/admin/benchmark/run', evidence: /\/benchmark\b/ },
      { route: '/admin/benchmark/results', evidence: /\/benchmark\s+results\b/ },
      { route: '/v1/agents/runs', evidence: /\/agents\b/ },
      { route: '/v1/skills', evidence: /\/lmx-skills\b/ },
      { route: '/v1/rag', evidence: /\/rag\b/ },
    ];

    for (const check of routeCoverageChecks) {
      expect(
        check.evidence.test(commandSurface),
        `Route ${check.route} is not surfaced by CLI/menu command paths`,
      ).toBe(true);
    }
  });
});
