import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { EXIT, ExitError } from '../core/errors.js';
import { NO_MODEL_ERROR } from '../utils/errors.js';
import { VERSION } from '../core/version.js';
import { runDaemon } from '../daemon/main.js';

// --- Server Handler (kept for lightweight validation tests and tooling) ---

interface ServerHandlerOptions {
  model: string;
  host: string;
  port: number;
}

interface HealthResponse {
  status: 'ok';
  model: string;
  uptime: number;
  version: string;
}

interface ChatValidation {
  valid: boolean;
  error?: string;
  message?: string;
  sessionId?: string;
}

export function createServerHandler(opts: ServerHandlerOptions) {
  const startTime = Date.now();

  return {
    handleHealth(): HealthResponse {
      return {
        status: 'ok',
        model: opts.model,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: VERSION,
      };
    },

    validateChatRequest(body: Record<string, unknown>): ChatValidation {
      if (!body.message || typeof body.message !== 'string') {
        return { valid: false, error: 'Missing required field: message (string)' };
      }
      return {
        valid: true,
        message: body.message,
        sessionId: typeof body.session_id === 'string' ? body.session_id : undefined,
      };
    },
  };
}

// --- Compatibility server command ---

interface ServerOptions {
  port?: number;
  host?: string;
  model?: string;
}

/**
 * Legacy `opta server` entrypoint.
 *
 * This now launches the Level 3 daemon directly so `/v1/chat` compatibility
 * and `/v3/*` APIs are served by a single runtime.
 */
export async function startServer(opts: ServerOptions): Promise<void> {
  const overrides: Record<string, unknown> = {};
  if (opts.model) {
    overrides['model'] = { default: opts.model };
  }
  const config = await loadConfig(overrides);

  if (!config.model.default) {
    console.error(
      chalk.red('✗') + ' ' + NO_MODEL_ERROR + '\n\n' +
      chalk.dim('Run ') + chalk.cyan('opta status') + chalk.dim(' to check your LMX connection')
    );
    throw new ExitError(EXIT.NO_CONNECTION);
  }

  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 3456;
  const model = opts.model ?? config.model.default;

  console.log(
    '\n' + chalk.bold('Opta Server') + chalk.dim(' (daemon backend) ') +
    chalk.cyan(`http://${host}:${port}`)
  );
  console.log(chalk.dim(`  Model: ${model}`));
  console.log(chalk.dim(`  LMX:   ${config.connection.host}:${config.connection.port}`));
  console.log(chalk.dim('  Endpoints: /health, /v1/chat, /v3/*'));
  console.log(chalk.dim('Press Ctrl+C to stop\n'));

  await runDaemon({ host, port, model });
}
