import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { EXIT, ExitError } from '../core/errors.js';
import { LmxApiError, LmxClient } from '../lmx/client.js';
import type { LmxRerankDocumentResult } from '../lmx/client.js';
import { errorMessage } from '../utils/errors.js';

interface RerankOptions {
  documents?: string;
  model?: string;
  topK?: string;
  json?: boolean;
}

const RERANK_REQUEST_OPTS = { timeoutMs: 30_000, maxRetries: 0 } as const;

function usage(): void {
  console.log(
    chalk.dim('Usage: opta rerank <query> --documents <doc1|doc2|...> [--model <id>] [--top-k <n>] [--json]'),
  );
}

function parseDocuments(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split('|').map((entry) => entry.trim()).filter(Boolean);
}

function parseTopK(raw: string | undefined): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('--top-k must be a positive integer');
  }
  return parsed;
}

function formatDocumentPreview(result: LmxRerankDocumentResult, fallbackDocuments: string[]): string {
  const text = result.document?.text ?? fallbackDocuments[result.index] ?? '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 96) return normalized;
  return `${normalized.slice(0, 93)}...`;
}

export async function rerank(queryInput: string | string[], opts: RerankOptions = {}): Promise<void> {
  const query = Array.isArray(queryInput) ? queryInput.join(' ').trim() : String(queryInput ?? '').trim();
  if (!query) {
    console.error(chalk.red('✗') + ' Query is required.\n');
    usage();
    throw new ExitError(EXIT.MISUSE);
  }

  const documents = parseDocuments(opts.documents);
  if (documents.length === 0) {
    console.error(chalk.red('✗') + ' --documents is required and must include at least one document.\n');
    usage();
    throw new ExitError(EXIT.MISUSE);
  }

  let topK: number | undefined;
  try {
    topK = parseTopK(opts.topK);
  } catch (err) {
    console.error(chalk.red('✗') + ` ${errorMessage(err)}\n`);
    usage();
    throw new ExitError(EXIT.MISUSE);
  }

  const config = await loadConfig();
  const resolvedModel = (opts.model?.trim() || config.model.default || 'rerank-v1').trim();
  const client = new LmxClient({
    host: config.connection.host,
    fallbackHosts: config.connection.fallbackHosts,
    port: config.connection.port,
    adminKey: config.connection.adminKey,
  });

  try {
    const response = await client.rerankDocuments(
      {
        model: resolvedModel,
        query,
        documents,
        topN: topK,
      },
      RERANK_REQUEST_OPTS,
    );

    if (opts.json) {
      console.log(JSON.stringify(response, null, 2));
      return;
    }

    const usageTokens = response.usage?.total_tokens;
    console.log(chalk.green('✓') + ` Reranked ${documents.length} document${documents.length === 1 ? '' : 's'} with ${response.model}`);
    console.log(chalk.dim(`  query: ${query}`));
    if (typeof usageTokens === 'number') {
      console.log(chalk.dim(`  tokens: ${usageTokens}`));
    }

    if (!Array.isArray(response.results) || response.results.length === 0) {
      console.log(chalk.dim('  No results returned.'));
      return;
    }

    for (const [rank, result] of response.results.entries()) {
      const score = Number.isFinite(result.relevance_score) ? result.relevance_score.toFixed(4) : 'n/a';
      const preview = formatDocumentPreview(result, documents);
      console.log(`  ${rank + 1}. [${score}] doc#${result.index + 1} ${preview}`);
    }
  } catch (err) {
    if (err instanceof LmxApiError && err.code === 'connection_error') {
      console.error(
        chalk.red('✗')
        + ` Unable to reach Opta LMX at ${config.connection.host}:${config.connection.port}`,
      );
      console.error(chalk.dim(`  ${err.message}`));
      throw new ExitError(EXIT.NO_CONNECTION);
    }

    console.error(chalk.red('✗') + ` Failed to rerank documents: ${errorMessage(err)}`);
    throw new ExitError(EXIT.ERROR);
  }
}
