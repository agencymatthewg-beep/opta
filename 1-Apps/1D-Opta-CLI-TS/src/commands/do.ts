import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { agentLoop } from '../core/agent.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';
import { buildConfigOverrides } from '../utils/config-helpers.js';

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
    process.exit(EXIT.MISUSE);
  }

  const overrides = buildConfigOverrides(opts);

  const silent = outputFormat === 'json' || outputFormat === 'quiet';

  try {
    const config = await loadConfig(overrides);

    if (!config.model.default) {
      const doResult: DoResult = {
        response: '',
        toolCallCount: 0,
        model: '',
        exitCode: EXIT.NO_CONNECTION,
        error: 'No model configured',
      };
      const output = formatDoResult(doResult, outputFormat);
      if (output) console.log(output);
      process.exit(EXIT.NO_CONNECTION);
    }

    if (!silent) {
      console.log(
        chalk.dim(`opta \u00b7 ${config.model.default} \u00b7 ${config.connection.host}`)
      );
    }

    const result = await agentLoop(taskStr, config, { silent });

    // Extract final assistant message
    const assistantMsgs = result.messages.filter((m) => m.role === 'assistant');
    const finalMsg = assistantMsgs[assistantMsgs.length - 1];

    const doResult: DoResult = {
      response: typeof finalMsg?.content === 'string' ? finalMsg.content : '',
      toolCallCount: result.toolCallCount,
      model: config.model.default,
      exitCode: 0,
    };

    const output = formatDoResult(doResult, outputFormat);
    if (output) console.log(output);

    // Write to file if --output specified
    if (opts.output) {
      const { writeFile } = await import('node:fs/promises');
      const fullOutput = outputFormat === 'json'
        ? formatDoResult(doResult, 'json')
        : doResult.response;
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
      process.exit(err.code);
    }
    throw err;
  }
}
