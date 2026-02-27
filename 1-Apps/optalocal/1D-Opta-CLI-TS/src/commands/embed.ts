import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { EXIT, ExitError } from '../core/errors.js';
import { LmxApiError, LmxClient } from '../lmx/client.js';
import { errorMessage } from '../utils/errors.js';

interface EmbedOptions {
  model?: string;
  json?: boolean;
}

const EMBED_REQUEST_OPTS = { timeoutMs: 30_000, maxRetries: 0 } as const;

function usage(): void {
  console.log(chalk.dim('Usage: opta embed <text> [--model <id>] [--json]'));
}

export async function embed(input: string | string[], opts: EmbedOptions = {}): Promise<void> {
  const text = Array.isArray(input) ? input.join(' ').trim() : String(input ?? '').trim();
  if (!text) {
    console.error(chalk.red('✗') + ' Text input is required.\n');
    usage();
    throw new ExitError(EXIT.MISUSE);
  }

  const config = await loadConfig();
  const resolvedModel = (opts.model?.trim() || config.model.default || 'text-embedding-3-small').trim();
  const client = new LmxClient({
    host: config.connection.host,
    fallbackHosts: config.connection.fallbackHosts,
    port: config.connection.port,
    adminKey: config.connection.adminKey,
  });

  try {
    const response = await client.createEmbeddings(
      {
        input: text,
        model: resolvedModel,
      },
      EMBED_REQUEST_OPTS,
    );

    if (opts.json) {
      console.log(JSON.stringify(response, null, 2));
      return;
    }

    const vectors = Array.isArray(response.data) ? response.data : [];
    const dimensions = vectors[0]?.embedding?.length ?? 0;
    const totalTokens = response.usage?.total_tokens;

    console.log(chalk.green('✓') + ` Embedded 1 input using ${response.model}`);
    console.log(chalk.dim(`  vectors: ${vectors.length}`));
    if (dimensions > 0) {
      console.log(chalk.dim(`  dimensions: ${dimensions}`));
    }
    if (typeof totalTokens === 'number') {
      console.log(chalk.dim(`  tokens: ${totalTokens}`));
    }

    if (dimensions > 0) {
      const sample = vectors[0]!.embedding.slice(0, 8).map((value) => Number(value.toFixed(6)));
      const suffix = vectors[0]!.embedding.length > 8 ? ', ...' : '';
      console.log(chalk.dim(`  preview: [${sample.join(', ')}${suffix}]`));
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

    console.error(chalk.red('✗') + ` Failed to create embedding: ${errorMessage(err)}`);
    throw new ExitError(EXIT.ERROR);
  }
}
