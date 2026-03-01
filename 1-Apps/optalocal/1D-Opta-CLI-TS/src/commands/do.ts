import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { agentLoop } from '../core/agent.js';
import { formatError, OptaError, ExitError, EXIT } from '../core/errors.js';
import { buildConfigOverrides } from '../utils/config-helpers.js';
import { NO_MODEL_ERROR } from '../utils/errors.js';
import { DaemonClient } from '../daemon/client.js';
import { loadAccountState } from '../accounts/storage.js';
import { evaluateCapability } from '../accounts/cloud.js';

// --- Types ---

export type OutputFormat = 'json' | 'text' | 'quiet';

export interface DoResult {
  response: string;
  toolCallCount: number;
  model: string;
  exitCode: number;
  error?: string;
}

interface DoOptions {
  model?: string;
  device?: string;
  commit?: boolean;
  checkpoints?: boolean;
  format?: string;
  quiet?: boolean;
  output?: string;
  auto?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
}

// --- Output Formatting (testable) ---

/**
 * Determine the output format from CLI flags.
 * Priority: --quiet > --format > default (text)
 */
export function parseDoOutput(opts: { format?: string; quiet?: boolean }): OutputFormat {
  if (opts.quiet) return 'quiet';
  if (opts.format === 'json') return 'json';
  return 'text';
}

/**
 * Format the result based on the output mode.
 */
export function formatDoResult(result: DoResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify({
        result: result.response,
        tool_calls: result.toolCallCount,
        model: result.model,
        exit_code: result.exitCode,
        ...(result.error ? { error: result.error } : {}),
      });

    case 'quiet':
      // In quiet mode, only output errors
      if (result.error) return result.error;
      return '';

    case 'text':
    default:
      return result.response;
  }
}

// --- Command Implementation ---

export async function executeTask(task: string[], opts: DoOptions): Promise<void> {
  const taskStr = task.join(' ');

  const outputFormat = parseDoOutput(opts);

  if (!taskStr.trim()) {
    if (outputFormat === 'json') {
      console.log(JSON.stringify({ error: 'No task specified', exit_code: EXIT.MISUSE }));
    } else if (outputFormat !== 'quiet') {
      console.error(chalk.red('\u2717') + ' No task specified\n');
      console.log(chalk.dim('Usage: opta do <task...>'));
      console.log(chalk.dim('Example: opta do "fix the authentication bug"'));
    }
    throw new ExitError(EXIT.MISUSE);
  }

  const overrides = buildConfigOverrides(opts);

  const silent = outputFormat === 'json' || outputFormat === 'quiet';

  const accountState = await loadAccountState();
  if (accountState?.session) {
    const gate = await evaluateCapability(accountState, 'cli.run', accountState.deviceId);
    if (!gate.allow) {
      const message = `Capability denied for cli.run${gate.reason ? ` (${gate.reason})` : ''}`;
      if (outputFormat === 'json') {
        console.log(JSON.stringify({ error: message, exit_code: EXIT.PERMISSION }));
      } else {
        console.error(chalk.red('✗') + ` ${message}`);
      }
      throw new ExitError(EXIT.PERMISSION);
    }
  }

  try {
    const config = await loadConfig(overrides);

    if (!config.model.default) {
      const doResult: DoResult = {
        response: '',
        toolCallCount: 0,
        model: '',
        exitCode: EXIT.NO_CONNECTION,
        error: NO_MODEL_ERROR,
      };
      const output = formatDoResult(doResult, outputFormat);
      if (output) console.log(output);
      throw new ExitError(EXIT.NO_CONNECTION);
    }

    if (!silent) {
      console.log(
        chalk.dim(`opta \u00b7 ${config.model.default} \u00b7 ${config.connection.host}`)
      );
    }

    const taskStart = Date.now();
    let doResult: DoResult;
    const shouldBypassDaemon = Boolean(opts.device && opts.device.trim().length > 0);

    try {
      if (shouldBypassDaemon) {
        throw new Error('Bypassing daemon for explicit --device override');
      }
      const daemon = await DaemonClient.connect();
      const daemonResp = await daemon.legacyChat(taskStr);
      const stats = daemonResp.stats;
      doResult = {
        response: daemonResp.response ?? '',
        toolCallCount: stats?.toolCalls ?? 0,
        model: daemonResp.model ?? config.model.default,
        exitCode: 0,
      };
    } catch (error) {
      // Compatibility fallback in case daemon bootstrap fails.
      if (!silent) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(chalk.yellow(`⚠ daemon path unavailable: ${reason}`));
        console.error(chalk.dim('  Falling back to local agent loop for this run.'));
      }
      const result = await agentLoop(taskStr, config, { silent });
      const assistantMsgs = result.messages.filter((m) => m.role === 'assistant');
      const finalMsg = assistantMsgs[assistantMsgs.length - 1];
      doResult = {
        response: typeof finalMsg?.content === 'string' ? finalMsg.content : '',
        toolCallCount: result.toolCallCount,
        model: config.model.default,
        exitCode: 0,
      };
    }

    const output = formatDoResult(doResult, outputFormat);
    if (output) console.log(output);

    // Elapsed time footer in text mode
    if (outputFormat === 'text') {
      const elapsed = ((Date.now() - taskStart) / 1000).toFixed(1);
      const toolStr =
        doResult.toolCallCount > 0
          ? chalk.dim(
              ` · ${doResult.toolCallCount} tool call${doResult.toolCallCount !== 1 ? 's' : ''}`
            )
          : '';
      console.log(chalk.dim(`\n  Done in ${elapsed}s${toolStr}`));
    }

    // Write to file if --output specified
    if (opts.output) {
      const { writeFile } = await import('node:fs/promises');
      const fullOutput =
        outputFormat === 'json' ? formatDoResult(doResult, 'json') : doResult.response;
      await writeFile(opts.output, fullOutput, 'utf-8');
      if (!silent) {
        console.log(chalk.dim(`  Output written to ${opts.output}`));
      }
    }
  } catch (err) {
    if (err instanceof OptaError) {
      if (outputFormat === 'json') {
        console.log(JSON.stringify({ error: err.message, exit_code: err.code }));
      } else if (outputFormat !== 'quiet') {
        console.error(formatError(err));
      } else {
        console.error(err.message);
      }
      throw new ExitError(err.code);
    }
    throw err;
  }
}
